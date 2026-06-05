
'use client';

import { useAuth } from '../../../hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function HRLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!isLoading && user) {
            const isHR = user.role === 'HR_ADMIN' || user.role === 'SUPER_USER' || user.role === 'ADMIN';
            const isUnitHead = user.role === 'UNIT_HEAD' || user.role === 'STUDY_CENTER_MANAGER' || user.role === 'UNIT_ADMIN';
            
            if (isUnitHead && !isHR) {
                if (!pathname.startsWith('/dashboard/registry/queries')) {
                    router.push('/dashboard/access-denied');
                }
            } else if (!isHR) {
                router.push('/dashboard/access-denied');
            }
        }
    }, [user, isLoading, router, pathname]);

    if (isLoading) return <div>Loading HR Module...</div>;

    return (
        <div className="h-full bg-blue-50/30">
            {/* Optional HR-specific top bar could go here */}
            {children}
        </div>
    );
}
