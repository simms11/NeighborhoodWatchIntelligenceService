import React, { useState } from 'react';

interface SearchBoxProps {
    onSearch: (postcode: string) => void;
    isLoading: boolean;
}

export const SearchBox = ({ onSearch, isLoading }: SearchBoxProps) => {
    const [postcode, setPostcode] = useState('');

    const sanitizePostcode = (raw: string) => {
        // Remove all spaces and convert to uppercase
        // Example: "m1 1ag" -> "M11AG"
        // Example: "sw1a 1aa" -> "SW1A1AA"
        return raw.replace(/\s+/g, '').toUpperCase();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const cleanPostcode = sanitizePostcode(postcode);

        if (cleanPostcode) {
            onSearch(cleanPostcode);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-full">
            <label htmlFor="postcode" className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Location Search
            </label>
            <div className="flex flex-nowrap gap-2">
                <input
                    id="postcode"
                    type="text"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    placeholder="e.g. SW1A 2AA, London, Manchester"
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    className="whitespace-nowrap px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-all shadow-sm"
                >
                    {isLoading ? '...' : 'Search'}
                </button>
            </div>
        </form>
    );
};