import React from 'react';
import { MonthlyCrimeCount } from '../../../backend/src/modules/crime/crime.service';

export interface TrendSeries {
    label: string;
    color: string;
    data: MonthlyCrimeCount[];
}

interface TrendComparisonChartProps {
    series: TrendSeries[];
}

const formatMonthLabel = (month: string) => {
    const [year, m] = month.split('-').map(Number);
    if (!year || !m) return month;
    return new Date(year, m - 1).toLocaleDateString('en-GB', { month: 'short' });
};

export const TrendComparisonChart = ({ series }: TrendComparisonChartProps) => {
    const populated = series.filter((entry) => entry.data.length > 0);
    if (populated.length === 0) return null;

    const months = populated[0].data.map((entry) => entry.month);
    const max = Math.max(...populated.flatMap((entry) => entry.data.map((point) => point.total)), 1);

    return (
        <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
                    {months.length}-Month Trend Comparison
                </h3>
                <div className="flex items-center gap-4">
                    {populated.map((entry) => (
                        <span key={entry.label} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: entry.color }}
                                aria-hidden="true"
                            />
                            {entry.label}
                        </span>
                    ))}
                </div>
            </div>
            <div className="flex items-end gap-3 h-32">
                {months.map((month, index) => (
                    <div key={month} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
                        <div className="w-full h-full flex items-end justify-center gap-1">
                            {populated.map((entry) => {
                                const total = entry.data[index]?.total ?? 0;
                                return (
                                    <div
                                        key={entry.label}
                                        className="flex-1 max-w-4 rounded-t transition-all"
                                        style={{
                                            height: `${Math.max((total / max) * 100, 4)}%`,
                                            backgroundColor: entry.color,
                                        }}
                                        title={`${entry.label}: ${total} incidents in ${month}`}
                                    />
                                );
                            })}
                        </div>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
                            {formatMonthLabel(month)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
