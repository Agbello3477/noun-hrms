'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SabbaticalPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/dashboard/leaves?open=sabbatical');
    }, [router]);

    return (
        <div className="p-8 text-center text-gray-500 font-medium">
            Redirecting to Leaves Dashboard...
        </div>
    );
}
