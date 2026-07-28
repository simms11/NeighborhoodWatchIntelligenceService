import { renderHook, waitFor, act } from '@testing-library/react';
import { useLocationSearch } from './useLocationSearch';
import { fetchCrimes, fetchTrend } from '../services/api';
import { Crime } from '@neighborhood-watch/shared-types';

jest.mock('../services/api');

const mockedFetchCrimes = fetchCrimes as jest.MockedFunction<typeof fetchCrimes>;
const mockedFetchTrend = fetchTrend as jest.MockedFunction<typeof fetchTrend>;

const buildCrime = (overrides: Partial<Crime> = {}): Crime => ({
    id: 1,
    category: 'burglary',
    location_type: 'Force',
    location: { latitude: 51.5, longitude: -0.1, street: { id: 1, name: 'On or near Test Street' } },
    context: '',
    outcome_status: null,
    month: '2026-05',
    ...overrides,
});

describe('useLocationSearch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('does nothing for an empty query', async () => {
        const { result } = renderHook(() => useLocationSearch());

        await act(async () => {
            await result.current.search('');
        });

        expect(mockedFetchCrimes).not.toHaveBeenCalled();
        expect(result.current.loading).toBe(false);
    });

    it('populates crimes, label, and center from the first crime on a successful search', async () => {
        mockedFetchCrimes.mockResolvedValue([buildCrime()]);
        mockedFetchTrend.mockResolvedValue([{ month: '2026-05', total: 1 }]);

        const { result } = renderHook(() => useLocationSearch());

        await act(async () => {
            await result.current.search('SW1A 2AA');
        });

        expect(result.current.crimes).toHaveLength(1);
        expect(result.current.label).toBe('SW1A 2AA');
        expect(result.current.center).toEqual([51.5, -0.1]);
        expect(result.current.error).toBeNull();
        expect(result.current.loading).toBe(false);
    });

    it('sets an explanatory error and falls back to the default center when no crimes are found', async () => {
        mockedFetchCrimes.mockResolvedValue([]);
        mockedFetchTrend.mockResolvedValue([]);

        const { result } = renderHook(() => useLocationSearch());

        await act(async () => {
            await result.current.search('ZZ9 9ZZ');
        });

        expect(result.current.crimes).toEqual([]);
        expect(result.current.error).toMatch(/no crime data found/i);
        expect(result.current.center).toEqual([51.505, -0.09]);
    });

    it('surfaces a generic error and stops loading if the crimes fetch itself fails', async () => {
        mockedFetchCrimes.mockRejectedValue(new Error('Not Found'));

        const { result } = renderHook(() => useLocationSearch());

        await act(async () => {
            await result.current.search('SW1A 2AA');
        });

        expect(result.current.error).toMatch(/could not retrieve data/i);
        expect(result.current.loading).toBe(false);
        expect(mockedFetchTrend).not.toHaveBeenCalled();
    });

    it('does not fail the search when only the trend fetch fails', async () => {
        mockedFetchCrimes.mockResolvedValue([buildCrime()]);
        mockedFetchTrend.mockRejectedValue(new Error('rate limited'));

        const { result } = renderHook(() => useLocationSearch());

        await act(async () => {
            await result.current.search('SW1A 2AA');
        });

        expect(result.current.error).toBeNull();
        expect(result.current.crimes).toHaveLength(1);
        expect(result.current.trend).toEqual([]);
    });

    it('clears any previous trend before a new search resolves', async () => {
        mockedFetchCrimes.mockResolvedValue([buildCrime()]);
        mockedFetchTrend.mockResolvedValue([{ month: '2026-04', total: 5 }]);

        const { result } = renderHook(() => useLocationSearch());

        await act(async () => {
            await result.current.search('SW1A 2AA');
        });
        expect(result.current.trend).toHaveLength(1);

        let releaseTrend: (value: never[]) => void = () => {};
        mockedFetchTrend.mockReturnValue(new Promise((resolve) => (releaseTrend = resolve)));

        act(() => {
            void result.current.search('E1 6AN');
        });

        await waitFor(() => expect(result.current.trend).toEqual([]));

        await act(async () => {
            releaseTrend([]);
        });
    });
});
