import React from 'react';

export interface MapLegendEntry {
    label: string;
    color: string;
    count: number;
}

interface MapLegendProps {
    entries: MapLegendEntry[];
}

export const MapLegend = ({ entries }: MapLegendProps) => {
    if (entries.length === 0) return null;

    return (
        <div className="absolute top-3 right-3 z-[1000] bg-white/95 dark:bg-gray-900/90 backdrop-blur rounded-lg border border-gray-200 dark:border-gray-700 shadow-md px-3 py-2 space-y-1.5">
            {entries.map((entry) => (
                <div key={entry.label} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200 whitespace-nowrap">
                    <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: entry.color }}
                        aria-hidden="true"
                    />
                    <span className="font-medium">{entry.label}</span>
                    <span className="text-gray-400 dark:text-gray-500">· {entry.count.toLocaleString()} incidents</span>
                </div>
            ))}
        </div>
    );
};
