import React from 'react';
import { Crime } from '../../../backend/src/modules/crime/interfaces/crime.interface';

interface CrimeStatsProps {
    crimes: Crime[];
}

const formatDataMonth = (month?: string) => {
    if (!month) return null;
    const [year, m] = month.split('-').map(Number);
    if (!year || !m) return null;
    return new Date(year, m - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

export const CrimeStats = ({ crimes }: CrimeStatsProps) => {
    if (crimes.length === 0) return null;

    const categoryStats = crimes.reduce((acc, crime) => {
        acc[crime.category] = (acc[crime.category] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const sortedCategories = Object.entries(categoryStats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5); // Top 5 categories

    const resolvedCount = crimes.filter((crime) => crime.outcome_status).length;
    const resolvedPercent = Math.round((resolvedCount / crimes.length) * 100);

    const outcomeStats = crimes.reduce((acc, crime) => {
        const category = crime.outcome_status?.category ?? 'Awaiting outcome';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const topOutcomes = Object.entries(outcomeStats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

    const dataMonth = formatDataMonth(crimes[0]?.month);

    return (
        <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm space-y-5">
            <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Area Insights</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total incidents: {crimes.length}</p>
                {dataMonth && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Showing Police.uk&apos;s most recently published data, for {dataMonth}.
                    </p>
                )}
            </div>

            <div className="space-y-3">
                {sortedCategories.map(([category, count]) => (
                    <div key={category}>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="capitalize">{category.replace(/-/g, ' ')}</span>
                            <span className="font-semibold">{count}</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                            <div
                                className="bg-blue-600 h-1.5 rounded-full"
                                style={{ width: `${(count / crimes.length) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex justify-between text-sm mb-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-200">Outcomes recorded</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-200">{resolvedPercent}%</span>
                </div>
                <div className="space-y-2">
                    {topOutcomes.map(([outcome, count]) => (
                        <div key={outcome} className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>{outcome}</span>
                            <span>{count}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
