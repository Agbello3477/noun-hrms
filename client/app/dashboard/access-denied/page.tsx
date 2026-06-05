'use client';

import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function AccessDeniedPage() {
    return (
        <div className="flex h-[calc(100vh-10rem)] flex-col items-center justify-center bg-white border border-gray-150 rounded-2xl p-8 text-center shadow-sm animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-6">
                <ShieldAlert size={36} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-500 max-w-md mb-8 leading-relaxed">
                You do not have the required permissions to access this module. Please contact the administrator if you believe this is an error.
            </p>
            <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 bg-nounGreen text-white px-6 py-3 rounded-full font-bold shadow-md hover:bg-green-800 transition hover:-translate-y-0.5"
            >
                <ArrowLeft size={16} /> Return to Dashboard
            </Link>
        </div>
    );
}
