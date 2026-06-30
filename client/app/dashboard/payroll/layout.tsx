'use client';

import { useAuth } from '../../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function PayrollLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && user) {
            const hasAccess = [
                'BURSARY',
                'SUPER_USER',
                'ADMIN'
            ].includes(user.role);
            if (!hasAccess) {
                router.push('/dashboard/access-denied');
            }
        }
    }, [user, isLoading, router]);

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading Payroll...</div>;

    return (
        <div className="h-full">
            {children}
        </div>
    );
}
