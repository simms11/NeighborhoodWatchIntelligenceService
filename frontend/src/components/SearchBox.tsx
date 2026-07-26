'use client';

import React, { useState } from 'react';

interface SearchBoxProps {
    onSearch: (query: string) => void;
    isLoading: boolean;
}

export const SearchBox = ({ onSearch, isLoading }: SearchBoxProps) => {
    const [query, setQuery] = useState('');

    // Only collapse redundant whitespace here — postcode formatting (spacing,
    // casing) is the backend's job, since stripping spaces entirely breaks
    // the freeform geocoding fallback for postcodes that need it.
    const sanitizeQuery = (raw: string) => raw.trim().replace(/\s+/g, ' ');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const cleanQuery = sanitizeQuery(query);
        if (cleanQuery) {
            onSearch(cleanQuery);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
            <label htmlFor="postcode" className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Location Search
            </label>
            <div className="flex gap-2">
                <input
                    id="postcode"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. SW1A 2AA, London, Manchester"
                    disabled={isLoading}
                    className="flex-1 min-w-0 px-3 py-2 min-h-11 sm:min-h-0 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base sm:text-sm transition-shadow"
                />
                <button
                    type="submit"
                    disabled={isLoading || !query.trim()}
                    className="px-4 py-2 min-h-11 sm:min-h-0 min-w-11 sm:min-w-0 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 transition-colors shadow-sm"
                >
                    {isLoading ? '...' : 'Search'}
                </button>
            </div>
        </form>
    );
};