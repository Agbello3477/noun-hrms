"use client";

import React from 'react';

export default function ChatSkeleton() {
    return (
        <div className="border border-slate-200 rounded-2xl bg-white shadow-sm flex flex-col h-[480px] animate-pulse overflow-hidden">
            {/* Header Skeleton */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-2">
                    <div className="h-8 w-8 bg-slate-200 rounded-full"></div>
                    <div className="h-5 w-32 bg-slate-200 rounded"></div>
                </div>
                <div className="h-4 w-16 bg-slate-200 rounded"></div>
            </div>

            {/* Messages Skeleton */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                <div className="flex items-start space-x-2">
                    <div className="h-8 w-8 bg-slate-200 rounded-full"></div>
                    <div className="h-12 w-48 bg-slate-100 rounded-2xl"></div>
                </div>
                <div className="flex items-start justify-end space-x-2">
                    <div className="h-14 w-56 bg-emerald-100 rounded-2xl"></div>
                    <div className="h-8 w-8 bg-slate-200 rounded-full"></div>
                </div>
                <div className="flex items-start space-x-2">
                    <div className="h-8 w-8 bg-slate-200 rounded-full"></div>
                    <div className="h-10 w-40 bg-slate-100 rounded-2xl"></div>
                </div>
            </div>

            {/* Input Bar Skeleton */}
            <div className="p-3 border-t border-slate-200 flex items-center space-x-2 bg-slate-50">
                <div className="h-10 flex-1 bg-white border border-slate-200 rounded-xl"></div>
                <div className="h-10 w-10 bg-emerald-700 rounded-xl"></div>
            </div>
        </div>
    );
}
