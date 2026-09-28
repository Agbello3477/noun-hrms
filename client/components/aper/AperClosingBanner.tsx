'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, ArrowRight, ShieldAlert } from 'lucide-react';
import api from '../../lib/api';

interface AperClosingBannerProps {
    session?: any;
    userRole?: string;
}

export default function AperClosingBanner({ session: propSession, userRole }: AperClosingBannerProps) {
    const [session, setSession] = useState<any>(propSession || null);
    const [loading, setLoading] = useState(!propSession);
    const [timeLeft, setTimeLeft] = useState<{
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        isClosingWeek: boolean;
        isUrgent: boolean;
        isCritical: boolean;
        isClosed: boolean;
    } | null>(null);

    useEffect(() => {
        if (propSession) {
            setSession(propSession);
            setLoading(false);
            return;
        }

        const fetchActiveSession = async () => {
            try {
                const res = await api.get('/api/aper/sessions/active');
                if (res.data) {
                    setSession(res.data);
                }
            } catch (err) {
                // No active session or failed to fetch
            } finally {
                setLoading(false);
            }
        };

        fetchActiveSession();
    }, [propSession]);

    useEffect(() => {
        if (!session || !session.endDate) {
            setTimeLeft(null);
            return;
        }

        const calculateTimeRemaining = () => {
            const end = new Date(session.endDate).getTime();
            const now = Date.now();
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft({
                    days: 0,
                    hours: 0,
                    minutes: 0,
                    seconds: 0,
                    isClosingWeek: false,
                    isUrgent: false,
                    isCritical: false,
                    isClosed: true
                });
                return;
            }

            const totalHours = diff / (1000 * 60 * 60);
            const totalDays = totalHours / 24;

            const days = Math.floor(totalDays);
            const hours = Math.floor(totalHours % 24);
            const minutes = Math.floor((diff / (1000 * 60)) % 60);
            const seconds = Math.floor((diff / 1000) % 60);

            // Closing week is <= 7 days remaining
            const isClosingWeek = totalDays <= 7;
            const isUrgent = totalHours <= 24;
            const isCritical = totalHours <= 2;

            setTimeLeft({
                days,
                hours,
                minutes,
                seconds,
                isClosingWeek,
                isUrgent,
                isCritical,
                isClosed: false
            });
        };

        calculateTimeRemaining();
        const interval = setInterval(calculateTimeRemaining, 1000);
        return () => clearInterval(interval);
    }, [session]);

    if (loading || !session || !timeLeft || !timeLeft.isClosingWeek || timeLeft.isClosed) {
        return null;
    }

    const { days, hours, minutes, seconds, isCritical, isUrgent } = timeLeft;
    const formattedDeadline = new Date(session.endDate).toLocaleString('en-NG', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });

    // Theme based on urgency
    let bannerClasses = 'bg-amber-500 text-slate-950 border-amber-600';
    let badgeClasses = 'bg-amber-100 text-amber-900 border-amber-300';
    let icon = <Clock className="h-5 w-5 text-amber-950 animate-pulse flex-shrink-0" />;

    if (isCritical) {
        bannerClasses = 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white border-red-700 animate-pulse';
        badgeClasses = 'bg-white/20 text-white border-white/30';
        icon = <ShieldAlert className="h-5 w-5 text-white flex-shrink-0" />;
    } else if (isUrgent) {
        bannerClasses = 'bg-gradient-to-r from-orange-500 to-amber-600 text-white border-orange-600';
        badgeClasses = 'bg-white/20 text-white border-white/30';
        icon = <AlertTriangle className="h-5 w-5 text-white flex-shrink-0" />;
    }

    const isHrOrRegistry = userRole === 'HR_ADMIN' || userRole === 'REGISTRAR' || userRole === 'SUPER_USER' || userRole === 'ADMIN';

    return (
        <div className={`w-full rounded-xl border p-4 shadow-sm transition-all mb-4 ${bannerClasses}`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    {icon}
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm sm:text-base tracking-tight">
                                {isCritical
                                    ? 'CRITICAL ALERT: APER Submission Window Closing Imminently!'
                                    : isUrgent
                                        ? 'FINAL NOTICE: APER Appraisal Portal Closes in Less Than 24 Hours!'
                                        : 'APER Closing Week Reminder'}
                            </span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badgeClasses}`}>
                                Cycle: {session.year}
                            </span>
                        </div>
                        <p className={`text-xs mt-0.5 ${isCritical || isUrgent ? 'text-white/90' : 'text-slate-800'}`}>
                            {session.title} closes definitively on <strong>{formattedDeadline}</strong>. Unsubmitted appraisals will not be accepted.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    {/* Real-time Countdown Display */}
                    <div className="flex items-center gap-1 font-mono text-center">
                        <div className={`px-2 py-1 rounded-md text-xs font-black ${isCritical || isUrgent ? 'bg-black/30 text-white' : 'bg-white/70 text-slate-900 border border-amber-300'}`}>
                            <span className="text-sm font-bold leading-none">{days}</span>
                            <span className="text-[9px] block uppercase font-medium">days</span>
                        </div>
                        <span className="font-bold text-xs">:</span>
                        <div className={`px-2 py-1 rounded-md text-xs font-black ${isCritical || isUrgent ? 'bg-black/30 text-white' : 'bg-white/70 text-slate-900 border border-amber-300'}`}>
                            <span className="text-sm font-bold leading-none">{String(hours).padStart(2, '0')}</span>
                            <span className="text-[9px] block uppercase font-medium">hrs</span>
                        </div>
                        <span className="font-bold text-xs">:</span>
                        <div className={`px-2 py-1 rounded-md text-xs font-black ${isCritical || isUrgent ? 'bg-black/30 text-white' : 'bg-white/70 text-slate-900 border border-amber-300'}`}>
                            <span className="text-sm font-bold leading-none">{String(minutes).padStart(2, '0')}</span>
                            <span className="text-[9px] block uppercase font-medium">min</span>
                        </div>
                        <span className="font-bold text-xs">:</span>
                        <div className={`px-2 py-1 rounded-md text-xs font-black ${isCritical || isUrgent ? 'bg-black/30 text-white' : 'bg-white/70 text-slate-900 border border-amber-300'}`}>
                            <span className="text-sm font-bold leading-none">{String(seconds).padStart(2, '0')}</span>
                            <span className="text-[9px] block uppercase font-medium">sec</span>
                        </div>
                    </div>

                    {/* Action link */}
                    <Link
                        href={isHrOrRegistry ? '/dashboard/hr/aper' : '/dashboard/staff/aper'}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition whitespace-nowrap ${
                            isCritical || isUrgent
                                ? 'bg-white text-rose-700 hover:bg-slate-100'
                                : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                    >
                        <span>{isHrOrRegistry ? 'Manage APER' : 'Submit APER'}</span>
                        <ArrowRight size={13} />
                    </Link>
                </div>
            </div>
        </div>
    );
}
