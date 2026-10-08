'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Menu, Bell, Check, X, Info, AlertTriangle, CheckCircle, AlertOctagon, ChevronRight, Phone, Search, Command } from 'lucide-react';
import api from '../../lib/api';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSocket } from '../../context/SocketContext';

export default function Header({ toggleSidebar }: { toggleSidebar?: () => void }) {
    const { user } = useAuth();
    const pathname = usePathname();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [showPersistentModal, setShowPersistentModal] = useState(false);
    const { openVoipDialer, newMissedCount, clearNewMissedCount } = useSocket();

    const handleOpenVoip = () => {
        clearNewMissedCount();
        openVoipDialer();
    };
    const dropdownRef = useRef<HTMLDivElement>(null);
    const notifiedIdsRef = useRef<Set<string>>(new Set());

    // Request Notification permission on mount
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchNotifications = async () => {
        try {
            const { data } = await api.get('/api/notifications');
            
            // Trigger browser desktop notifications for new unread messages
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                const unreadList = data.notifications || [];
                const newUnread = unreadList.filter((n: any) => !n.isRead && !notifiedIdsRef.current.has(n.id));
                newUnread.forEach((n: any) => {
                    notifiedIdsRef.current.add(n.id);
                    new Notification(n.title, {
                        body: n.message,
                        icon: '/noun_logo.png'
                    });
                });
            }

            // Keep track of all fetched notification IDs to avoid duplicates
            if (data.notifications && Array.isArray(data.notifications)) {
                data.notifications.forEach((n: any) => notifiedIdsRef.current.add(n.id));
            }

            setNotifications(data.notifications || []);
            setUnreadCount(data.unreadCount || 0);
        } catch (error) {
            console.error('Failed to load notifications');
        }
    };

    useEffect(() => {
        if (user) fetchNotifications();
        // Poll every 60s — NOT tied to pathname to avoid re-fetching on every route change
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, [user]); // Removed pathname — prevents extra API call on every navigation

    // Synchronize persistent modal trigger with unreadCount
    useEffect(() => {
        if (unreadCount > 0) {
            setShowPersistentModal(true);
        } else {
            setShowPersistentModal(false);
        }
    }, [unreadCount]);

    const markAllRead = async () => {
        try {
            await api.put('/api/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error(error);
        }
    };

    const markOneRead = async (id: string) => {
        try {
            await api.put(`/api/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error(error);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'SUCCESS': return <CheckCircle size={16} className="text-green-500" />;
            case 'WARNING': return <AlertTriangle size={16} className="text-yellow-500" />;
            case 'ERROR': return <AlertOctagon size={16} className="text-red-500" />;
            default: return <Info size={16} className="text-blue-500" />;
        }
    };

    const unreadNotificationsList = notifications.filter(n => !n.isRead);

    return (
        <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 md:px-6 backdrop-blur-md transition-all">
            <div className="flex items-center gap-3">
                {toggleSidebar && (
                    <button 
                        onClick={toggleSidebar} 
                        className="md:hidden p-1.5 -ml-1 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        aria-label="Toggle Navigation Menu"
                    >
                        <Menu size={20} />
                    </button>
                )}
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#006533]"></span>
                    <h2 className="text-sm md:text-base font-bold text-slate-800 tracking-tight">
                        {pathname.includes('hr') || pathname.includes('registry') ? 'Registry Administration' :
                            pathname.includes('bursary') || pathname.includes('payroll') ? 'Bursary & Financial Management' :
                                pathname.includes('clinic') ? 'Clinical & Health Services' :
                                    pathname.includes('security') ? 'Campus Security Operations' :
                                        pathname.includes('academic') || pathname.includes('research') ? 'Academic & Research Services' :
                                            pathname.includes('unit') ? 'Unit Directorate Command' :
                                                'Staff Central Portal'}
                    </h2>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {/* Emergency Hotlines Quick Access Badge */}
                <div className="hidden lg:flex items-center gap-2 border border-red-200/80 bg-red-50/90 text-red-700 px-3 py-1 rounded-full text-xs font-bold shadow-2xs">
                    <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-red-900 shrink-0">SOS:</span>
                    <a href="tel:+2348031234567" className="hover:underline text-red-700 font-extrabold text-[11px]">Clinic (+234 803 123 4567)</a>
                    <span className="text-red-300 text-[10px]">|</span>
                    <a href="tel:+2348037654321" className="hover:underline text-red-700 font-extrabold text-[11px]">Security (+234 803 765 4321)</a>
                </div>

                {/* VoIP Internal Intercom Phone Button */}
                <button
                    onClick={handleOpenVoip}
                    className="relative p-2 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 rounded-xl border border-emerald-200/80 transition-all shadow-2xs flex items-center justify-center gap-1.5"
                    title="Open VoIP Extension Intercom"
                >
                    <Phone size={16} className="text-emerald-700" />
                    <span className="hidden sm:inline text-xs font-extrabold text-emerald-900">Intercom</span>
                    {newMissedCount > 0 ? (
                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white animate-pulse">
                            {newMissedCount > 9 ? '9+' : newMissedCount}
                        </span>
                    ) : (
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                    )}
                </button>

                {/* Notification Bell */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                        aria-label="Notifications"
                    >
                        <Bell size={18} />
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-extrabold text-white ring-2 ring-white">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {isOpen && (
                        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-2xl border border-slate-200 ring-1 ring-black/5 origin-top-right overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/80">
                                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">System Notifications</h3>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllRead}
                                        className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                                    >
                                        Mark all read
                                    </button>
                                )}
                            </div>

                            <div className="max-h-[65vh] overflow-y-auto divide-y divide-slate-100">
                                {notifications.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-slate-400 text-xs font-medium">
                                        No unread notifications
                                    </div>
                                ) : (
                                    notifications.map(note => (
                                        <div
                                            key={note.id}
                                            className={`px-4 py-3 hover:bg-slate-50/80 transition-colors cursor-pointer ${!note.isRead ? 'bg-emerald-50/30' : ''}`}
                                            onClick={() => !note.isRead && markOneRead(note.id)}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 flex-shrink-0">
                                                    {getIcon(note.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-xs ${!note.isRead ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                                                        {note.title}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                                                        {note.message}
                                                    </p>
                                                    {note.link && (
                                                        <Link
                                                            href={note.link}
                                                            className="text-[11px] text-[#006533] hover:underline mt-1 inline-block font-bold"
                                                            onClick={() => setIsOpen(false)}
                                                        >
                                                            View Details →
                                                        </Link>
                                                    )}
                                                    <p className="text-[10px] text-slate-400 mt-1.5">
                                                        {new Date(note.createdAt).toLocaleString()}
                                                    </p>
                                                </div>
                                                {!note.isRead && (
                                                    <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full mt-1.5"></div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* User Session Profile Chip */}
                <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
                    <div className="text-right hidden sm:block">
                        <p className="text-xs font-extrabold text-slate-900 leading-tight">
                            {user?.staffProfile?.title ? `${user.staffProfile.title}. ${user.name}` : user?.name}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate max-w-[140px] font-medium">
                            {user?.staffProfile?.rank || user?.role?.replace(/_/g, ' ')}
                        </p>
                    </div>
                    <div className="h-8 w-8 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-[#006533] font-black text-xs shadow-2xs">
                        {user?.name?.charAt(0) || 'U'}
                    </div>
                </div>
            </div>

            {/* System-wide Persistent Alert Modal */}
            {showPersistentModal && unreadNotificationsList.length > 0 && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-red-100 flex flex-col overflow-hidden animate-scaleUp">
                        {/* Header */}
                        <div className="p-6 text-center border-b border-gray-100 bg-red-50/30 flex-shrink-0">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500 animate-pulse mb-3 mx-auto">
                                <AlertTriangle size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">System Notification Alert</h3>
                            <p className="text-xs text-gray-500 mt-1">
                                You have {unreadCount} unread notification{unreadCount > 1 ? 's' : ''} that require{unreadCount === 1 ? 's' : ''} your immediate attention.
                            </p>
                        </div>

                        {/* Body (List of unread notifications) */}
                        <div className="p-6 overflow-y-auto max-h-[45vh] divide-y divide-gray-100 space-y-4">
                            {unreadNotificationsList.map((note) => (
                                <div key={note.id} className="pt-4 first:pt-0 flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2.5">
                                        <div className="mt-0.5 flex-shrink-0">
                                            {getIcon(note.type)}
                                        </div>
                                        <div className="pr-2">
                                            <h4 className="text-sm font-bold text-gray-800">{note.title}</h4>
                                            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{note.message}</p>
                                            <span className="text-[10px] text-gray-400 block mt-1">
                                                {new Date(note.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                        {note.link && (
                                            <Link
                                                href={note.link}
                                                target="_blank"
                                                rel="noreferrer"
                                                onClick={async () => {
                                                    await markOneRead(note.id);
                                                }}
                                                className="inline-flex items-center gap-0.5 text-xs font-bold text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded-md"
                                            >
                                                <span>Details</span>
                                                <ChevronRight size={12} />
                                            </Link>
                                        )}
                                        <button
                                            onClick={() => markOneRead(note.id)}
                                            className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-200"
                                            title="Acknowledge"
                                        >
                                            <Check size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0">
                            <button
                                onClick={async () => {
                                    await markAllRead();
                                    setShowPersistentModal(false);
                                }}
                                className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors text-center"
                            >
                                Acknowledge All & Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
