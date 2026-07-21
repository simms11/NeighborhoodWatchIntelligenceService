import React from 'react';
import { SearchBox } from './SearchBox';
import { CrimeStats } from './CrimeStats';
import { TrendChart } from './TrendChart';
import { StatsSkeleton } from './StatsSkeleton';
import { LocationSearchState } from '../hooks/useLocationSearch';

interface LocationPanelProps {
    title: string;
    accentColor: string;
    state: LocationSearchState;
    onSearch: (query: string) => void;
    showTrend?: boolean;
}

export const LocationPanel = ({ title, accentColor, state, onSearch, showTrend = true }: LocationPanelProps) => {
    const { label, loading, error, crimes, trend } = state;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: accentColor }}
                    aria-hidden="true"
                />
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    {title}
                    {label && <span className="normal-case font-semibold text-gray-600 dark:text-gray-300"> · {label}</span>}
                </h2>
            </div>

            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                <SearchBox onSearch={onSearch} isLoading={loading} />
            </div>

            {error && (
                <div role="alert" className="p-3 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg">
                    {error}
                </div>
            )}

            {loading ? (
                <StatsSkeleton />
            ) : (
                <>
                    <CrimeStats crimes={crimes} />
                    {showTrend && <TrendChart data={trend} />}
                </>
            )}
        </div>
    );
};
