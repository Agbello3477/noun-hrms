"use client";

import { useEffect, useRef, useState } from 'react';
import { Video, Mic, MicOff, VideoOff, Monitor, PhoneOff, Minimize2, Maximize2, X, ShieldAlert, Sparkles } from 'lucide-react';

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
    subtitle = 'WebRTC Encrypted Peer-to-Peer Stream'
}: VideoConferenceModalProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const apiRef = useRef<any>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isVideoMuted, setIsVideoMuted] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            if (apiRef.current) {
                try {
                    apiRef.current.dispose();
                } catch (e) {
                    console.error('Error disposing Jitsi API:', e);
                }
                apiRef.current = null;
            }
            setIsLoaded(false);
            return;
        }

        const sanitizeRoomName = `noun-hrms-${roomName.replace(/[^a-zA-Z0-9-_]/g, '')}`;

        const initJitsi = () => {
            if (!containerRef.current || apiRef.current) return;

            try {
                const domain = 'meet.jit.si';
                const options = {
                    roomName: sanitizeRoomName,
                    width: '100%',
                    height: '100%',
                    parentNode: containerRef.current,
                    userInfo: {
                        displayName: userName || 'NOUN User',
                        email: userEmail || ''
                    },
                    configOverwrite: {
                        startWithAudioMuted: false,
                        startWithVideoMuted: false,
                        prejoinPageEnabled: false,
                        disableDeepLinking: true,
                        toolbarButtons: [
                            'microphone', 'camera', 'desktop', 'fullscreen',
                            'f省', 'hangup', 'chat', 'raisehand', 'tileview'
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
                apiRef.current = api;
                setIsLoaded(true);

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
                console.error('Failed to initialize Jitsi Meet API:', err);
            }
        };

        // Load Jitsi script if not present
        if (!window.JitsiMeetExternalAPI) {
            const script = document.createElement('script');
            script.src = 'https://meet.jit.si/external_api.js';
            script.async = true;
            script.onload = () => initJitsi();
            document.body.appendChild(script);
        } else {
            initJitsi();
        }

        return () => {
            if (apiRef.current) {
                try {
                    apiRef.current.dispose();
                } catch (e) {
                    console.error('Cleanup error:', e);
                }
                apiRef.current = null;
            }
        };
    }, [isOpen, roomName, userName, userEmail]);

    const handleHangup = () => {
        if (apiRef.current) {
            try {
                apiRef.current.executeCommand('hangup');
                apiRef.current.dispose();
            } catch (e) {}
            apiRef.current = null;
        }
        setIsLoaded(false);
        setIsMinimized(false);
        onClose();
    };

    const toggleAudio = () => {
        if (apiRef.current) {
            apiRef.current.executeCommand('toggleAudio');
        }
    };

    const toggleVideo = () => {
        if (apiRef.current) {
            apiRef.current.executeCommand('toggleVideo');
        }
    };

    const toggleShareScreen = () => {
        if (apiRef.current) {
            apiRef.current.executeCommand('toggleShareScreen');
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className={`fixed z-[9999] transition-all duration-300 ${
                isMinimized
                    ? 'bottom-6 right-6 w-96 h-64 rounded-2xl shadow-2xl border-2 border-emerald-500 bg-gray-900 overflow-hidden'
                    : 'inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 md:p-6'
            }`}
        >
            <div className={`flex flex-col bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-800 w-full ${isMinimized ? 'h-full' : 'h-[92vh] max-w-6xl'}`}>
                {/* Window Header Bar */}
                <div className="bg-emerald-950/90 text-white px-4 py-3 border-b border-emerald-800/60 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-emerald-700/80 rounded-xl border border-emerald-500/50 shrink-0">
                            <Video size={18} className="text-white animate-pulse" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-bold text-white truncate flex items-center gap-2">
                                {title}
                                <span className="bg-emerald-800 text-emerald-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-600/50">
                                    Encrypted WebRTC
                                </span>
                            </h3>
                            <p className="text-[11px] text-emerald-300/80 truncate">{subtitle}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
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
                            title="End Call & Disconnect Hardware"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Jitsi Meeting WebRTC Iframe Container */}
                <div className="relative flex-1 bg-black overflow-hidden">
                    {!isLoaded && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 text-white z-10 space-y-4">
                            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-sm font-semibold text-emerald-400">Initializing Secure WebRTC Video Stream...</p>
                        </div>
                    )}
                    <div ref={containerRef} className="w-full h-full" />
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
                        className="p-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition"
                        title="Share Screen"
                    >
                        <Monitor size={16} />
                        <span className="hidden sm:inline">Share Screen</span>
                    </button>

                    <button
                        onClick={handleHangup}
                        className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-md shadow-red-900/50"
                        title="Hang Up Meeting"
                    >
                        <PhoneOff size={16} />
                        <span>Leave Call</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
