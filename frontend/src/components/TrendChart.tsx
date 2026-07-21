import React from 'react';
import { MonthlyCrimeCount } from '../../../backend/src/modules/crime/crime.service';

interface TrendChartProps {
    data: MonthlyCrimeCount[];
}

const formatMonthLabel = (month: string) => {
    const [year, m] = month.split('-').map(Number);
    if (!year || !m) return month;
    return new Date(year, m - 1).toLocaleDateString('en-GB', { month: 'short' });
};

export const TrendChart = ({ data }: TrendChartProps) => {
    if (data.length === 0) return null;

    const max = Math.max(...data.map((entry) => entry.total), 1);

    return (
        <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-3">
                {data.length}-Month Trend
            </h3>
            <div className="flex items-end gap-2 h-24">
                {data.map((entry) => (
                    <div key={entry.month} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
                        <div
                            className="w-full max-w-6 bg-blue-500 dark:bg-blue-400 rounded-t transition-all"
                            style={{ height: `${Math.max((entry.total / max) * 100, 4)}%` }}
                            title={`${entry.total} incidents in ${entry.month}`}
                        />
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
                            {formatMonthLabel(entry.month)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
