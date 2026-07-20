"use client";

import React from 'react';

/**
 * Animated skeleton shell for the TipTap Word-style rich text document editor.
 * Provides graceful degradation and instant visual feedback during SSR hydration.
 */
export default function EditorSkeleton() {
    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden animate-pulse">
            {/* Toolbar Skeleton */}
            <div className="bg-gray-50 dark:bg-gray-750 p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                    <div className="h-7 w-7 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    <div className="h-7 w-7 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    <div className="h-7 w-7 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
                    <div className="h-7 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    <div className="h-7 w-7 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                </div>
                <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            </div>

            {/* Document Page Skeleton */}
            <div className="p-8 min-h-[380px] space-y-4 max-w-3xl mx-auto">
                <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded-lg w-3/4"></div>
                <div className="space-y-2 pt-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-11/12"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5"></div>
                </div>
                <div className="space-y-2 pt-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-9/12"></div>
                </div>
            </div>
        </div>
    );
}
