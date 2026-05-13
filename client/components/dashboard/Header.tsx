'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Bell, Check, X, Info, AlertTriangle, CheckCircle, AlertOctagon } from 'lucide-react';
import api from '../../lib/api';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
    const { user } = useAuth();
    const pathname = usePathname();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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
            setNotifications(data.notifications);
            setUnreadCount(data.unreadCount);
        } catch (error) {
            console.error('Failed to load notifications');
        }
    };

    useEffect(() => {
        if (user) fetchNotifications();
        // Poll every 60s
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, [user, pathname]); // Re-fetch on navigation too

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
            // Recalculate unread would require iteration, or simpler:
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

    return (
        <header className="flex h-16 w-full items-center justify-between bg-white px-8 shadow-sm z-20 relative">
            <h2 className="text-xl font-semibold text-gray-800">
                {pathname.includes('hr') ? 'Registry Dashboard' :
                    pathname.includes('bursary') ? 'Bursary Dashboard' :
                        'Staff Dashboard'}
            </h2>

            <div className="flex items-center gap-6">
                {/* Notification Bell */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {isOpen && (
                        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5 origin-top-right overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                                <h3 className="text-sm font-bold text-gray-700">Notifications</h3>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllRead}
                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                        Mark all read
                                    </button>
                                )}
                            </div>

                            <div className="max-h-[70vh] overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-gray-500 text-sm">
                                        No new notifications
                                    </div>
                                ) : (
                                    notifications.map(note => (
                                        <div
                                            key={note.id}
                                            className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${!note.isRead ? 'bg-blue-50/50' : ''}`}
                                            onClick={() => !note.isRead && markOneRead(note.id)}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 flex-shrink-0">
                                                    {getIcon(note.type)}
                                                </div>
                                                <div className="flex-1">
                                                    <p className={`text-sm ${!note.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                                                        {note.title}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                                        {note.message}
                                                    </p>
                                                    {note.link && (
                                                        <Link
                                                            href={note.link}
                                                            className="text-xs text-nounGreen hover:underline mt-1.5 inline-block font-medium"
                                                            onClick={() => setIsOpen(false)} // Close on nav
                                                        >
                                                            View Details →
                                                        </Link>
                                                    )}
                                                    <p className="text-[10px] text-gray-400 mt-2">
                                                        {new Date(note.createdAt).toLocaleString()}
                                                    </p>
                                                </div>
                                                {!note.isRead && (
                                                    <div className="h-2 w-2 bg-blue-500 rounded-full mt-2"></div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* User Profile */}
                <div className="flex items-center gap-4 border-l pl-6 border-gray-200">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-gray-900">{user?.name}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[150px]">
                            {user?.staffProfile?.rank || user?.role?.replace(/_/g, ' ')}
                        </p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-nounGreen/10 flex items-center justify-center text-nounGreen font-bold border border-nounGreen/20">
                        {user?.name?.charAt(0)}
                    </div>
                </div>
            </div>
        </header>
    );
}
