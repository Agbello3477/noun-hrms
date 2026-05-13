
'use client';

import { useAuth } from '../../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HRLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && user) {
            const isHR = user.role === 'HR_ADMIN' || user.role === 'SUPER_USER' || user.role === 'ADMIN';
            if (!isHR) {
                router.push('/dashboard/access-denied');
            }
        }
    }, [user, isLoading, router]);

    if (isLoading) return <div>Loading HR Module...</div>;

    return (
        <div className="h-full bg-blue-50/30">
            {/* Optional HR-specific top bar could go here */}
            {children}
        </div>
    );
}
