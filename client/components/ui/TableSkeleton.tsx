import React from 'react';

interface TableSkeletonProps {
    rows?: number;
    cols?: number;
}

export default function TableSkeleton({ rows = 5, cols = 4 }: TableSkeletonProps) {
    return (
        <div className="w-full space-y-4 animate-pulse">
            {/* Header / Search bar skeleton */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2">
                <div className="h-9 w-64 bg-slate-200/80 rounded-xl"></div>
                <div className="flex gap-2">
                    <div className="h-9 w-24 bg-slate-200/80 rounded-xl"></div>
                    <div className="h-9 w-28 bg-slate-200/80 rounded-xl"></div>
                </div>
            </div>

            {/* Table Mockup */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="min-w-full divide-y divide-slate-100">
                    {/* Header Row */}
                    <div className="bg-slate-50/50 px-6 py-4 flex gap-4">
                        {Array.from({ length: cols }).map((_, i) => (
                            <div key={i} className="h-4 flex-1 bg-slate-200/80 rounded"></div>
                        ))}
                    </div>

                    {/* Data Rows */}
                    <div className="divide-y divide-slate-100">
                        {Array.from({ length: rows }).map((_, r) => (
                            <div key={r} className="px-6 py-5 flex items-center gap-4">
                                {Array.from({ length: cols }).map((_, c) => (
                                    <div key={c} className="flex-1 space-y-2">
                                        {c === 0 ? (
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-slate-200/80"></div>
                                                <div className="space-y-1.5 flex-1">
                                                    <div className="h-3 w-28 bg-slate-200/80 rounded"></div>
                                                    <div className="h-2.5 w-20 bg-slate-200/50 rounded"></div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className={`h-3 bg-slate-200/80 rounded ${c === cols - 1 ? 'w-2/3' : 'w-5/6'}`}></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
