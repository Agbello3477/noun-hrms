'use client';

import { useAuth } from '../../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AcademicLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && user) {
            const isAcademic = user.staffProfile?.cadre === 'ACADEMIC' || user.role === 'SUPER_USER' || user.role === 'ADMIN';
            if (!isAcademic) {
                router.push('/dashboard/access-denied');
            }
        }
    }, [user, isLoading, router]);

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading Academic Module...</div>;

    return (
        <div className="h-full">
            {children}
        </div>
    );
}
