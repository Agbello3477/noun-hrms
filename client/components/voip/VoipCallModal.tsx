'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api, { getSocketUrl, getApiBaseUrl } from '../../lib/api';
import { VoipPeerManager, stopMediaStreamTracks } from '../../lib/webrtc';
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Search, 
  Users, Shield, Heart, Clock, X, UserCheck, AlertCircle, Radio, Loader2,
  Square, Play, Pause, Trash2, Send, CheckCircle2
} from 'lucide-react';
import io, { Socket } from 'socket.io-client';

interface VoipUser {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  rank: string;
  extension: string;
  department: string;
  status: string;
}

interface VoipCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  initialExtension?: string;
  onMissedCallCountChange?: (count: number) => void;
}

interface MissedCall {
  callId: string;
  callerExtension: string;
  callerName: string;
  callerRank: string;
  missedAt: string;
}

interface VoicemailItem {
  id: string;
  callerUserId: string;
  callerExtension: string;
  recipientExtension: string;
  audioUrl: string;
  durationSeconds: number;
  isListened: boolean;
  createdAt: string;
  callerUser?: {
    name: string;
    email: string;
    staffProfile?: {
      surname?: string;
      otherNames?: string;
      rank?: string;
      passportUrl?: string;
    };
  };
}

export default function VoipCallModal({ isOpen, onClose, onOpen, initialExtension, onMissedCallCountChange }: VoipCallModalProps) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  // VoIP Extension States
  const [userExtension, setUserExtension] = useState<string>('');
  const [targetExt, setTargetExt] = useState<string>('');
  const [directory, setDirectory] = useState<VoipUser[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingDirectory, setLoadingDirectory] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'keypad' | 'directory' | 'ptt' | 'missed' | 'voicemail'>('keypad');
  const [onlineExtensions, setOnlineExtensions] = useState<Set<string>>(new Set());

  // Active Call States
  const [callState, setCallState] = useState<'IDLE' | 'INITIATING' | 'RINGING' | 'INCOMING' | 'CONNECTED' | 'REJECTED' | 'ENDED'>('IDLE');
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [peerInfo, setPeerInfo] = useState<{ name: string; rank: string; extension: string; department?: string } | null>(null);
  
  // Call Controls (Loudspeaker ON by default)
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState<boolean>(true);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [callError, setCallError] = useState<string>('');

  // Security PTT State
  const [isPttTalking, setIsPttTalking] = useState<boolean>(false);
  const [activePttSpeaker, setActivePttSpeaker] = useState<string | null>(null);

  // Missed Call & Voicemail State
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);
  const [voicemails, setVoicemails] = useState<VoicemailItem[]>([]);
  const [loadingVoicemails, setLoadingVoicemails] = useState<boolean>(false);
  const [playingVoicemailId, setPlayingVoicemailId] = useState<string | null>(null);
  const [newMissedCount, setNewMissedCount] = useState<number>(0);

  // Voice Note Recording for Unanswered / Busy Call
  const [showVoicemailRecorder, setShowVoicemailRecorder] = useState<boolean>(false);
  const [voicemailTargetExt, setVoicemailTargetExt] = useState<string>('');
  const [voicemailTargetName, setVoicemailTargetName] = useState<string>('');
  const [isRecordingVoicemail, setIsRecordingVoicemail] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isSendingVoicemail, setIsSendingVoicemail] = useState<boolean>(false);
  const [voicemailSentSuccess, setVoicemailSentSuccess] = useState<boolean>(false);

  // References
  const peerManagerRef = useRef<VoipPeerManager | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const voicemailAudioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const incomingOfferSdpRef = useRef<any>(null);
  const myExtensionRef = useRef<string>('');

  // Propagate missed call count to parent (for Header badge)
  useEffect(() => {
    onMissedCallCountChange?.(newMissedCount);
  }, [newMissedCount, onMissedCallCountChange]);

  // Adjust volume on loudspeaker mode change
  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = isSpeakerOn ? 1.0 : 0.4;
    }
  }, [isSpeakerOn]);

  // Initialize Socket.io connection for VoIP Signaling
  useEffect(() => {
    if (!user || typeof window === 'undefined') return;

    const token = localStorage.getItem('token');
    const socketUrl = getSocketUrl();
    console.log('[VoIP UI] Connecting to signaling server:', socketUrl);
    
    const socketInstance = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      console.log('[VoIP UI] Signaling socket connected');
      if (myExtensionRef.current) {
        socketInstance.emit('VOIP_REGISTER_EXTENSION', { extension: myExtensionRef.current });
        console.log(`[VoIP UI] Registered extension ${myExtensionRef.current} on connect`);
      }
      socketInstance.emit('VOIP_GET_ONLINE_EXTENSIONS', (exts: string[]) => {
        if (Array.isArray(exts)) {
          setOnlineExtensions(new Set(exts));
        }
      });
    });

    // Real-time Voicemail notification
    socketInstance.on('VOICEMAIL_RECEIVED', (vm: any) => {
      console.log('[VoIP UI] Received new voicemail in real-time:', vm);
      setVoicemails((prev) => [vm, ...prev]);
      setNewMissedCount((prev) => prev + 1);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user]);

  // Fetch logged in user's guaranteed extension
  const fetchMyExtension = useCallback(async () => {
    try {
      const { data } = await api.get('/api/voip/my-extension');
      if (data?.extension) {
        myExtensionRef.current = data.extension;
        setUserExtension(data.extension);
        if (socket?.connected) {
          socket.emit('VOIP_REGISTER_EXTENSION', { extension: data.extension });
          console.log(`[VoIP UI] Registered my extension ${data.extension} from /my-extension`);
        }
      }
    } catch (err) {
      console.error('[VoIP UI] Failed to get my extension', err);
    }
  }, [socket]);

  // Fetch directory and user's 4-digit extension
  const fetchDirectory = useCallback(async () => {
    try {
      setLoadingDirectory(true);
      const { data } = await api.get('/api/voip/directory');
      setDirectory(data || []);

      if (!myExtensionRef.current) {
        const myProfile = (data || []).find((p: VoipUser) => p.userId === user?.id);
        if (myProfile?.extension) {
          myExtensionRef.current = myProfile.extension;
          setUserExtension(myProfile.extension);
          if (socket?.connected) {
            socket.emit('VOIP_REGISTER_EXTENSION', { extension: myProfile.extension });
          }
        }
      }
    } catch (err) {
      console.error('[VoIP UI] Failed to load extension directory', err);
    } finally {
      setLoadingDirectory(false);
    }
  }, [user, socket]);

  // Fetch Voicemails
  const fetchVoicemails = useCallback(async () => {
    try {
      setLoadingVoicemails(true);
      const { data } = await api.get('/api/voip/voicemails');
      setVoicemails(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[VoIP UI] Failed to load voicemails', err);
    } finally {
      setLoadingVoicemails(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchMyExtension();
      fetchDirectory();
      fetchVoicemails();
    }
  }, [user, fetchMyExtension, fetchDirectory, fetchVoicemails]);

  useEffect(() => {
    if (initialExtension) {
      setTargetExt(initialExtension);
    }
  }, [initialExtension]);

  // Call Duration Timer
  useEffect(() => {
    if (callState === 'CONNECTED') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Handle Signal Socket Events
  useEffect(() => {
    if (!socket) return;

    // Incoming Call
    socket.on('INCOMING_CALL', (data: { callId: string; callerExtension: string; callerName: string; callerRank: string; sdpOffer: any }) => {
      console.log('[VoIP UI] Incoming call from Ext:', data.callerExtension);
      incomingOfferSdpRef.current = data.sdpOffer;
      setCurrentCallId(data.callId);
      setPeerInfo({
        name: data.callerName,
        rank: data.callerRank,
        extension: data.callerExtension
      });
      setCallState('INCOMING');

      socket.emit('CALL_RINGING', { callId: data.callId });
    });

    // Call Ringing Ack
    socket.on('CALL_RINGING', () => {
      setCallState('RINGING');
    });

    // Call Accepted
    socket.on('CALL_ACCEPTED', async (data: { callId: string; sdpAnswer: any }) => {
      console.log('[VoIP UI] Call accepted by peer');
      if (peerManagerRef.current) {
        await peerManagerRef.current.handleAnswer(data.sdpAnswer);
        setCallState('CONNECTED');
      }
    });

    // Call Rejected
    socket.on('CALL_REJECTED', (data: { reason?: string }) => {
      setCallError(data.reason || 'Call was declined.');
      setCallState('REJECTED');
      cleanupCallHardware();

      // Offer to leave voice note
      if (targetExt) {
        setVoicemailTargetExt(targetExt);
        setVoicemailTargetName(peerInfo?.name || `Ext ${targetExt}`);
        setShowVoicemailRecorder(true);
      }
    });

    // Call Unavailable (User is Offline / Not Registered)
    socket.on('CALL_UNAVAILABLE', (data: { targetExtension: string; reason?: string; message?: string }) => {
      console.log('[VoIP UI] Target unavailable:', data);
      setCallError(data.message || `Extension ${data.targetExtension} is currently offline and unavailable.`);
      setCallState('REJECTED');
      cleanupCallHardware();

      // Offer to leave voice note
      setVoicemailTargetExt(data.targetExtension || targetExt);
      setVoicemailTargetName(peerInfo?.name || `Ext ${data.targetExtension || targetExt}`);
      setShowVoicemailRecorder(true);
    });

    // Call Timeout
    socket.on('CALL_TIMEOUT', (data: { message?: string }) => {
      setCallError(data.message || 'No answer from target extension.');
      setCallState('REJECTED');
      cleanupCallHardware();

      // Offer to leave voice note
      if (targetExt) {
        setVoicemailTargetExt(targetExt);
        setVoicemailTargetName(peerInfo?.name || `Ext ${targetExt}`);
        setShowVoicemailRecorder(true);
      }
    });

    // Call Failed
    socket.on('CALL_FAILED', (data: { reason?: string }) => {
      setCallError(data.reason || 'Call failed.');
      setCallState('REJECTED');
      cleanupCallHardware();
    });

    // Call Ended
    socket.on('CALL_ENDED', () => {
      setCallState('ENDED');
      cleanupCallHardware();
      setTimeout(() => {
        setCallState('IDLE');
        setCurrentCallId(null);
        setPeerInfo(null);
      }, 1500);
    });

    // Missed Call Notification
    socket.on('CALL_MISSED', (data: MissedCall) => {
      console.log('[VoIP UI] Received missed call notice:', data);
      setMissedCalls((prev) => [data, ...prev]);
      setNewMissedCount((prev) => prev + 1);
    });

    // ICE Candidate Relay
    socket.on('ICE_CANDIDATE', async (data: { candidate: any }) => {
      if (peerManagerRef.current && data.candidate) {
        await peerManagerRef.current.addIceCandidate(data.candidate);
      }
    });

    return () => {
      socket.off('INCOMING_CALL');
      socket.off('CALL_RINGING');
      socket.off('CALL_ACCEPTED');
      socket.off('CALL_REJECTED');
      socket.off('CALL_UNAVAILABLE');
      socket.off('CALL_TIMEOUT');
      socket.off('CALL_FAILED');
      socket.off('CALL_ENDED');
      socket.off('CALL_MISSED');
      socket.off('ICE_CANDIDATE');
    };
  }, [socket, targetExt, peerInfo]);

  // Clean up WebRTC audio tracks and reset hardware
  const cleanupCallHardware = () => {
    if (peerManagerRef.current) {
      peerManagerRef.current.cleanup();
      peerManagerRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  };

  // Initiate Outgoing VoIP Call
  const handleInitiateCall = async (extensionToCall?: string) => {
    const ext = extensionToCall || targetExt;
    if (!ext || ext.length < 3) {
      setCallError('Please enter a valid 3 or 4-digit extension');
      return;
    }

    if (ext === userExtension) {
      setCallError('Cannot dial your own internal extension');
      return;
    }

    if (!socket?.connected) {
      setCallError('VoIP signaling connection is offline. Reconnecting...');
      return;
    }

    setCallError('');
    setCallState('INITIATING');
    setShowVoicemailRecorder(false);

    try {
      const { data: iceConfig } = await api.get('/api/voip/ice-servers');

      const peer = new VoipPeerManager(
        iceConfig.iceServers,
        (candidate) => {
          socket.emit('ICE_CANDIDATE', {
            targetExtension: ext,
            candidate,
            callId: currentCallId
          });
        },
        (remoteStream) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
          }
        }
      );

      peerManagerRef.current = peer;

      const offer = await peer.createOffer();

      const peerUser = directory.find((p) => p.extension === ext);
      setPeerInfo({
        name: peerUser?.name || `Extension ${ext}`,
        rank: peerUser?.rank || 'Staff',
        extension: ext,
        department: peerUser?.department || 'Department'
      });

      socket.emit('CALL_INITIATE', {
        targetExtension: ext,
        sdpOffer: offer,
        callerName: user?.name,
        callerRank: 'Academic Staff'
      });
    } catch (err: any) {
      console.error('[VoIP UI] Failed to start call:', err);
      setCallError(err.message || 'Microphone access denied or audio device busy');
      setCallState('REJECTED');
      cleanupCallHardware();
    }
  };

  // Accept Incoming Call
  const handleAcceptCall = async () => {
    if (!currentCallId || !incomingOfferSdpRef.current || !socket) return;

    try {
      const { data: iceConfig } = await api.get('/api/voip/ice-servers');

      const peer = new VoipPeerManager(
        iceConfig.iceServers,
        (candidate) => {
          if (peerInfo?.extension) {
            socket.emit('ICE_CANDIDATE', {
              targetExtension: peerInfo.extension,
              candidate,
              callId: currentCallId
            });
          }
        },
        (remoteStream) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
          }
        }
      );

      peerManagerRef.current = peer;

      const answer = await peer.handleOfferAndCreateAnswer(incomingOfferSdpRef.current);

      socket.emit('CALL_ACCEPTED', {
        callId: currentCallId,
        sdpAnswer: answer
      });

      setCallState('CONNECTED');
    } catch (err: any) {
      console.error('[VoIP UI] Failed to accept call:', err);
      handleRejectCall();
    }
  };

  // Reject Incoming Call
  const handleRejectCall = () => {
    if (socket && currentCallId) {
      socket.emit('CALL_REJECTED', { callId: currentCallId, reason: 'Declined by recipient' });
    }
    setCallState('IDLE');
    cleanupCallHardware();
  };

  // Hang Up Active Call
  const handleHangup = () => {
    if (socket && currentCallId) {
      socket.emit('CALL_ENDED', { callId: currentCallId });
    }
    setCallState('ENDED');
    cleanupCallHardware();
    setTimeout(() => {
      setCallState('IDLE');
      setCurrentCallId(null);
      setPeerInfo(null);
    }, 1000);
  };

  // Toggle Microphone Mute
  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      if (peerManagerRef.current) {
        peerManagerRef.current.setMicrophoneMuted(next);
      }
      return next;
    });
  };

  // Toggle Loudspeaker
  const handleToggleSpeaker = () => {
    setIsSpeakerOn((prev) => !prev);
  };

  // ─── Phase 17: Voice Note Recording Logic ─────────────────────────────────

  const handleStartVoicemailRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);
        stopMediaStreamTracks(stream);
      };

      mediaRecorder.start(100);
      setIsRecordingVoicemail(true);
      setRecordingDuration(0);
      setRecordedAudioBlob(null);
      setRecordedAudioUrl(null);

      recTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 60) {
            handleStopVoicemailRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('[Voice Note] Microphone access error:', err);
      alert('Unable to access microphone to record voice note.');
    }
  };

  const handleStopVoicemailRecording = () => {
    if (mediaRecorderRef.current && isRecordingVoicemail) {
      mediaRecorderRef.current.stop();
      setIsRecordingVoicemail(false);
      if (recTimerRef.current) clearInterval(recTimerRef.current);
    }
  };

  const handleSendVoicemail = async () => {
    if (!recordedAudioBlob || !voicemailTargetExt) return;

    setIsSendingVoicemail(true);
    try {
      const formData = new FormData();
      formData.append('audio', recordedAudioBlob, `voicemail-${Date.now()}.webm`);
      formData.append('recipientExtension', voicemailTargetExt);
      formData.append('durationSeconds', recordingDuration.toString());

      const res = await api.post('/api/voip/voicemail', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Relay real-time socket event to callee
      if (socket?.connected && res.data?.voicemail) {
        socket.emit('VOICEMAIL_SENT', {
          recipientUserId: res.data.voicemail.recipientUserId,
          recipientExtension: voicemailTargetExt,
          voicemail: res.data.voicemail
        });
      }

      setVoicemailSentSuccess(true);
      setTimeout(() => {
        setShowVoicemailRecorder(false);
        setVoicemailSentSuccess(false);
        setRecordedAudioBlob(null);
        setRecordedAudioUrl(null);
        setRecordingDuration(0);
        setCallState('IDLE');
      }, 2000);
    } catch (err: any) {
      console.error('[Voice Note] Failed to send voicemail:', err);
      alert(err.response?.data?.message || 'Failed to send voice note. Please try again.');
    } finally {
      setIsSendingVoicemail(false);
    }
  };

  const handlePlayVoicemail = (vm: VoicemailItem) => {
    if (playingVoicemailId === vm.id) {
      if (voicemailAudioPlayerRef.current) {
        voicemailAudioPlayerRef.current.pause();
        setPlayingVoicemailId(null);
      }
      return;
    }

    const fullAudioUrl = vm.audioUrl.startsWith('http') ? vm.audioUrl : `${getApiBaseUrl()}${vm.audioUrl}`;
    if (voicemailAudioPlayerRef.current) {
      voicemailAudioPlayerRef.current.src = fullAudioUrl;
      voicemailAudioPlayerRef.current.play().catch(() => {});
      setPlayingVoicemailId(vm.id);

      // Mark listened in DB
      if (!vm.isListened) {
        api.put(`/api/voip/voicemails/${vm.id}/listened`).catch(() => {});
        setVoicemails((prev) => prev.map((v) => (v.id === vm.id ? { ...v, isListened: true } : v)));
      }
    }
  };

  const handleDeleteVoicemail = async (id: string) => {
    if (!confirm('Delete this voice note?')) return;
    try {
      await api.delete(`/api/voip/voicemails/${id}`);
      setVoicemails((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      console.error('[Voicemail] Failed to delete', err);
    }
  };

  // Keypad Number Press
  const handleKeypadPress = (num: string) => {
    if (targetExt.length < 4) {
      setTargetExt((prev) => prev + num);
    }
  };

  // Keypad Backspace
  const handleBackspace = () => {
    setTargetExt((prev) => prev.slice(0, -1));
  };

  // Filter Directory
  const filteredDirectory = directory.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.extension.includes(query) ||
      p.department.toLowerCase().includes(query) ||
      p.rank.toLowerCase().includes(query)
    );
  });

  const isSecurityRole = ['SECURITY_HEAD', 'SECURITY_OFFICER', 'SUPER_USER', 'ADMIN'].includes(user?.role || '');

  return (
    <>
      {/* Hidden Audio Elements */}
      <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />
      <audio
        ref={voicemailAudioPlayerRef}
        onEnded={() => setPlayingVoicemailId(null)}
        style={{ display: 'none' }}
      />

      {/* Floating Incoming Call Toast Banner */}
      {callState === 'INCOMING' && (
        <div className="fixed top-6 right-6 z-[9999] w-96 rounded-3xl bg-slate-900 text-white p-5 shadow-2xl border-2 border-emerald-500/50 animate-bounce backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center animate-pulse border border-emerald-500/50">
              <Phone size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Incoming Extension Call</span>
              <h4 className="text-base font-bold truncate">{peerInfo?.name || 'Internal Caller'}</h4>
              <p className="text-xs text-slate-400 truncate">Ext: <span className="font-extrabold text-white">{peerInfo?.extension}</span> ({peerInfo?.rank})</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleAcceptCall}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
            >
              <Phone size={14} /> Accept
            </button>
            <button
              onClick={handleRejectCall}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
            >
              <PhoneOff size={14} /> Decline
            </button>
          </div>
        </div>
      )}

      {/* Main VoIP Dialer & Intercom Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 relative overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-200">
                  <Phone size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Internal VoIP Intercom</h3>
                  <p className="text-xs text-slate-500">
                    Your 4-Digit Ext: <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">{userExtension || '...'}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-100 mb-4">
              <button
                onClick={() => { setActiveTab('keypad'); setShowVoicemailRecorder(false); }}
                className={`flex-1 py-2 text-xs font-bold transition border-b-2 ${
                  activeTab === 'keypad' ? 'border-emerald-600 text-emerald-700 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Keypad
              </button>
              <button
                onClick={() => { setActiveTab('directory'); setShowVoicemailRecorder(false); }}
                className={`flex-1 py-2 text-xs font-bold transition border-b-2 ${
                  activeTab === 'directory' ? 'border-emerald-600 text-emerald-700 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Staff Directory ({directory.length})
              </button>
              <button
                onClick={() => { setActiveTab('voicemail'); setShowVoicemailRecorder(false); setNewMissedCount(0); }}
                className={`flex-1 py-2 text-xs font-bold transition border-b-2 relative ${
                  activeTab === 'voicemail' ? 'border-emerald-600 text-emerald-700 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Voice Notes
                {voicemails.filter((v) => !v.isListened).length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-black bg-emerald-600 text-white rounded-full">
                    {voicemails.filter((v) => !v.isListened).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setActiveTab('missed'); setShowVoicemailRecorder(false); setNewMissedCount(0); }}
                className={`flex-1 py-2 text-xs font-bold transition border-b-2 relative ${
                  activeTab === 'missed' ? 'border-emerald-600 text-emerald-700 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Missed
                {missedCalls.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-black bg-red-500 text-white rounded-full">
                    {missedCalls.length}
                  </span>
                )}
              </button>
            </div>

            {/* Error / Alert Banner */}
            {callError && (
              <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200 flex items-center justify-between animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                  <span>{callError}</span>
                </div>
                <button onClick={() => setCallError('')} className="text-red-400 hover:text-red-600">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* ─── Active Call View (Ringing / Connected) ─────────────────────────── */}
            {callState !== 'IDLE' && callState !== 'INCOMING' && (
              <div className="my-auto flex flex-col items-center justify-center p-6 text-center space-y-5 animate-in zoom-in-95 duration-200">
                <div className="relative">
                  <div className={`h-24 w-24 rounded-full flex items-center justify-center text-white text-2xl font-black shadow-xl ${
                    callState === 'CONNECTED' ? 'bg-emerald-600' : 'bg-amber-500 animate-pulse'
                  }`}>
                    <Phone size={36} />
                  </div>
                  {callState === 'CONNECTED' && (
                    <span className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-[10px] text-white">
                      ✓
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-lg font-black text-slate-900">{peerInfo?.name || `Ext ${peerInfo?.extension || targetExt}`}</h4>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Extension: <span className="font-extrabold text-emerald-700">{peerInfo?.extension || targetExt}</span>
                  </p>
                  <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider mt-1">
                    {callState === 'INITIATING' && 'Dialing Extension...'}
                    {callState === 'RINGING' && 'Ringing Recipient...'}
                    {callState === 'CONNECTED' && `Call in Progress (${Math.floor(callDuration / 60)}:${(callDuration % 60).toString().padStart(2, '0')})`}
                    {callState === 'REJECTED' && 'Call Unavailable'}
                    {callState === 'ENDED' && 'Call Terminated'}
                  </p>
                </div>

                {/* Call Action Controls */}
                <div className="flex items-center gap-4 pt-2">
                  <button
                    onClick={handleToggleMute}
                    disabled={callState !== 'CONNECTED'}
                    className={`h-12 w-12 rounded-full flex items-center justify-center transition border ${
                      isMuted ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                    }`}
                    title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                  >
                    {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>

                  <button
                    onClick={handleToggleSpeaker}
                    className={`h-12 w-12 rounded-full flex items-center justify-center transition border ${
                      isSpeakerOn ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                    }`}
                    title={isSpeakerOn ? 'Loudspeaker ON' : 'Loudspeaker OFF'}
                  >
                    {isSpeakerOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </button>

                  <button
                    onClick={handleHangup}
                    className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg transition hover:scale-105 active:scale-95"
                    title="End Call"
                  >
                    <PhoneOff size={22} />
                  </button>
                </div>
              </div>
            )}

            {/* ─── Leave Voice Note Option (When Recipient is Unavailable) ───────── */}
            {showVoicemailRecorder && callState === 'IDLE' && (
              <div className="mb-4 p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mic className="text-emerald-700 animate-pulse" size={18} />
                    <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                      Leave a Voice Note for {voicemailTargetName} (Ext: {voicemailTargetExt})
                    </h4>
                  </div>
                  <button onClick={() => setShowVoicemailRecorder(false)} className="text-emerald-600 hover:text-emerald-800">
                    <X size={14} />
                  </button>
                </div>

                {voicemailSentSuccess ? (
                  <div className="py-4 text-center text-emerald-800 font-bold text-xs flex items-center justify-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    <span>Voice Note Sent Successfully!</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600 bg-white p-3 rounded-xl border border-emerald-100">
                      <span>Recording: {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')} / 01:00</span>
                      {isRecordingVoicemail && (
                        <span className="flex items-center gap-1.5 text-red-600 font-bold text-[10px] uppercase tracking-wider">
                          <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" /> Recording Live
                        </span>
                      )}
                    </div>

                    {recordedAudioUrl && (
                      <audio controls src={recordedAudioUrl} className="w-full h-8" />
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      {!isRecordingVoicemail && !recordedAudioBlob && (
                        <button
                          onClick={handleStartVoicemailRecording}
                          style={{ backgroundColor: '#006533' }}
                          className="flex-1 py-2.5 px-4 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 shadow-md hover:opacity-90 transition"
                        >
                          <Mic size={14} /> Start Recording
                        </button>
                      )}

                      {isRecordingVoicemail && (
                        <button
                          onClick={handleStopVoicemailRecording}
                          className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 shadow-md transition"
                        >
                          <Square size={14} /> Stop Recording
                        </button>
                      )}

                      {recordedAudioBlob && !isRecordingVoicemail && (
                        <>
                          <button
                            onClick={handleStartVoicemailRecording}
                            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                          >
                            Re-record
                          </button>
                          <button
                            onClick={handleSendVoicemail}
                            disabled={isSendingVoicemail}
                            style={{ backgroundColor: '#006533' }}
                            className="flex-1 py-2.5 px-4 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 shadow-md hover:opacity-90 transition disabled:opacity-50"
                          >
                            {isSendingVoicemail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            <span>Send Voice Note</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 1: Keypad Dialer View ────────────────────────────────────── */}
            {callState === 'IDLE' && !showVoicemailRecorder && activeTab === 'keypad' && (
              <div className="flex flex-col space-y-4">
                {/* Dial Display */}
                <div className="relative rounded-2xl bg-slate-50 p-4 border border-slate-200 flex items-center justify-between">
                  <input
                    type="text"
                    readOnly
                    placeholder="Enter 4-Digit Ext"
                    value={targetExt}
                    className="w-full bg-transparent text-center text-2xl font-black tracking-widest text-slate-800 outline-none placeholder:text-slate-300"
                  />
                  {targetExt && (
                    <button
                      onClick={handleBackspace}
                      className="absolute right-4 text-slate-400 hover:text-slate-600 transition"
                    >
                      ⌫
                    </button>
                  )}
                </div>

                {/* 3x4 Keypad Grid */}
                <div className="grid grid-cols-3 gap-2.5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
                    <button
                      key={key}
                      onClick={() => handleKeypadPress(key)}
                      className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 text-lg font-black transition flex items-center justify-center shadow-sm"
                    >
                      {key}
                    </button>
                  ))}
                </div>

                {/* Call Initiate Button */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => handleInitiateCall()}
                    disabled={targetExt.length < 3}
                    style={{ backgroundColor: '#006533' }}
                    className="flex-1 py-3 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg hover:opacity-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Phone size={18} />
                    <span>Call Extension</span>
                  </button>

                  <button
                    onClick={() => {
                      if (targetExt) {
                        setVoicemailTargetExt(targetExt);
                        setVoicemailTargetName(`Ext ${targetExt}`);
                        setShowVoicemailRecorder(true);
                      } else {
                        setCallError('Enter an extension to leave a voice note');
                      }
                    }}
                    className="py-3 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 border border-emerald-200 transition"
                    title="Leave a Voice Note"
                  >
                    <Mic size={16} />
                    <span>Voice Note</span>
                  </button>
                </div>
              </div>
            )}

            {/* ─── TAB 2: Directory View ────────────────────────────────────────── */}
            {callState === 'IDLE' && !showVoicemailRecorder && activeTab === 'directory' && (
              <div className="flex flex-col space-y-3 flex-1 min-h-0">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search staff name, cadre, or extension..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-slate-50"
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 max-h-[300px] pr-1">
                  {loadingDirectory ? (
                    <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin text-emerald-600" /> Loading extension directory...
                    </div>
                  ) : filteredDirectory.length === 0 ? (
                    <p className="py-8 text-center text-xs text-slate-400 italic">No staff found matching query.</p>
                  ) : (
                    filteredDirectory.map((st) => {
                      const isOnline = onlineExtensions.has(st.extension);
                      return (
                        <div
                          key={st.id}
                          className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 hover:bg-slate-50 transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative h-9 w-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-black flex-shrink-0">
                              {st.name[0]}
                              {isOnline && (
                                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-800 truncate" title={st.name}>
                                {st.name}
                              </h4>
                              <p className="text-[10px] text-slate-400 truncate">
                                Ext: <span className="font-extrabold text-emerald-700">{st.extension}</span> • {st.department}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => {
                                setTargetExt(st.extension);
                                handleInitiateCall(st.extension);
                              }}
                              className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition"
                              title={`Call Ext ${st.extension}`}
                            >
                              <Phone size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setVoicemailTargetExt(st.extension);
                                setVoicemailTargetName(st.name);
                                setShowVoicemailRecorder(true);
                              }}
                              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                              title={`Send Voice Note to ${st.name}`}
                            >
                              <Mic size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ─── TAB 3: Voicemails & Voice Notes View ─────────────────────────── */}
            {callState === 'IDLE' && !showVoicemailRecorder && activeTab === 'voicemail' && (
              <div className="flex flex-col space-y-3 flex-1 min-h-0">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Received Voice Notes ({voicemails.length})</h4>
                  <button onClick={fetchVoicemails} className="text-xs text-emerald-700 hover:underline font-bold">Refresh</button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[300px] pr-1">
                  {loadingVoicemails ? (
                    <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin text-emerald-600" /> Loading voicemails...
                    </div>
                  ) : voicemails.length === 0 ? (
                    <p className="py-8 text-center text-xs text-slate-400 italic">No voice notes received yet.</p>
                  ) : (
                    voicemails.map((vm) => {
                      const isPlaying = playingVoicemailId === vm.id;
                      const callerName = vm.callerUser?.name || `Ext ${vm.callerExtension}`;
                      return (
                        <div
                          key={vm.id}
                          className={`p-3.5 rounded-2xl border transition ${
                            !vm.isListened ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <button
                                onClick={() => handlePlayVoicemail(vm)}
                                className={`h-8 w-8 rounded-full flex items-center justify-center text-white transition shadow-sm ${
                                  isPlaying ? 'bg-amber-500' : 'bg-emerald-700 hover:bg-emerald-800'
                                }`}
                              >
                                {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                              </button>
                              <div className="min-w-0">
                                <h5 className="text-xs font-black text-slate-800 truncate">{callerName}</h5>
                                <p className="text-[10px] text-slate-400">
                                  Ext {vm.callerExtension} • {new Date(vm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({vm.durationSeconds}s)
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {!vm.isListened && (
                                <span className="h-2 w-2 rounded-full bg-emerald-600" title="New Voice Note" />
                              )}
                              <button
                                onClick={() => {
                                  setTargetExt(vm.callerExtension);
                                  handleInitiateCall(vm.callerExtension);
                                }}
                                className="p-1.5 bg-white text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 text-xs font-bold"
                                title="Call Back"
                              >
                                <Phone size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteVoicemail(vm.id)}
                                className="p-1.5 text-slate-300 hover:text-red-600 rounded-lg transition"
                                title="Delete"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ─── TAB 4: Missed Calls View ─────────────────────────────────────── */}
            {callState === 'IDLE' && !showVoicemailRecorder && activeTab === 'missed' && (
              <div className="flex flex-col space-y-3 flex-1 min-h-0">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Missed Calls Log</h4>
                  {missedCalls.length > 0 && (
                    <button onClick={() => setMissedCalls([])} className="text-xs text-red-600 hover:underline">Clear All</button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 max-h-[300px] pr-1">
                  {missedCalls.length === 0 ? (
                    <p className="py-8 text-center text-xs text-slate-400 italic">No missed calls.</p>
                  ) : (
                    missedCalls.map((mc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-2xl bg-red-50/50 border border-red-100"
                      >
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">{mc.callerName}</h4>
                          <p className="text-[10px] text-slate-500 font-semibold">
                            Ext: <span className="font-extrabold text-red-700">{mc.callerExtension}</span> • {new Date(mc.missedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <button
                          onClick={() => {
                            setTargetExt(mc.callerExtension);
                            handleInitiateCall(mc.callerExtension);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition"
                        >
                          <Phone size={12} /> Call Back
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
