"use client";

import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Smartphone, Monitor, ShieldAlert, Trash2, Shield, RefreshCw } from 'lucide-react';

interface UserSession {
    id: string;
    token: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
}

export default function ActiveSessions() {
    const [sessions, setSessions] = useState<UserSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [revokingAll, setRevokingAll] = useState(false);
    const [currentSid, setCurrentSid] = useState('');

    const fetchSessions = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/api/auth/sessions');
            setSessions(data || []);

            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    if (payload.sid) setCurrentSid(payload.sid);
                } catch {}
            }
        } catch (error) {
            console.error('Failed to load active sessions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const handleRevoke = async (id: string) => {
        try {
            setRevokingId(id);
            await api.delete(`/api/auth/sessions/${id}`);
            setSessions(prev => prev.filter(s => s.id !== id));
            // If the user revoked their own session, force logout
            const targetSession = sessions.find(s => s.id === id);
            if (targetSession && targetSession.token === currentSid) {
                localStorage.removeItem('token');
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Failed to revoke session:', error);
        } finally {
            setRevokingId(null);
        }
    };

    const handleRevokeAllOthers = async () => {
        try {
            setRevokingAll(true);
            await api.delete('/api/auth/sessions/all-others');
            setSessions(prev => prev.filter(s => s.token === currentSid));
        } catch (error) {
            console.error('Failed to revoke other sessions:', error);
        } finally {
            setRevokingAll(false);
        }
    };

    const getDeviceIcon = (ua: string | null) => {
        if (!ua) return <Monitor className="w-5 h-5 text-gray-500" />;
        const lowUa = ua.toLowerCase();
        if (lowUa.includes('mobile') || lowUa.includes('android') || lowUa.includes('iphone')) {
            return <Smartphone className="w-5 h-5 text-blue-500" />;
        }
        return <Monitor className="w-5 h-5 text-indigo-500" />;
    };

    const getDeviceLabel = (ua: string | null) => {
        if (!ua) return 'Unknown Device';
        if (ua.includes('Chrome/')) return 'Google Chrome';
        if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Apple Safari';
        if (ua.includes('Firefox/')) return 'Mozilla Firefox';
        if (ua.includes('Edge/')) return 'Microsoft Edge';
        return 'Web Browser';
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between border-b pb-4">
                    <div className="h-6 w-32 bg-slate-200 animate-pulse rounded-lg"></div>
                    <div className="h-8 w-24 bg-slate-200 animate-pulse rounded-lg"></div>
                </div>
                <div className="space-y-3">
                    <div className="h-14 w-full bg-slate-100 animate-pulse rounded-xl"></div>
                    <div className="h-14 w-full bg-slate-100 animate-pulse rounded-xl"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4 border border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-4 gap-2">
                <div>
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Shield size={20} className="text-blue-500" />
                        Active Sign-in Sessions
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Manage devices currently logged into your account.</p>
                </div>
                {sessions.length > 1 && (
                    <button
                        onClick={handleRevokeAllOthers}
                        disabled={revokingAll}
                        className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1 self-start transition"
                    >
                        {revokingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert size={14} />}
                        Log Out Other Devices
                    </button>
                )}
            </div>

            <div className="divide-y divide-gray-100">
                {sessions.map(session => {
                    const isCurrent = session.token === currentSid;
                    return (
                        <div key={session.id} className="py-3.5 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                                    {getDeviceIcon(session.userAgent)}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-gray-700 truncate">
                                            {getDeviceLabel(session.userAgent)}
                                        </span>
                                        {isCurrent && (
                                            <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wide">
                                                This Device
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-400 mt-0.5">
                                        <span>IP: {session.ipAddress || 'Unknown'}</span>
                                        <span className="text-gray-300">•</span>
                                        <span>
                                            Logged in: {new Date(session.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => handleRevoke(session.id)}
                                disabled={revokingId === session.id}
                                className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition"
                                title="Revoke access"
                            >
                                {revokingId === session.id ? (
                                    <RefreshCw className="w-4 h-4 animate-spin text-red-500" />
                                ) : (
                                    <Trash2 size={16} />
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
