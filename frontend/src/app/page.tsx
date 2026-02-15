'use client';

import { useState, useEffect } from 'react';
import { Map as CrimeMap } from '@/components/Map/DynamicMap';
import { SearchBox } from '@/components/SearchBox';
import { CrimeStats } from '@/components/CrimeStats';
import { fetchCrimes } from '@/services/api';
import 'leaflet/dist/leaflet.css';
import { Crime } from '../../../backend/src/modules/crime/interfaces/crime.interface';

export default function NeighborhoodDashboard() {
  const [crimes, setCrimes] = useState<Crime[]>([]);
  const [loading, setLoading] = useState(false);
  const [center, setCenter] = useState<[number, number]>([51.505, -0.09]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSearch = async (postcode: string) => {
    if (!postcode) return;
    setLoading(true);
    try {
      const data = await fetchCrimes(postcode);
      setCrimes(data);
      if (data.length > 0 && data[0].location) {
        setCenter([
          Number(data[0].location.latitude),
          Number(data[0].location.longitude)
        ]);
      } else {
        alert("No crime data found for this location. Ensure the postcode is valid for England, Wales, or Northern Ireland.");
      }
    } catch (err) {
      console.error('Search error:', err);
      alert("Could not retrieve data. Please check your connection or postcode.");
    } finally {
      setLoading(false);
    }
  };

  if (!isMounted) return null;

  return (
      <main className="min-h-screen p-4 md:p-8 bg-gray-50 text-gray-900">
        <div className="max-w-7xl mx-auto space-y-8">
          <header className="border-b border-gray-200 pb-6">
            <h1 className="text-4xl font-extrabold tracking-tight">Neighborhood Watch</h1>
            <p className="text-gray-500">UK Open Data Crime Visualization</p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_3fr] gap-8 items-start">

            <aside className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <SearchBox onSearch={handleSearch} isLoading={loading} />
              </div>
              <CrimeStats crimes={crimes} />
            </aside>

            <section className="h-[600px] w-full">
              <div className="h-full w-full rounded-xl overflow-hidden border border-gray-200 shadow-md bg-white relative z-0">
                {/* animation enabled */}
                <CrimeMap
                    crimes={crimes}
                    center={center}
                />
              </div>
            </section>
          </div>
        </div>
      </main>
  );
}