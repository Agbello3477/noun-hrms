"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Video,
  Mic,
  MicOff,
  VideoOff,
  Monitor,
  PhoneOff,
  Minimize2,
  Maximize2,
  X,
  Users,
  Sparkles,
  ShieldCheck,
  Radio,
  UserPlus,
  Clock,
  Settings2,
  Share2,
  Volume2
} from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../hooks/useAuth';
import { MultiPeerMeshManager, RemotePeerState, fetchDynamicIceServers } from '../../lib/webrtc';
import { getImageUrl } from '../../lib/api';

interface VideoConferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  userName: string;
  userEmail?: string;
  title?: string;
  subtitle?: string;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

export default function VideoConferenceModal({
  isOpen,
  onClose,
  roomName,
  userName,
  userEmail,
  title = 'NOUN HRMS Live Video Meeting',
  subtitle = 'WebRTC Encrypted Multi-Party Mesh Stream'
}: VideoConferenceModalProps) {
  const { user } = useAuth();
  const { socket: ioSocket } = useSocket();

  const [isMinimized, setIsMinimized] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [mode, setMode] = useState<'mesh' | 'bridge'>('bridge');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Late-join notification toasts
  const [lateJoinToast, setLateJoinToast] = useState<string | null>(null);

  // Mesh RTC state
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<RemotePeerState[]>([]);
  const meshManagerRef = useRef<MultiPeerMeshManager | null>(null);

  // Jitsi Bridge Fallback state
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<any>(null);
  const [isJitsiLoaded, setIsJitsiLoaded] = useState(false);
  const [useDirectIframe, setUseDirectIframe] = useState(false);

  // Timer
  useEffect(() => {
    if (!isOpen) {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Socket Late-Join & Peer Event Listeners ─────────────────────────────────
  useEffect(() => {
    if (!isOpen || !ioSocket) return;

    const handlePeerJoined = (data: { roomId: string; participant: any; isLateJoin?: boolean }) => {
      if (data.roomId === roomName && data.participant) {
        setLateJoinToast(`${data.participant.userName} joined the meeting`);
        setTimeout(() => setLateJoinToast(null), 4000);

        // Add to mesh manager if in mesh mode
        if (meshManagerRef.current && data.participant.userId !== user?.id) {
          meshManagerRef.current.addPeer(data.participant, true);
        }
      }
    };

    const handlePeerLeft = (data: { roomId: string; userId: string; userName: string }) => {
      if (data.roomId === roomName) {
        setLateJoinToast(`${data.userName || 'A participant'} left the meeting`);
        setTimeout(() => setLateJoinToast(null), 3000);

        if (meshManagerRef.current) {
          meshManagerRef.current.removePeer(data.userId);
          setPeers(meshManagerRef.current.getPeers());
        }
      }
    };

    const handleRoomTerminated = (data: { roomId: string; reason?: string }) => {
      if (data.roomId === roomName) {
        handleHangup();
      }
    };

    ioSocket.on('PEER_JOINED_ROOM', handlePeerJoined);
    ioSocket.on('PEER_LEFT_ROOM', handlePeerLeft);
    ioSocket.on('ROOM_TERMINATED', handleRoomTerminated);

    return () => {
      ioSocket.off('PEER_JOINED_ROOM', handlePeerJoined);
      ioSocket.off('PEER_LEFT_ROOM', handlePeerLeft);
      ioSocket.off('ROOM_TERMINATED', handleRoomTerminated);
    };
  }, [isOpen, ioSocket, roomName, user?.id]);

  // ─── Jitsi Bridge Mode Initialization ────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || mode !== 'bridge') return;

    const sanitizeRoomName = `noun-hrms-${roomName.replace(/[^a-zA-Z0-9-_]/g, '')}`;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const initJitsi = () => {
      if (!jitsiContainerRef.current || jitsiApiRef.current) return;

      try {
        const domain = 'jitsi.riot.im';
        const options = {
          roomName: sanitizeRoomName,
          width: '100%',
          height: '100%',
          parentNode: jitsiContainerRef.current,
          userInfo: {
            displayName: userName || 'NOUN Staff',
            email: userEmail || ''
          },
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            enableWelcomePage: false,
            enableClosePage: false,
            toolbarButtons: [
              'microphone',
              'camera',
              'desktop',
              'fullscreen',
              'hangup',
              'chat',
              'raisehand',
              'tileview',
              'settings'
            ]
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            DEFAULT_BACKGROUND: '#006533',
            TOOLBAR_ALWAYS_VISIBLE: true
          }
        };

        const api = new window.JitsiMeetExternalAPI(domain, options);
        jitsiApiRef.current = api;
        setIsJitsiLoaded(true);

        api.addEventListeners({
          readyToClose: () => {
            handleHangup();
          },
          audioMuteStatusChanged: (data: { muted: boolean }) => {
            setIsAudioMuted(data.muted);
          },
          videoMuteStatusChanged: (data: { muted: boolean }) => {
            setIsVideoMuted(data.muted);
          }
        });
      } catch (err) {
        console.warn('[VideoConference] Jitsi API init error, falling back to direct stream:', err);
        setUseDirectIframe(true);
        setIsJitsiLoaded(true);
      }
    };

    fallbackTimer = setTimeout(() => {
      if (!jitsiApiRef.current) {
        setUseDirectIframe(true);
        setIsJitsiLoaded(true);
      }
    }, 2500);

    const existingScript = document.getElementById('jitsi-external-api-script');
    if (!window.JitsiMeetExternalAPI && !existingScript) {
      const script = document.createElement('script');
      script.id = 'jitsi-external-api-script';
      script.src = 'https://jitsi.riot.im/external_api.js';
      script.async = true;
      script.onload = () => initJitsi();
      script.onerror = () => {
        setUseDirectIframe(true);
        setIsJitsiLoaded(true);
      };
      document.head.appendChild(script);
    } else if (window.JitsiMeetExternalAPI) {
      initJitsi();
    }

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (jitsiApiRef.current) {
        try {
          jitsiApiRef.current.dispose();
        } catch (e) {}
        jitsiApiRef.current = null;
      }
    };
  }, [isOpen, mode, roomName, userName, userEmail]);

  const handleHangup = () => {
    if (jitsiApiRef.current) {
      try {
        jitsiApiRef.current.executeCommand('hangup');
        jitsiApiRef.current.dispose();
      } catch (e) {}
      jitsiApiRef.current = null;
    }

    if (meshManagerRef.current) {
      meshManagerRef.current.cleanup();
      meshManagerRef.current = null;
    }

    setIsJitsiLoaded(false);
    setIsMinimized(false);
    setPeers([]);
    setLocalStream(null);
    onClose();
  };

  const toggleAudio = () => {
    const next = !isAudioMuted;
    setIsAudioMuted(next);
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('toggleAudio');
    }
    if (meshManagerRef.current) {
      meshManagerRef.current.setAudioMuted(next);
    }
  };

  const toggleVideo = () => {
    const next = !isVideoMuted;
    setIsVideoMuted(next);
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('toggleVideo');
    }
    if (meshManagerRef.current) {
      meshManagerRef.current.setVideoMuted(next);
    }
  };

  const toggleShareScreen = async () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('toggleShareScreen');
      setIsScreenSharing(!isScreenSharing);
    } else if (meshManagerRef.current) {
      if (!isScreenSharing) {
        const stream = await meshManagerRef.current.startScreenShare();
        if (stream) setIsScreenSharing(true);
      } else {
        meshManagerRef.current.stopScreenShare();
        setIsScreenSharing(false);
      }
    }
  };

  if (!isOpen) return null;

  const totalParticipantCount = peers.length + 1;

  // Grid column calculation for Native Multi-Tile Grid
  const getGridColsClass = (count: number) => {
    if (count <= 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-1 md:grid-cols-2';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 6) return 'grid-cols-2 md:grid-cols-3';
    return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  };

  return (
    <div
      className={`fixed z-[9999] transition-all duration-300 ${
        isMinimized
          ? 'bottom-6 right-6 w-96 h-64 rounded-2xl shadow-2xl border-2 border-emerald-500 bg-gray-900 overflow-hidden'
          : 'inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 md:p-6'
      }`}
    >
      <div
        className={`flex flex-col bg-gray-950 rounded-2xl overflow-hidden shadow-2xl border border-gray-800 w-full ${
          isMinimized ? 'h-full' : 'h-[94vh] max-w-7xl'
        }`}
      >
        {/* Window Header Bar */}
        <div className="bg-emerald-950/90 text-white px-4 py-3 border-b border-emerald-800/60 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-emerald-700/80 rounded-xl border border-emerald-500/50 shrink-0">
              <Video size={18} className="text-white animate-pulse" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate flex items-center gap-2">
                {title}
                <span className="bg-emerald-800 text-emerald-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-600/50 flex items-center gap-1">
                  <ShieldCheck size={11} />
                  Encrypted WebRTC
                </span>
                <span className="font-mono text-xs bg-slate-900/80 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/40">
                  ⏱️ {formatTimer(elapsedSeconds)}
                </span>
              </h3>
              <p className="text-[11px] text-emerald-300/80 truncate">
                {subtitle} • Room: <strong className="text-white font-mono">{roomName}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowRoster(!showRoster)}
              className={`p-1.5 rounded-lg transition flex items-center gap-1 text-xs font-bold ${
                showRoster ? 'bg-emerald-600 text-white' : 'hover:bg-white/10 text-emerald-200 hover:text-white'
              }`}
              title="Toggle Participants"
            >
              <Users size={16} />
              <span className="hidden sm:inline">{totalParticipantCount}</span>
            </button>

            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 hover:bg-white/10 text-emerald-200 hover:text-white rounded-lg transition"
              title={isMinimized ? 'Expand Window' : 'Minimize to Floating Overlay'}
            >
              {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>

            <button
              onClick={handleHangup}
              className="p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition"
              title="Leave Meeting & Release Hardware"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Main Video Canvas Area */}
        <div className="relative flex-1 bg-black overflow-hidden flex">
          {/* Late Join Toast Notification */}
          {lateJoinToast && (
            <div className="absolute top-4 right-4 z-30 bg-emerald-950/90 border border-emerald-500/80 text-emerald-200 px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in slide-in-from-top-4 duration-300">
              <UserPlus size={15} className="text-emerald-400" />
              <span>{lateJoinToast}</span>
            </div>
          )}

          {/* Video Stream Container */}
          <div className="flex-1 relative h-full w-full bg-black overflow-hidden">
            {!isJitsiLoaded && mode === 'bridge' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 text-white z-10 space-y-4">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-semibold text-emerald-400">
                  Connecting to Secure WebRTC Video Stream...
                </p>
              </div>
            )}

            {mode === 'bridge' ? (
              useDirectIframe ? (
                <iframe
                  src={`https://jitsi.riot.im/noun-hrms-${roomName.replace(
                    /[^a-zA-Z0-9-_]/g,
                    ''
                  )}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&userInfo.displayName=${encodeURIComponent(
                    userName || 'NOUN User'
                  )}`}
                  allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
                  className="w-full h-full border-0"
                  onLoad={() => setIsJitsiLoaded(true)}
                />
              ) : (
                <div ref={jitsiContainerRef} className="w-full h-full" />
              )
            ) : (
              /* Native Responsive Multi-Tile Mesh Grid */
              <div className={`w-full h-full p-3 grid gap-3 ${getGridColsClass(totalParticipantCount)}`}>
                {/* Local User Tile */}
                <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-emerald-500/30 flex items-center justify-center shadow-lg group">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {isVideoMuted && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-white">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-700 to-teal-500 flex items-center justify-center font-bold text-2xl border-2 border-emerald-400 shadow-md">
                        {userName ? userName.slice(0, 2).toUpperCase() : 'ME'}
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-bold text-white flex items-center gap-2">
                    <span>{userName} (You)</span>
                    <span className="bg-emerald-600 text-[10px] px-1.5 py-0.5 rounded uppercase">
                      HOST
                    </span>
                  </div>
                </div>

                {/* Remote Peers Tiles */}
                {peers.map((p) => (
                  <div
                    key={p.userId}
                    className={`relative bg-slate-900 rounded-2xl overflow-hidden border transition-all shadow-lg ${
                      p.isSpeaking
                        ? 'border-emerald-400 ring-4 ring-emerald-500/40'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-white">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-teal-700 to-emerald-600 flex items-center justify-center font-bold text-2xl border-2 border-emerald-400 shadow-md">
                        {p.userName ? p.userName.slice(0, 2).toUpperCase() : 'U'}
                      </div>
                    </div>
                    <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-bold text-white flex items-center gap-2">
                      <span>{p.userName}</span>
                      <span className="bg-slate-700 text-[10px] px-1.5 py-0.5 rounded uppercase">
                        {p.userRole || 'Participant'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Participant Roster Drawer */}
          {showRoster && (
            <div className="w-64 bg-slate-950 border-l border-gray-800 p-4 flex flex-col shrink-0 text-white animate-in slide-in-from-right-10 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Users size={14} /> Participants ({totalParticipantCount})
                </h4>
                <button
                  onClick={() => setShowRoster(false)}
                  className="p-1 hover:bg-white/10 rounded text-slate-400"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-2">
                <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/40 border border-emerald-700/40 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-bold">
                      {userName ? userName.charAt(0).toUpperCase() : 'Y'}
                    </div>
                    <span className="truncate font-semibold text-white">{userName} (You)</span>
                  </div>
                  <span className="text-[10px] bg-emerald-800 text-emerald-200 px-1.5 py-0.5 rounded font-bold">
                    HOST
                  </span>
                </div>

                {peers.map((p) => (
                  <div
                    key={p.userId}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-teal-700 flex items-center justify-center text-[10px] font-bold">
                        {p.userName ? p.userName.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <span className="truncate font-medium text-slate-200">{p.userName}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {p.userRole || 'Member'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Floating Controls Bar */}
        <div className="bg-gray-950 px-4 py-2.5 border-t border-gray-800 flex items-center justify-center gap-3 shrink-0">
          <button
            onClick={toggleAudio}
            className={`p-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
              isAudioMuted ? 'bg-red-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-white'
            }`}
            title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isAudioMuted ? <MicOff size={16} /> : <Mic size={16} />}
            <span className="hidden sm:inline">{isAudioMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button
            onClick={toggleVideo}
            className={`p-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
              isVideoMuted ? 'bg-red-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-white'
            }`}
            title={isVideoMuted ? 'Turn On Camera' : 'Turn Off Camera'}
          >
            {isVideoMuted ? <VideoOff size={16} /> : <Video size={16} />}
            <span className="hidden sm:inline">{isVideoMuted ? 'Start Video' : 'Stop Video'}</span>
          </button>

          <button
            onClick={toggleShareScreen}
            className={`p-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
              isScreenSharing
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-800 hover:bg-gray-700 text-white'
            }`}
            title="Share Screen"
          >
            <Monitor size={16} />
            <span className="hidden sm:inline">
              {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
            </span>
          </button>

          <button
            onClick={handleHangup}
            className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-md shadow-red-900/50"
            title="Leave Meeting & Release Hardware"
          >
            <PhoneOff size={16} />
            <span>Leave Call</span>
          </button>
        </div>
      </div>
    </div>
  );
}
