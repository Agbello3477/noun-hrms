'use client';

import { useEffect } from 'react';

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Dashboard Error boundary caught:', error);
    }, [error]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-red-50 text-red-900">
            <div className="w-full max-w-2xl bg-white p-8 rounded-2xl shadow-xl border border-red-200">
                <h2 className="text-2xl font-black text-red-700 mb-4">Something went wrong!</h2>
                <div className="bg-gray-900 text-green-400 p-4 rounded-xl font-mono text-xs overflow-auto max-h-[300px] mb-6">
                    <p className="font-bold text-red-400">{error.name}: {error.message}</p>
                    <pre className="mt-2 whitespace-pre-wrap">{error.stack}</pre>
                </div>
                <button
                    onClick={() => reset()}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-colors"
                >
                    Try again
                </button>
            </div>
        </div>
    );
}
