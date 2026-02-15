'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

const MapComponent = dynamic(() => import('./MapComponent'), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-gray-100 flex items-center justify-center">Loading Map Engine...</div>
});

export const Map = (props: any) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    if (!mounted) return null;
    return <MapComponent {...props} />;
};