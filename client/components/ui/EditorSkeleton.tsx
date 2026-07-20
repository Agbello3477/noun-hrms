"use client";

import React from 'react';

export default function EditorSkeleton() {
    return (
        <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden animate-pulse">
            {/* Toolbar Skeleton */}
            <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                    <div className="h-7 w-7 bg-slate-200 rounded-lg"></div>
                    <div className="h-7 w-7 bg-slate-200 rounded-lg"></div>
                    <div className="h-7 w-7 bg-slate-200 rounded-lg"></div>
                    <div className="h-4 w-px bg-slate-300 mx-1"></div>
                    <div className="h-7 w-20 bg-slate-200 rounded-lg"></div>
                    <div className="h-7 w-7 bg-slate-200 rounded-lg"></div>
                </div>
                <div className="h-6 w-24 bg-slate-200 rounded-full"></div>
            </div>

            {/* Document Page Skeleton */}
            <div className="p-8 min-h-[380px] space-y-4 max-w-3xl mx-auto">
                <div className="h-7 bg-slate-200 rounded-lg w-3/4"></div>
                <div className="space-y-2 pt-2">
                    <div className="h-4 bg-slate-200 rounded w-full"></div>
                    <div className="h-4 bg-slate-200 rounded w-11/12"></div>
                    <div className="h-4 bg-slate-200 rounded w-4/5"></div>
                </div>
                <div className="space-y-2 pt-4">
                    <div className="h-4 bg-slate-200 rounded w-full"></div>
                    <div className="h-4 bg-slate-200 rounded w-9/12"></div>
                </div>
            </div>
        </div>
    );
}
