'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api, { getSocketUrl } from '../../lib/api';
import { VoipPeerManager, stopMediaStreamTracks } from '../../lib/webrtc';
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Search, 
  Users, Shield, Heart, Clock, X, UserCheck, AlertCircle, Radio, Loader2
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

export default function VoipCallModal({ isOpen, onClose, onOpen, initialExtension, onMissedCallCountChange }: VoipCallModalProps) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  // VoIP Extension States
  const [userExtension, setUserExtension] = useState<string>('');
  const [targetExt, setTargetExt] = useState<string>('');
  const [directory, setDirectory] = useState<VoipUser[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingDirectory, setLoadingDirectory] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'keypad' | 'directory' | 'ptt' | 'missed'>('keypad');
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

  // Missed Call State
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);
  const [newMissedCount, setNewMissedCount] = useState<number>(0);

  // References
  const peerManagerRef = useRef<VoipPeerManager | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const incomingOfferSdpRef = useRef<any>(null);
  // Always-current extension ref for use inside socket connect callbacks
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

  // Initialize Socket.io connection for VoIP Signaling using production-safe getSocketUrl()
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('token');
    const socketUrl = getSocketUrl();
    console.log('[VoIP UI] Connecting to signaling server:', socketUrl);
    
    const socketInstance = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    // Re-register extension on every connect/reconnect
    socketInstance.on('connect', () => {
      console.log('[VoIP UI] Signaling socket connected');
      if (myExtensionRef.current) {
        socketInstance.emit('VOIP_REGISTER_EXTENSION', { extension: myExtensionRef.current });
        console.log(`[VoIP UI] Registered extension ${myExtensionRef.current} on connect`);
      }
      // Query online extensions
      socketInstance.emit('VOIP_GET_ONLINE_EXTENSIONS', (exts: string[]) => {
        if (Array.isArray(exts)) {
          setOnlineExtensions(new Set(exts));
        }
      });
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

      // If user extension not yet set, check directory
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

  useEffect(() => {
    if (user) {
      fetchMyExtension();
      fetchDirectory();
    }
  }, [user, fetchMyExtension, fetchDirectory]);

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
      setTimeout(() => {
        setCallState('IDLE');
        setCallError('');
      }, 3000);
    });

    // Call Unavailable (User is Offline / Not Registered)
    socket.on('CALL_UNAVAILABLE', (data: { targetExtension: string; reason?: string; message?: string }) => {
      console.log('[VoIP UI] Target unavailable:', data);
      setCallError(data.message || `Extension ${data.targetExtension} is currently offline and unavailable.`);
      setCallState('REJECTED');
      cleanupCallHardware();
      setTimeout(() => {
        setCallState('IDLE');
        setCallError('');
      }, 4000);
    });

    // Call Failed
    socket.on('CALL_FAILED', (data: { reason?: string }) => {
      setCallError(data.reason || 'Call failed.');
      setCallState('REJECTED');
      cleanupCallHardware();
      setTimeout(() => {
        setCallState('IDLE');
        setCallError('');
      }, 4000);
    });

    // Real-time Extension Online/Offline Event
    socket.on('VOIP_EXTENSION_STATUS_CHANGED', (data: { extension: string; isOnline: boolean }) => {
      setOnlineExtensions(prev => {
        const next = new Set(prev);
        if (data.isOnline) next.add(data.extension);
        else next.delete(data.extension);
        return next;
      });
    });

    // Call Timeout
    socket.on('CALL_TIMEOUT', () => {
      setCallError('No answer after 10 seconds.');
      setCallState('ENDED');
      cleanupCallHardware();
      setTimeout(() => {
        setCallState('IDLE');
        setCallError('');
      }, 3000);
    });

    // Call Ended
    socket.on('CALL_ENDED', () => {
      setCallState('ENDED');
      cleanupCallHardware();
      setTimeout(() => {
        setCallState('IDLE');
      }, 2000);
    });

    // ICE Candidate
    socket.on('ICE_CANDIDATE', async (data: { candidate: any }) => {
      if (peerManagerRef.current && data.candidate) {
        await peerManagerRef.current.addIceCandidate(data.candidate);
      }
    });

    // Security PTT Signals
    socket.on('SECURITY_PTT_TALK_START', (data: { speakerName: string }) => {
      setActivePttSpeaker(data.speakerName);
    });

    socket.on('SECURITY_PTT_TALK_STOP', () => {
      setActivePttSpeaker(null);
    });

    // Missed Call — fires when an incoming call was not answered before 10s timeout
    socket.on('CALL_MISSED', (data: { callId: string; callerExtension: string; callerName: string; callerRank: string; missedAt: string }) => {
      const missed: MissedCall = {
        callId: data.callId,
        callerExtension: data.callerExtension,
        callerName: data.callerName,
        callerRank: data.callerRank,
        missedAt: data.missedAt
      };
      setMissedCalls(prev => [missed, ...prev]);
      setNewMissedCount(prev => prev + 1);

      // Trigger browser desktop notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`📞 Missed Call — Ext ${data.callerExtension}`, {
          body: `${data.callerName} (${data.callerRank}) tried to reach you`,
          icon: '/noun_logo.png',
          tag: `voip-missed-${data.callId}`
        });
      }
    });

    return () => {
      socket.off('INCOMING_CALL');
      socket.off('CALL_RINGING');
      socket.off('CALL_ACCEPTED');
      socket.off('CALL_REJECTED');
      socket.off('CALL_UNAVAILABLE');
      socket.off('CALL_FAILED');
      socket.off('VOIP_EXTENSION_STATUS_CHANGED');
      socket.off('CALL_TIMEOUT');
      socket.off('CALL_ENDED');
      socket.off('ICE_CANDIDATE');
      socket.off('SECURITY_PTT_TALK_START');
      socket.off('SECURITY_PTT_TALK_STOP');
      socket.off('CALL_MISSED');
    };
  }, [socket]);

  // Clean hardware streams
  const cleanupCallHardware = () => {
    if (peerManagerRef.current) {
      peerManagerRef.current.cleanup();
      peerManagerRef.current = null;
    }
  };

  // Dial Extension (Initiate Call)
  const handleInitiateCall = async (extensionToDial?: string) => {
    const ext = extensionToDial || targetExt;
    if (!ext || ext.length < 3) {
      setCallError('Please enter a valid 4-digit extension');
      return;
    }

    if (!socket) {
      setCallError('Signaling socket disconnected');
      return;
    }

    setCallError('');
    setCallState('INITIATING');

    try {
      // Lookup target profile
      const { data: targetProfile } = await api.get(`/api/voip/lookup/${ext}`);
      setPeerInfo({
        name: targetProfile.name,
        rank: targetProfile.rank,
        extension: targetProfile.extension,
        department: targetProfile.department
      });

      // Get ICE Servers
      const iceRes = await api.get('/api/voip/ice-servers');
      const iceServers = iceRes.data.iceServers || [];

      // Initialize WebRTC Peer Manager with Loudspeaker by default
      peerManagerRef.current = new VoipPeerManager(
        iceServers,
        (candidate) => {
          socket.emit('ICE_CANDIDATE', { targetExtension: ext, candidate, callId: currentCallId });
        },
        (remoteStream) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.volume = isSpeakerOn ? 1.0 : 0.4;
            remoteAudioRef.current.play().catch(console.error);
          }
        }
      );

      const offerSdp = await peerManagerRef.current.createOffer();

      socket.emit('CALL_INITIATE', {
        targetExtension: ext,
        sdpOffer: offerSdp,
        callerName: user?.name,
        callerRank: user?.staffProfile?.rank || 'Staff'
      });
    } catch (err: any) {
      setCallError(err.response?.data?.message || 'Failed to initiate extension call');
      setCallState('IDLE');
      cleanupCallHardware();
    }
  };

  // Accept Incoming Call
  const handleAcceptCall = async () => {
    if (!currentCallId || !socket || !incomingOfferSdpRef.current) return;

    // Automatically open full modal dialer interface for callee
    onOpen?.();

    try {
      const iceRes = await api.get('/api/voip/ice-servers');
      const iceServers = iceRes.data.iceServers || [];

      peerManagerRef.current = new VoipPeerManager(
        iceServers,
        (candidate) => {
          if (peerInfo) {
            socket.emit('ICE_CANDIDATE', { targetExtension: peerInfo.extension, candidate, callId: currentCallId });
          }
        },
        (remoteStream) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.volume = isSpeakerOn ? 1.0 : 0.4;
            remoteAudioRef.current.play().catch(console.error);
          }
        }
      );

      const answerSdp = await peerManagerRef.current.handleOfferAndCreateAnswer(incomingOfferSdpRef.current);

      socket.emit('CALL_ACCEPTED', {
        callId: currentCallId,
        sdpAnswer: answerSdp
      });

      setCallState('CONNECTED');
    } catch (err) {
      console.error('[VoIP UI] Error accepting call:', err);
      handleHangUp();
    }
  };

  // Decline / Reject Incoming Call
  const handleRejectCall = () => {
    if (currentCallId && socket) {
      socket.emit('CALL_REJECTED', { callId: currentCallId });
    }
    setCallState('IDLE');
    cleanupCallHardware();
  };

  // Hang-up Call
  const handleHangUp = () => {
    if (currentCallId && socket) {
      socket.emit('CALL_ENDED', { callId: currentCallId });
    }
    setCallState('IDLE');
    cleanupCallHardware();
  };

  // Toggle Mute
  const handleToggleMute = () => {
    if (peerManagerRef.current) {
      const nextMuted = !isMuted;
      peerManagerRef.current.setMicrophoneMuted(nextMuted);
      setIsMuted(nextMuted);
    }
  };

  // Format Duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
      {/* Hidden Audio Element for Remote Voice Output */}
      <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

      {/* Floating Incoming Call Toast Banner */}
      {callState === 'INCOMING' && (
        <div className="fixed top-6 right-6 z-50 w-96 rounded-2xl bg-slate-900 text-white p-5 shadow-2xl border border-emerald-500/30 animate-bounce">
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
                <div className="p-2.5 bg-slate-100 text-slate-800 rounded-2xl border border-slate-200 shadow-sm">
                  <Phone size={20} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Internal VoIP Intercom</h3>
                  <p className="text-xs text-slate-500 font-medium">Your Extension: <span className="font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">{userExtension || '1001'}</span></p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error / Status Alert */}
            {callError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
                <AlertCircle size={16} className="text-red-500 shrink-0" />
                <span>{callError}</span>
              </div>
            )}

            {/* SCREEN 1: Active Call View */}
            {callState !== 'IDLE' ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 px-4 text-center bg-slate-900 text-white rounded-2xl shadow-inner relative">
                <div className="h-20 w-20 rounded-full bg-slate-800 border-2 border-emerald-500/50 flex items-center justify-center mb-4 shadow-xl relative">
                  <span className="text-2xl font-black text-white">{peerInfo?.name ? peerInfo.name.charAt(0) : 'E'}</span>
                  {callState === 'CONNECTED' && (
                    <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-emerald-500 border-2 border-slate-900 animate-pulse" />
                  )}
                </div>

                <h3 className="text-xl font-bold">{peerInfo?.name || 'Extension User'}</h3>
                <p className="text-xs text-slate-400 mt-1 font-medium">Ext: <span className="text-emerald-400 font-extrabold">{peerInfo?.extension}</span> {peerInfo?.rank && `(${peerInfo.rank})`}</p>

                {/* Call Status Badge */}
                <div className="mt-4">
                  {callState === 'INITIATING' && (
                    <span className="text-xs text-amber-400 font-bold bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20 animate-pulse flex items-center gap-1.5 justify-center">
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" /> Checking Availability & Dialing...
                    </span>
                  )}
                  {callState === 'RINGING' && (
                    <span className="text-xs text-blue-400 font-bold bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20 animate-pulse flex items-center gap-1.5 justify-center">
                      <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping" /> Ringing Target Extension...
                    </span>
                  )}
                  {callState === 'CONNECTED' && (
                    <span className="text-sm font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 flex items-center gap-1.5 justify-center">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> {formatDuration(callDuration)} • Loudspeaker Active
                    </span>
                  )}
                  {callState === 'REJECTED' && (
                    <span className="text-xs text-red-400 font-bold bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20 flex items-center gap-1.5 justify-center">
                      <AlertCircle size={13} /> {callError || 'User Unavailable / Offline'}
                    </span>
                  )}
                  {callState === 'ENDED' && <span className="text-xs text-slate-400 font-bold">Call Ended</span>}
                </div>

                {/* Call Action Controls */}
                <div className="mt-8 flex items-center gap-6">
                  {callState === 'CONNECTED' && (
                    <>
                      <button
                        onClick={handleToggleMute}
                        className={`p-4 rounded-full border transition ${isMuted ? 'bg-red-600 text-white border-red-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                        title={isMuted ? 'Unmute' : 'Mute'}
                      >
                        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                      </button>
                      <button
                        onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                        className={`p-4 rounded-full border transition ${isSpeakerOn ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                        title="Speaker Mode"
                      >
                        {isSpeakerOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
                      </button>
                    </>
                  )}

                  <button
                    onClick={handleHangUp}
                    className="p-4 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg transition hover:scale-105"
                    title="Hang Up"
                  >
                    <PhoneOff size={24} />
                  </button>
                </div>
              </div>
            ) : (
              /* SCREEN 2: Tabs (Keypad / Directory / Security PTT) */
              <div className="flex-1 flex flex-col min-h-0">
                
                {/* Navigation Tabs */}
                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl mb-4 text-xs font-bold">
                  <button
                    onClick={() => setActiveTab('keypad')}
                    className={`flex-1 py-2 rounded-lg transition ${activeTab === 'keypad' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Keypad Dialer
                  </button>
                  <button
                    onClick={() => setActiveTab('directory')}
                    className={`flex-1 py-2 rounded-lg transition ${activeTab === 'directory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Directory ({directory.length})
                  </button>
                  {isSecurityRole && (
                    <button
                      onClick={() => setActiveTab('ptt')}
                      className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${activeTab === 'ptt' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      <Radio size={14} className="text-red-500" /> Security PTT
                    </button>
                  )}
                  <button
                    onClick={() => { setActiveTab('missed'); setNewMissedCount(0); }}
                    className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 relative ${activeTab === 'missed' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Missed
                    {newMissedCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center ring-1 ring-white">
                        {newMissedCount > 9 ? '9+' : newMissedCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* TAB 1: Keypad Dialer */}
                {activeTab === 'keypad' && (
                  <div className="flex-1 flex flex-col items-center justify-between">
                    {/* Extension Display Box */}
                    <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center mb-4">
                      <input
                        type="text"
                        value={targetExt}
                        onChange={(e) => setTargetExt(e.target.value)}
                        placeholder="Enter 4-Digit Ext (e.g. 1002)"
                        className="w-full text-center text-2xl font-black tracking-widest text-slate-900 bg-transparent outline-none"
                        maxLength={6}
                      />
                    </div>

                    {/* Numeric Keypad Grid */}
                    <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-6">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                        <button
                          key={digit}
                          onClick={() => setTargetExt((prev) => prev + digit)}
                          className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-lg shadow-sm transition active:scale-95 flex items-center justify-center"
                        >
                          {digit}
                        </button>
                      ))}
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-4 w-full">
                      <button
                        onClick={() => setTargetExt((prev) => prev.slice(0, -1))}
                        className="py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition"
                      >
                        Backspace
                      </button>
                      <button
                        onClick={() => handleInitiateCall()}
                        disabled={!targetExt}
                        className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-50"
                      >
                        <Phone size={18} /> Call Extension
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 2: Directory Search */}
                {activeTab === 'directory' && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="relative mb-3">
                      <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name, extension, or department..."
                        className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                      {loadingDirectory ? (
                        <div className="text-center py-8 text-slate-400 flex items-center justify-center gap-2 text-xs">
                          <Loader2 size={16} className="animate-spin" /> Loading extension directory...
                        </div>
                      ) : filteredDirectory.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-xs font-medium">
                          No matching extension found.
                        </div>
                      ) : (
                        filteredDirectory.map((staff) => {
                          const isOnline = onlineExtensions.has(staff.extension);
                          return (
                            <div
                              key={staff.id}
                              className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-400 animate-pulse' : 'bg-slate-300'}`} />
                                  <h4 className="text-xs font-bold text-slate-900 truncate">{staff.name}</h4>
                                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                    {isOnline ? 'Available' : 'Offline'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 truncate mt-0.5 ml-4">{staff.rank} • {staff.department}</p>
                              </div>
                              <button
                                onClick={() => handleInitiateCall(staff.extension)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shrink-0 ${isOnline ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm' : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200'}`}
                              >
                                <Phone size={12} /> Ext {staff.extension}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: Security Push-To-Talk (PTT) */}
                {activeTab === 'ptt' && (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-red-950 text-white rounded-2xl relative">
                    <Radio size={36} className="text-red-500 mb-3 animate-pulse" />
                    <h3 className="text-base font-bold">Security Command Center Walkie-Talkie</h3>
                    <p className="text-xs text-red-300 mt-1 max-w-xs leading-relaxed">
                      Instant Push-to-Talk (PTT) dispatch channel for security officers and headquarters command.
                    </p>

                    {activePttSpeaker && (
                      <div className="mt-4 p-2 bg-red-900/80 border border-red-500/50 rounded-xl text-xs font-bold text-red-200">
                        🎙️ Speaking: {activePttSpeaker}
                      </div>
                    )}

                    <button
                      onMouseDown={() => {
                        setIsPttTalking(true);
                        socket?.emit('SECURITY_PTT_TALK_START', { channelId: 'MAIN_DISPATCH' });
                      }}
                      onMouseUp={() => {
                        setIsPttTalking(false);
                        socket?.emit('SECURITY_PTT_TALK_STOP', { channelId: 'MAIN_DISPATCH' });
                      }}
                      onTouchStart={() => {
                        setIsPttTalking(true);
                        socket?.emit('SECURITY_PTT_TALK_START', { channelId: 'MAIN_DISPATCH' });
                      }}
                      onTouchEnd={() => {
                        setIsPttTalking(false);
                        socket?.emit('SECURITY_PTT_TALK_STOP', { channelId: 'MAIN_DISPATCH' });
                      }}
                      className={`mt-6 h-28 w-28 rounded-full font-black text-xs uppercase tracking-wider flex items-center justify-center border-4 transition-transform ${
                        isPttTalking
                          ? 'bg-red-600 text-white border-white scale-105 shadow-2xl shadow-red-500'
                          : 'bg-red-900/60 text-red-200 border-red-700 hover:bg-red-800'
                      }`}
                    >
                      {isPttTalking ? 'TRANSMITTING...' : 'HOLD TO TALK'}
                    </button>
                  </div>
                )}

                {/* TAB 4: Missed Calls Log */}
                {activeTab === 'missed' && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Missed Calls</h4>
                      {missedCalls.length > 0 && (
                        <button
                          onClick={() => setMissedCalls([])}
                          className="text-[10px] text-slate-400 hover:text-red-500 font-medium transition"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {missedCalls.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                          <PhoneOff size={32} className="mb-3 text-slate-300" />
                          <p className="text-xs font-medium">No missed calls</p>
                        </div>
                      ) : (
                        missedCalls.map((mc) => (
                          <div key={mc.callId} className="flex items-center justify-between p-3 rounded-xl border border-red-100 bg-red-50/50">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
                                <PhoneOff size={14} className="text-red-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">{mc.callerName}</p>
                                <p className="text-[10px] text-slate-500">Ext: <span className="font-extrabold text-slate-700">{mc.callerExtension}</span> · {mc.callerRank}</p>
                                <p className="text-[9px] text-red-400 font-medium mt-0.5">
                                  {new Date(mc.missedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleInitiateCall(mc.callerExtension)}
                              className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition shrink-0"
                            >
                              <Phone size={11} /> Call Back
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
