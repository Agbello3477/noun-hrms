"use client";

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export default function NetworkStatus() {
    const [isOnline, setIsOnline] = useState(true);
    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState<'online' | 'offline'>('online');

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Set initial state
        setIsOnline(window.navigator.onLine);

        const handleOnline = () => {
            setIsOnline(true);
            setToastType('online');
            setShowToast(true);
            // Auto hide the green online toast after 4 seconds
            const timer = setTimeout(() => {
                setShowToast(false);
            }, 4000);
            return () => clearTimeout(timer);
        };

        const handleOffline = () => {
            setIsOnline(false);
            setToastType('offline');
            setShowToast(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!showToast) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-300">
            {toastType === 'offline' ? (
                <div className="flex items-center gap-3 bg-gray-900/95 text-white px-5 py-3.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-red-500/30 backdrop-blur-md">
                    <div className="relative flex h-3.5 w-3.5 items-center justify-center">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-semibold flex items-center gap-1.5 text-red-200">
                            <WifiOff size={14} /> Connection Offline
                        </span>
                        <span className="text-[10px] text-gray-400">Please check your internet connection.</span>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-3 bg-gray-900/95 text-white px-5 py-3.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-emerald-500/30 backdrop-blur-md">
                    <div className="relative flex h-3.5 w-3.5 items-center justify-center">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-semibold flex items-center gap-1.5 text-emerald-200">
                            <Wifi size={14} /> Connection Restored
                        </span>
                        <span className="text-[10px] text-gray-400">You are back online. Syncing data...</span>
                    </div>
                </div>
            )}
        </div>
    );
}
