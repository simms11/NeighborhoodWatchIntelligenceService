'use client';

import { useState, useEffect } from 'react';
import { Map as CrimeMap } from '@/components/Map/DynamicMap';
import { LocationPanel } from '@/components/LocationPanel';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MapLegend } from '@/components/MapLegend';
import { TrendComparisonChart } from '@/components/TrendComparisonChart';
import { useLocationSearch } from '@/hooks/useLocationSearch';

const PRIMARY_COLOR = '#2563eb'; // blue-600
const SECONDARY_COLOR = '#dc2626'; // red-600
const DEFAULT_CENTER: [number, number] = [51.505, -0.09]; // London

export default function NeighborhoodDashboard() {
  const [isMounted, setIsMounted] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [focusedPanel, setFocusedPanel] = useState<'primary' | 'secondary'>('primary');

  const primary = useLocationSearch();
  const secondary = useLocationSearch();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  const handlePrimarySearch = (query: string) => {
    setFocusedPanel('primary');
    void primary.search(query);
  };

  const handleSecondarySearch = (query: string) => {
    setFocusedPanel('secondary');
    void secondary.search(query);
  };

  // Re-center on whichever panel was searched most recently, so a second
  // search doesn't get stuck on Location A's view.
  const focused = focusedPanel === 'secondary' ? secondary : primary;
  const center = focused.center ?? primary.center ?? secondary.center ?? DEFAULT_CENTER;

  const primaryLabel = primary.label || 'Location A';
  const secondaryLabel = secondary.label || 'Location B';

  const datasets = [
    { label: primaryLabel, color: PRIMARY_COLOR, crimes: primary.crimes },
    ...(compareMode ? [{ label: secondaryLabel, color: SECONDARY_COLOR, crimes: secondary.crimes }] : []),
  ];

  const legendEntries = datasets
      .filter((dataset) => dataset.crimes.length > 0)
      .map((dataset) => ({ label: dataset.label, color: dataset.color, count: dataset.crimes.length }));

  return (
      <main className="min-h-screen p-4 md:p-8 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
        <div className="max-w-7xl mx-auto space-y-8">
          <header className="border-b border-gray-200 dark:border-gray-800 pb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight">Neighborhood Watch</h1>
              <p className="text-gray-500 dark:text-gray-400">UK Open Data Crime Visualization</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                  type="button"
                  onClick={() => setCompareMode((prev) => !prev)}
                  className="text-sm font-semibold px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {compareMode ? 'Exit Compare' : 'Compare Locations'}
              </button>
              <ThemeToggle />
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_3fr] gap-8 items-start">
            <aside className="space-y-8">
              <LocationPanel
                  title="Location A"
                  accentColor={PRIMARY_COLOR}
                  state={primary}
                  onSearch={handlePrimarySearch}
                  showTrend={!compareMode}
              />
              {compareMode && (
                  <LocationPanel
                      title="Location B"
                      accentColor={SECONDARY_COLOR}
                      state={secondary}
                      onSearch={handleSecondarySearch}
                      showTrend={!compareMode}
                  />
              )}
            </aside>

            <section className="h-[600px] w-full">
              <div className="h-full w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-md bg-white dark:bg-gray-900 relative z-0">
                <CrimeMap
                    datasets={datasets}
                    center={center}
                />
                <MapLegend entries={legendEntries} />
              </div>
            </section>
          </div>

          {compareMode && (
              <TrendComparisonChart
                  series={[
                    { label: primaryLabel, color: PRIMARY_COLOR, data: primary.trend },
                    { label: secondaryLabel, color: SECONDARY_COLOR, data: secondary.trend },
                  ]}
              />
          )}
        </div>
      </main>
  );
}
