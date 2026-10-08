'use client';

import { useAuth } from '../../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SystemAdminLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && user) {
            const isSystemAdmin = user.role === 'SUPER_USER' || user.role === 'ADMIN';
            if (!isSystemAdmin) {
                router.push('/dashboard/access-denied');
            }
        }
    }, [user, isLoading, router]);

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading System Admin Module...</div>;

    return (
        <div className="h-full">
            {children}
        </div>
    );
}
