
'use client';

import { useAuth } from '../../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function UnitLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && user) {
            const isUnitHead = user.role === 'UNIT_HEAD' || user.role === 'STUDY_CENTER_MANAGER' || user.role === 'UNIT_ADMIN' || user.role === 'ADMIN' || user.role === 'SUPER_USER';
            if (!isUnitHead) {
                router.push('/dashboard/access-denied');
            }
        }
    }, [user, isLoading, router]);

    if (isLoading) return <div>Loading Unit Dashboard...</div>;

    return (
        <div className="h-full bg-indigo-50/30">
            {children}
        </div>
    );
}
