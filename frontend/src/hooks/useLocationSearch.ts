'use client';

import { useState } from 'react';
import { Crime, MonthlyCrimeCount } from '../../../backend/src/modules/crime/interfaces/crime.interface';
import { fetchCrimes, fetchTrend } from '../services/api';

export interface LocationSearchState {
    label: string;
    crimes: Crime[];
    trend: MonthlyCrimeCount[];
    center: [number, number] | null;
    loading: boolean;
    error: string | null;
    search: (query: string) => Promise<void>;
}

const DEFAULT_CENTER: [number, number] = [51.505, -0.09]; // London

export function useLocationSearch(): LocationSearchState {
    const [label, setLabel] = useState('');
    const [crimes, setCrimes] = useState<Crime[]>([]);
    const [trend, setTrend] = useState<MonthlyCrimeCount[]>([]);
    const [center, setCenter] = useState<[number, number] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const search = async (query: string) => {
        if (!query) return;

        setLoading(true);
        setError(null);
        setTrend([]);

        try {
            // Fetched one after the other, not in parallel — Police.uk's public
            // API rate-limits fairly aggressively, so we avoid bursting it with
            // simultaneous requests from a single search.
            const crimeData = await fetchCrimes(query);

            setCrimes(crimeData);
            setLabel(query);

            if (crimeData.length > 0 && crimeData[0].location) {
                setCenter([Number(crimeData[0].location.latitude), Number(crimeData[0].location.longitude)]);
            } else {
                setCenter(DEFAULT_CENTER);
                setError(
                    'No crime data found for this location. Ensure the postcode is valid for England, Wales, or Northern Ireland.',
                );
            }
        } catch (err) {
            console.error('Search error:', err);
            setError('Could not retrieve data. Please check your connection or postcode.');
            setLoading(false);
            return;
        }

        setLoading(false);

        // The trend chart is a nice-to-have; don't fail the whole search
        // over it, and don't block the primary result on it either.
        try {
            const trendData = await fetchTrend(query);
            setTrend(trendData);
        } catch (err) {
            console.error('Trend fetch failed:', err);
        }
    };

    return { label, crimes, trend, center, loading, error, search };
}
