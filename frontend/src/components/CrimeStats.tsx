import React from 'react';
import { Crime } from '../../../backend/src/modules/crime/interfaces/crime.interface';

interface CrimeStatsProps {
    crimes: Crime[];
}

export const CrimeStats = ({ crimes }: CrimeStatsProps) => {
    const stats = crimes.reduce((acc, crime) => {
        acc[crime.category] = (acc[crime.category] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // sort by frequency
    const sortedStats = Object.entries(stats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5); // Top 5 categories

    if (crimes.length === 0) return null;

    return (
        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Area Insights</h3>
            <p className="text-sm text-gray-500 mb-4">Total incidents: {crimes.length}</p>
            <div className="space-y-3">
                {sortedStats.map(([category, count]) => (
                    <div key={category}>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="capitalize">{category.replace(/-/g, ' ')}</span>
                            <span className="font-semibold">{count}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                                className="bg-blue-600 h-1.5 rounded-full"
                                style={{ width: `${(count / crimes.length) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};