"use client";

import React from 'react';

/**
 * Animated skeleton shell for real-time WebSocket chat threads.
 */
export default function ChatSkeleton() {
    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 shadow-sm flex flex-col h-[480px] animate-pulse overflow-hidden">
            {/* Header Skeleton */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                    <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
                <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>

            {/* Messages Skeleton */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                <div className="flex items-start space-x-2">
                    <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                    <div className="h-12 w-48 bg-gray-100 dark:bg-gray-750 rounded-2xl"></div>
                </div>
                <div className="flex items-start justify-end space-x-2">
                    <div className="h-14 w-56 bg-primary/20 rounded-2xl"></div>
                    <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                </div>
                <div className="flex items-start space-x-2">
                    <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                    <div className="h-10 w-40 bg-gray-100 dark:bg-gray-750 rounded-2xl"></div>
                </div>
            </div>

            {/* Input Bar Skeleton */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center space-x-2">
                <div className="h-10 flex-1 bg-gray-100 dark:bg-gray-750 rounded-xl"></div>
                <div className="h-10 w-10 bg-primary/30 rounded-xl"></div>
            </div>
        </div>
    );
}
