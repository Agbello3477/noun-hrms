'use client';

import { useAuth } from '../../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HRAdminLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && user) {
            const isHR = user.role === 'HR_ADMIN' || user.role === 'SUPER_USER' || user.role === 'ADMIN' || user.role === 'VICE_CHANCELLOR';
            if (!isHR) {
                router.push('/dashboard/access-denied');
            }
        }
    }, [user, isLoading, router]);

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading HR Admin Module...</div>;

    return (
        <div className="h-full">
            {children}
        </div>
    );
}
