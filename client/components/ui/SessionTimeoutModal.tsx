"use client";

import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Clock, ShieldAlert } from 'lucide-react';

export default function SessionTimeoutModal() {
    const { showTimeoutWarning, countdownTime, keepSessionAlive, logout } = useAuth();

    if (!showTimeoutWarning) return null;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 relative animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center mb-6 text-center">
                    <div className="w-14 h-14 mb-4 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 shadow-inner relative">
                        <ShieldAlert className="w-7 h-7" />
                        <span className="absolute -top-1 -right-1 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-[10px] text-white font-bold flex items-center justify-center">!</span>
                        </span>
                    </div>
                    <h2 className="text-xl font-extrabold text-gray-800 tracking-tight flex items-center gap-1.5 justify-center">
                        Inactivity Warning
                    </h2>
                    <p className="text-sm text-gray-500 mt-2 px-1">
                        You have been idle for a while. For your security, your session will automatically terminate in:
                    </p>
                </div>

                {/* Countdown Dial Layout */}
                <div className="flex flex-col items-center justify-center my-6 bg-slate-50 border border-slate-100 rounded-2xl py-6 relative overflow-hidden">
                    <div className="absolute top-2 left-2 text-[10px] text-slate-400 font-bold flex items-center gap-1">
                        <Clock size={10} /> SECURITY SHIELD ACTIVE
                    </div>
                    <div className="text-5xl font-black font-mono tracking-wider text-amber-600 animate-pulse">
                        00:{countdownTime.toString().padStart(2, '0')}
                    </div>
                    <div className="text-xs text-slate-400 font-semibold mt-1 uppercase tracking-widest">
                        seconds remaining
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => logout(window.location.pathname)}
                        className="flex-1 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 transition"
                    >
                        Log Out Now
                    </button>
                    <button
                        onClick={keepSessionAlive}
                        className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-md shadow-blue-500/10 active:scale-95 transition-all"
                    >
                        Keep Me Logged In
                    </button>
                </div>
            </div>
        </div>
    );
}
