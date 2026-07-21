'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import type { CrimeDataset } from './MapComponent';

const MapComponent = dynamic(() => import('./MapComponent'), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-gray-100 flex items-center justify-center">Loading Map Engine...</div>
});

interface MapProps {
    datasets: CrimeDataset[];
    center: [number, number];
}

export const Map = (props: MapProps) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    if (!mounted) return null;
    return <MapComponent {...props} />;
};
