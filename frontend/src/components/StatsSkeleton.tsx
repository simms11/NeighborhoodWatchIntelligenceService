import React from 'react';

export const StatsSkeleton = () => (
    <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm animate-pulse space-y-4">
        <div className="space-y-2">
            <div className="h-4 w-28 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-3 w-36 bg-gray-100 dark:bg-gray-800 rounded" />
        </div>
        <div className="space-y-3">
            {[...Array(4)].map((_, index) => (
                <div key={index} className="space-y-1.5">
                    <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded" />
                    <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full" />
                </div>
            ))}
        </div>
    </div>
);
