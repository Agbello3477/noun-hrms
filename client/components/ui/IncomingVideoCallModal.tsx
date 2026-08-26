"use client";

import React, { useEffect, useRef } from 'react';
import { Video, PhoneOff, Users, Sparkles } from 'lucide-react';

export interface IncomingVideoCallData {
    roomName: string;
    title?: string;
    callerUserId: string;
    callerName: string;
    callerRole?: string;
    callerAvatar?: string | null;
    module?: string;
    targetId?: string;
    timestamp?: string;
}

interface IncomingVideoCallModalProps {
    incomingCall: IncomingVideoCallData | null;
    onAccept: (callData: IncomingVideoCallData) => void;
    onDecline: (callData: IncomingVideoCallData) => void;
}

export default function IncomingVideoCallModal({
    incomingCall,
    onAccept,
    onDecline
}: IncomingVideoCallModalProps) {
    const audioContextRef = useRef<AudioContext | null>(null);
    const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Play pleasant synthetic Web Audio ringtone chime
    useEffect(() => {
        if (!incomingCall) {
            if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(() => {});
                audioContextRef.current = null;
            }
            return;
        }

        const playRingChime = () => {
            try {
                const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                if (!AudioCtx) return;
                const ctx = new AudioCtx();
                audioContextRef.current = ctx;

                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                const gain = ctx.createGain();

                osc1.type = 'sine';
                osc2.type = 'triangle';
                osc1.frequency.setValueAtTime(440, ctx.currentTime); // A4
                osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
                osc2.frequency.setValueAtTime(554.37, ctx.currentTime); // C#5
                osc2.frequency.exponentialRampToValueAtTime(1108.73, ctx.currentTime + 0.3);

                gain.gain.setValueAtTime(0.12, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(ctx.destination);

                osc1.start();
                osc2.start();
                osc1.stop(ctx.currentTime + 0.6);
                osc2.stop(ctx.currentTime + 0.6);
            } catch (e) {
                // AudioContext autoplay might be restricted before interaction
            }
        };

        playRingChime();
        ringIntervalRef.current = setInterval(playRingChime, 2500);

        // Auto-dismiss after 45s
        const autoTimeout = setTimeout(() => {
            if (incomingCall) {
                onDecline(incomingCall);
            }
        }, 45000);

        return () => {
            if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
            clearTimeout(autoTimeout);
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(() => {});
                audioContextRef.current = null;
            }
        };
    }, [incomingCall, onDecline]);

    if (!incomingCall) return null;

    const initials = incomingCall.callerName
        ? incomingCall.callerName
              .split(' ')
              .map((w) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
        : 'AC';

    return (
        <div className="fixed top-6 right-6 z-[9999] w-[360px] max-w-[calc(100vw-2rem)] rounded-3xl bg-slate-900/95 text-white p-5 shadow-2xl border-2 border-emerald-500/50 backdrop-blur-xl animate-in fade-in slide-in-from-top-6 duration-300">
            {/* Pulsing ring indicator */}
            <div className="flex items-center gap-3.5">
                <div className="relative flex-shrink-0">
                    <div className="absolute -inset-1 rounded-full bg-emerald-500 opacity-75 blur-sm animate-ping" />
                    {incomingCall.callerAvatar ? (
                        <img
                            src={incomingCall.callerAvatar}
                            alt={incomingCall.callerName}
                            className="relative h-14 w-14 rounded-full object-cover border-2 border-emerald-400 shadow-md"
                        />
                    ) : (
                        <div className="relative h-14 w-14 rounded-full bg-gradient-to-tr from-emerald-700 to-teal-500 flex items-center justify-center text-white font-black text-lg border-2 border-emerald-400 shadow-md">
                            {initials}
                        </div>
                    )}
                    <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                        <Video size={9} className="text-white" />
                    </span>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider">
                        <Sparkles size={12} className="animate-pulse" />
                        <span>Incoming Video Call</span>
                    </div>
                    <h3 className="text-base font-black text-white truncate mt-0.5" title={incomingCall.callerName}>
                        {incomingCall.callerName}
                    </h3>
                    <p className="text-xs text-slate-300 font-medium truncate mt-0.5" title={incomingCall.title || 'Video Call'}>
                        {incomingCall.title || 'Academic Collaboration Session'}
                    </p>
                    <span className="text-[10px] text-emerald-300/80 font-bold uppercase tracking-wider block mt-0.5">
                        {incomingCall.callerRole || 'Researcher / Staff'}
                    </span>
                </div>
            </div>

            {/* Action Buttons: WhatsApp Green Accept & Red Decline */}
            <div className="mt-5 flex items-center gap-3 pt-3 border-t border-slate-800">
                <button
                    onClick={() => onAccept(incomingCall)}
                    style={{ backgroundColor: '#006533' }}
                    className="flex-1 py-3 px-4 hover:opacity-95 text-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 transition-all hover:scale-[1.02] active:scale-[0.98] border border-emerald-500"
                >
                    <Video size={16} className="animate-pulse" />
                    <span>Join Video Call</span>
                </button>

                <button
                    onClick={() => onDecline(incomingCall)}
                    className="py-3 px-4 bg-red-600/90 hover:bg-red-600 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] border border-red-500/50"
                    title="Decline Call"
                >
                    <PhoneOff size={15} />
                    <span>Decline</span>
                </button>
            </div>
        </div>
    );
}
