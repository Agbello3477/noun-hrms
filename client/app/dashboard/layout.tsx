'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import api from '../../lib/api';
import Sidebar from '../../components/dashboard/Sidebar';
import Header from '../../components/dashboard/Header';
import NavigationProgress from '@/components/ui/NavigationProgress';
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import PasswordStrengthMeter from '@/components/ui/PasswordStrengthMeter';

function ForcedPasswordChangeModal({ refreshUser }: { refreshUser: () => Promise<void> }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (newPassword.length < 8) {
            setError('New password must be at least 8 characters long.');
            return;
        }
        if (newPassword === '123456789') {
            setError('New password cannot be the default password.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('New passwords do not match.');
            return;
        }

        setIsSubmitting(true);
        try {
            await api.post('/api/auth/change-password', {
                currentPassword,
                newPassword,
            });
            setSuccess(true);
            setTimeout(async () => {
                await refreshUser();
            }, 1500);
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Failed to change password. Please verify current password.';
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 relative overflow-hidden w-full">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-50 pointer-events-none" />
            
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl border border-gray-100 relative animate-in fade-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center mb-6 text-center">
                    <div className="w-16 h-16 mb-4 bg-red-50 rounded-full flex items-center justify-center text-red-500 shadow-inner">
                        <Lock className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight">Change Default Password</h2>
                    <p className="text-sm font-medium text-gray-500 mt-2">
                        For security reasons, you must change your temporary default password before you can proceed to the portal.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-100 flex items-start gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-red-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="flex-1">{error}</span>
                    </div>
                )}

                {success && (
                    <div className="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-700 border border-green-100 flex items-start gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-green-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="flex-1">Password updated successfully! Redirecting you to the portal...</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1 block text-xs font-bold text-gray-500 uppercase tracking-wider" htmlFor="currentPassword">
                            Current Password
                        </label>
                        <div className="relative">
                            <input
                                className="w-full rounded-xl border border-gray-200 bg-gray-55 px-4 py-3 pr-10 text-gray-700 focus:border-nounGreen focus:bg-white focus:ring-2 focus:ring-nounGreen/20 outline-none transition-all"
                                id="currentPassword"
                                type={showCurrent ? 'text' : 'password'}
                                placeholder="Enter current password (e.g. 123456789)"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                                onClick={() => setShowCurrent(!showCurrent)}
                            >
                                {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-bold text-gray-500 uppercase tracking-wider" htmlFor="newPassword">
                            New Password
                        </label>
                        <div className="relative">
                            <input
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-10 text-gray-700 focus:border-nounGreen focus:bg-white focus:ring-2 focus:ring-nounGreen/20 outline-none transition-all"
                                id="newPassword"
                                type={showNew ? 'text' : 'password'}
                                placeholder="Min 8 characters"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                                onClick={() => setShowNew(!showNew)}
                            >
                                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-bold text-gray-500 uppercase tracking-wider" htmlFor="confirmPassword">
                            Confirm New Password
                        </label>
                        <div className="relative">
                            <input
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-10 text-gray-700 focus:border-nounGreen focus:bg-white focus:ring-2 focus:ring-nounGreen/20 outline-none transition-all"
                                id="confirmPassword"
                                type={showConfirm ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                                onClick={() => setShowConfirm(!showConfirm)}
                            >
                                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <PasswordStrengthMeter password={newPassword} />

                    <button
                        className="w-full rounded-xl bg-nounGreen px-4 py-3.5 font-bold text-white hover:bg-green-800 transition-all shadow-lg shadow-green-900/20 hover:-translate-y-0.5 flex items-center justify-center gap-2 mt-6 disabled:opacity-75 disabled:cursor-not-allowed"
                        type="submit"
                        disabled={isSubmitting || success}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Updating Password...
                            </>
                        ) : (
                            'Update Password & Access Portal'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, isLoading, refreshUser } = useAuth();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('token');

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/');
        } else if (user && !user.mustChangePassword) {
            // Register FCM Push Notifications dynamically on the client side
            import('../../lib/firebase')
                .then(({ requestPushNotificationsPermission }) => {
                    requestPushNotificationsPermission();
                })
                .catch(err => {
                    console.error('[FCM] Failed to load Firebase init library:', err);
                });
        }
    }, [user, isLoading, router]);

    if (mounted && !hasToken) {
        return (
            <div className="flex h-screen w-screen flex-col items-center justify-center bg-gray-55 p-8 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-50 pointer-events-none" />
                <div className="w-16 h-16 bg-red-55 text-red-600 rounded-2xl flex items-center justify-center mb-6 border border-red-100 shadow-sm animate-bounce">
                    <Lock size={32} />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h1>
                <p className="text-gray-500 max-w-sm mb-6 leading-relaxed text-sm">
                    You must be authenticated with valid credentials to view this page. Please log in to your account.
                </p>
                <button
                    onClick={() => router.push('/')}
                    style={{ backgroundColor: '#006533' }}
                    className="inline-flex items-center gap-2 text-white px-6 py-3 rounded-full font-bold shadow-md hover:opacity-95 transition-all text-xs hover:-translate-y-0.5"
                >
                    Log In to Portal
                </button>
            </div>
        );
    }

    if (!mounted || isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            </div>
        );
    }

    if (!user) {
        return null; // Will redirect via useEffect
    }

    if (user.mustChangePassword) {
        return <ForcedPasswordChangeModal refreshUser={refreshUser} />;
    }

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden relative">
            <Suspense fallback={null}>
                <NavigationProgress />
            </Suspense>
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
            
            {/* Mobile Sidebar */}
            <div className={`md:hidden fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 flex-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
            </div>

            {/* Desktop Sidebar (NO absolute/fixed positioning whatsoever) */}
            <div className="hidden md:block flex-none">
                <Sidebar />
            </div>
            
            <div className="flex flex-1 flex-col overflow-hidden min-w-0">
                <Header toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
                
                {/* Global Emergency Hotline Ribbon for All Dashboard Views */}
                <div className="bg-red-600 text-white px-4 py-2 text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-sm border-b border-red-700 z-10">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                        </span>
                        <span className="uppercase tracking-wider font-extrabold text-[11px]">🚨 Campus Emergency Response & Security Hotlines:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] md:text-xs">
                        <a href="tel:+2348031234567" className="hover:underline font-extrabold flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2.5 py-0.5 rounded-md transition text-white">
                            <span>🏥 Clinic Emergency:</span>
                            <span className="underline">+234 803 123 4567</span>
                        </a>
                        <a href="tel:+2348037654321" className="hover:underline font-extrabold flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2.5 py-0.5 rounded-md transition text-white">
                            <span>🛡️ Security Control:</span>
                            <span className="underline">+234 803 765 4321</span>
                        </a>
                    </div>
                </div>

                <main className="flex-1 overflow-auto p-4 md:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
