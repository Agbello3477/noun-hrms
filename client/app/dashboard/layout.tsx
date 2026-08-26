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
import dynamic from 'next/dynamic';
import { SocketProvider, useSocket } from '../../context/SocketContext';

const IncomingVideoCallModal = dynamic(() => import('@/components/ui/IncomingVideoCallModal'), {
    ssr: false
});

const VideoConferenceModal = dynamic(() => import('@/components/ui/VideoConferenceModal'), {
    ssr: false
});

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
            <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none" />
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                <div className="text-center mb-6">
                    <div className="mx-auto w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-4 text-amber-600">
                        <Lock size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Security Update Required</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        You are currently using the default system password. Please change your password to continue.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg font-medium">
                        Password updated successfully! Logging you in...
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Current Password
                        </label>
                        <div className="relative">
                            <input
                                type={showCurrent ? "text" : "password"}
                                required
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 pr-10"
                                placeholder="Enter current password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrent(!showCurrent)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                            New Password
                        </label>
                        <div className="relative">
                            <input
                                type={showNew ? "text" : "password"}
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 pr-10"
                                placeholder="Enter at least 8 characters"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNew(!showNew)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <div className="mt-2">
                            <PasswordStrengthMeter password={newPassword} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Confirm New Password
                        </label>
                        <div className="relative">
                            <input
                                type={showConfirm ? "text" : "password"}
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 pr-10"
                                placeholder="Re-enter new password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm(!showConfirm)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || success}
                        style={{ backgroundColor: '#006533' }}
                        className="w-full mt-2 py-2.5 px-4 text-white text-sm font-semibold rounded-lg shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Updating Password...
                            </>
                        ) : (
                            'Set Secure Password & Continue'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

// Ultra-fast Shell Skeleton during initial micro-load (<50ms)
function ShellContentSkeleton() {
    return (
        <div className="space-y-6 animate-pulse p-4">
            <div className="h-8 w-64 bg-slate-200 rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="h-28 bg-slate-200 rounded-2xl" />
                <div className="h-28 bg-slate-200 rounded-2xl" />
                <div className="h-28 bg-slate-200 rounded-2xl" />
                <div className="h-28 bg-slate-200 rounded-2xl" />
            </div>
            <div className="h-64 bg-slate-200 rounded-3xl" />
        </div>
    );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
    const { user, isLoading, refreshUser } = useAuth();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const {
        incomingVideoCall,
        activeVideoModal,
        acceptVideoCall,
        declineVideoCall,
        closeActiveVideoModal
    } = useSocket();

    const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('token');

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!isLoading && !user && mounted) {
            router.push('/');
        } else if (user && !user.mustChangePassword) {
            import('../../lib/firebase')
                .then(({ requestPushNotificationsPermission }) => {
                    requestPushNotificationsPermission();
                })
                .catch(err => {
                    console.warn('[FCM] Firebase notification registration:', err);
                });
        }
    }, [user, isLoading, mounted, router]);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden relative">
            <Suspense fallback={null}>
                <NavigationProgress />
            </Suspense>

            {mounted && !hasToken ? (
                <div className="flex h-screen w-screen flex-col items-center justify-center bg-gray-50 p-8 text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-50 pointer-events-none" />
                    <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-6 border border-red-100 shadow-sm animate-bounce">
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
            ) : user?.mustChangePassword ? (
                <ForcedPasswordChangeModal refreshUser={refreshUser} />
            ) : (
                <>
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

                    {/* Desktop Sidebar Shell */}
                    <div className="hidden md:block flex-none">
                        <Sidebar />
                    </div>
                    
                    <div className="flex flex-1 flex-col overflow-hidden min-w-0">
                        <Header toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

                        <main className="flex-1 overflow-auto p-4 md:p-8">
                            <Suspense fallback={<ShellContentSkeleton />}>
                                {children}
                            </Suspense>
                        </main>
                    </div>
                </>
            )}

            {/* Global WhatsApp-style Incoming Video Call Banner */}
            {mounted && incomingVideoCall && (
                <IncomingVideoCallModal
                    incomingCall={incomingVideoCall}
                    onAccept={acceptVideoCall}
                    onDecline={declineVideoCall}
                />
            )}

            {/* Global Video Conference Meeting Overlay */}
            {mounted && activeVideoModal?.isOpen && (
                <VideoConferenceModal
                    isOpen={activeVideoModal.isOpen}
                    onClose={closeActiveVideoModal}
                    roomName={activeVideoModal.roomName}
                    userName={user?.name || (user?.email ? user.email.split('@')[0] : 'Colleague')}
                    userEmail={user?.email || ''}
                    title={activeVideoModal.title}
                    subtitle="Encrypted real-time WebRTC peer meeting"
                />
            )}
        </div>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <SocketProvider>
            <DashboardLayoutContent>
                {children}
            </DashboardLayoutContent>
        </SocketProvider>
    );
}
