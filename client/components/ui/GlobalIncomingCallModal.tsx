'use client';

import React, { useEffect } from 'react';
import { Phone, PhoneOff, Video, Users, Sparkles } from 'lucide-react';
import { useSocket, IncomingVoipCallData } from '../../context/SocketContext';
import { IncomingVideoCallData } from './IncomingVideoCallModal';
import { startIncomingCallRingtone, stopIncomingCallRingtone } from '../../lib/sound';
import { showBrowserNotification } from '../../lib/notifications';

export default function GlobalIncomingCallModal() {
    const {
        incomingVoipCall,
        incomingVideoCall,
        acceptVoipCall,
        declineVoipCall,
        acceptVideoCall,
        declineVideoCall
    } = useSocket();

    const activeCall = incomingVoipCall || incomingVideoCall;
    const isVideo = !!incomingVideoCall;

    // Trigger ringtone chime, desktop push notification, and tab flashing on incoming call
    useEffect(() => {
        if (!activeCall) {
            stopIncomingCallRingtone();
            return;
        }

        startIncomingCallRingtone();

        const title = isVideo
            ? `📹 Video Call: ${(incomingVideoCall as IncomingVideoCallData).title || 'Incoming Video Conference'}`
            : `📞 Incoming VoIP Call from ${(incomingVoipCall as IncomingVoipCallData).callerName}`;

        const body = isVideo
            ? `${(incomingVideoCall as IncomingVideoCallData).callerName} (${(incomingVideoCall as IncomingVideoCallData).callerRole || 'Staff'}) is calling. Click to join.`
            : `Internal Extension: ${(incomingVoipCall as IncomingVoipCallData).callerExtension} • Click to answer`;

        showBrowserNotification(title, {
            body,
            tag: isVideo ? `video_call_${(incomingVideoCall as IncomingVideoCallData).roomName}` : `voip_call_${(incomingVoipCall as IncomingVoipCallData).callId}`,
            requireInteraction: true
        });

        // Tab Title Blinking
        const originalTitle = document.title;
        let isFlashing = true;
        const interval = setInterval(() => {
            if (!isFlashing) return;
            document.title = document.title.startsWith('(1) 📞') ? originalTitle : `(1) 📞 INCOMING CALL - ${originalTitle}`;
        }, 800);

        // Auto-dismiss after 45s if unanswered
        const autoTimeout = setTimeout(() => {
            if (incomingVoipCall) declineVoipCall(incomingVoipCall);
            if (incomingVideoCall) declineVideoCall(incomingVideoCall);
        }, 45000);

        return () => {
            isFlashing = false;
            clearInterval(interval);
            document.title = originalTitle;
            stopIncomingCallRingtone();
            clearTimeout(autoTimeout);
        };
    }, [activeCall, isVideo, incomingVoipCall, incomingVideoCall, declineVoipCall, declineVideoCall]);

    if (!activeCall) return null;

    const callerName = isVideo
        ? (incomingVideoCall as IncomingVideoCallData).callerName
        : (incomingVoipCall as IncomingVoipCallData).callerName;

    const callerSubtitle = isVideo
        ? (incomingVideoCall as IncomingVideoCallData).callerRole || 'Academic Staff'
        : `Ext: ${(incomingVoipCall as IncomingVoipCallData).callerExtension} • ${(incomingVoipCall as IncomingVoipCallData).callerRank || 'NOUN Staff'}`;

    const callerAvatar = isVideo
        ? (incomingVideoCall as IncomingVideoCallData).callerAvatar
        : null;

    const initials = callerName
        ? callerName
              .split(' ')
              .map((w) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
        : 'AC';

    const handleAccept = () => {
        // Fulfill browser autoplay policy immediately on user click
        const remoteAudio = document.getElementById('remoteAudio') as HTMLAudioElement;
        if (remoteAudio) {
            remoteAudio.play().catch((err) => console.log('[Autoplay Trigger]', err));
        }

        if (isVideo && incomingVideoCall) {
            acceptVideoCall(incomingVideoCall);
        } else if (incomingVoipCall) {
            acceptVoipCall(incomingVoipCall);
        }
    };

    const handleDecline = () => {
        if (isVideo && incomingVideoCall) {
            declineVideoCall(incomingVideoCall);
        } else if (incomingVoipCall) {
            declineVoipCall(incomingVoipCall);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
            {/* Strict, locked modal container with zero layout shift */}
            <div className="w-[380px] max-w-full rounded-3xl bg-slate-900 border-2 border-emerald-500/60 shadow-2xl p-6 text-white relative">
                {/* Static Avatar Container with Non-Shifting Ripple */}
                <div className="w-20 h-20 relative mx-auto mb-4 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping pointer-events-none" />
                    {callerAvatar ? (
                        <img
                            src={callerAvatar}
                            alt={callerName}
                            className="relative h-20 w-20 rounded-full object-cover border-2 border-emerald-400 shadow-lg"
                        />
                    ) : (
                        <div className="relative h-20 w-20 rounded-full bg-gradient-to-tr from-emerald-700 to-teal-500 flex items-center justify-center text-white font-black text-2xl border-2 border-emerald-400 shadow-lg">
                            {initials}
                        </div>
                    )}
                    <span className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center shadow">
                        {isVideo ? <Video size={12} className="text-white" /> : <Phone size={12} className="text-white" />}
                    </span>
                </div>

                {/* Static Status Pill */}
                <div className="h-6 flex items-center justify-center gap-1.5 px-3 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-extrabold uppercase tracking-wider mx-auto mb-2 w-max border border-emerald-500/30">
                    <Sparkles size={12} className="animate-pulse" />
                    <span>{isVideo ? 'Incoming Video Call' : 'Incoming VoIP Call'}</span>
                </div>

                {/* Static Caller Info */}
                <div className="min-h-[56px] flex flex-col items-center justify-center mb-6 text-center">
                    <h3 className="text-xl font-black text-white truncate max-w-full" title={callerName}>
                        {callerName}
                    </h3>
                    <p className="text-xs text-slate-300 font-semibold truncate max-w-full mt-1" title={callerSubtitle}>
                        {callerSubtitle}
                    </p>
                </div>

                {/* Locked Action Buttons with Zero Layout Shift */}
                <div className="h-12 w-full flex items-center gap-3 pt-2 border-t border-slate-800/80">
                    <button
                        onClick={handleDecline}
                        className="h-12 flex-1 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-900/40 border border-red-500"
                    >
                        <PhoneOff size={16} />
                        <span>Decline</span>
                    </button>

                    <button
                        onClick={handleAccept}
                        style={{ backgroundColor: '#006533' }}
                        className="h-12 flex-1 rounded-2xl hover:opacity-95 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/40 border border-emerald-400"
                    >
                        {isVideo ? <Video size={16} className="animate-pulse" /> : <Phone size={16} className="animate-pulse" />}
                        <span>{isVideo ? 'Join Meeting' : 'Answer'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
