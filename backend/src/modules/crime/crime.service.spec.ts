import { Test, TestingModule } from '@nestjs/testing';
import { CrimeService } from './crime.service';
import { LocationService } from '../location/location.service';
import { CacheService } from '../../shared/cache/cache.service';
import { DatabaseService } from '../../shared/database/database.service';
import { NotFoundException } from '@nestjs/common';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CrimeService', () => {
    let service: CrimeService;

    const mockLocationService = {
        getCoordinates: jest.fn(),
    };

    // Defaults to "not configured" so existing tests — many of which use
    // partial Crime fixtures missing `location`/`month` — never touch the
    // persistence path at all.
    const mockDatabaseService = {
        isConfigured: jest.fn().mockReturnValue(false),
        query: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        mockDatabaseService.isConfigured.mockReturnValue(false);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CrimeService,
                CacheService,
                {
                    provide: LocationService,
                    useValue: mockLocationService,
                },
                {
                    provide: DatabaseService,
                    useValue: mockDatabaseService,
                },
            ],
        }).compile();

        service = module.get(CrimeService);
    });

    /** Lets a fire-and-forget `void promise` inside getCrimesAt settle before assertions run. */
    const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getCrimesByPostcode', () => {
        it('propagates the NotFoundException when the location cannot be resolved', async () => {
            mockLocationService.getCoordinates.mockRejectedValue(
                new NotFoundException('Location not found'),
            );

            await expect(service.getCrimesByPostcode('INVALID_POSTCODE')).rejects.toThrow(
                NotFoundException,
            );

            expect(mockedAxios.get).not.toHaveBeenCalled();
        });

        it('queries the Police API with the resolved coordinates and returns its data', async () => {
            const mockCoords = { lat: 51.5074, lng: -0.1278 };
            const mockCrimes = [{ id: 1, category: 'anti-social-behaviour' }];

            mockLocationService.getCoordinates.mockResolvedValue(mockCoords);
            mockedAxios.get.mockResolvedValue({ data: mockCrimes });

            const result = await service.getCrimesByPostcode('SW1A 2AA');

            expect(mockedAxios.get).toHaveBeenCalledWith(
                'https://data.police.uk/api/crimes-street/all-crime',
                { params: { lat: mockCoords.lat, lng: mockCoords.lng } },
            );
            expect(result).toEqual(mockCrimes);
        });

        it('propagates a Police API failure rather than silently returning an empty list', async () => {
            mockLocationService.getCoordinates.mockResolvedValue({ lat: 51.5074, lng: -0.1278 });
            mockedAxios.get.mockRejectedValue(new Error('Police API unavailable'));

            await expect(service.getCrimesByPostcode('SW1A 2AA')).rejects.toThrow(
                'Police API unavailable',
            );
        });

        it('caches results per coordinate so a repeat search skips the network', async () => {
            mockLocationService.getCoordinates.mockResolvedValue({ lat: 51.5074, lng: -0.1278 });
            mockedAxios.get.mockResolvedValue({ data: [{ id: 1, category: 'burglary' }] });

            await service.getCrimesByPostcode('SW1A 2AA');
            await service.getCrimesByPostcode('SW1A 2AA');

            expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        });
    });

    describe('getTrendByPostcode', () => {
        it('returns one entry per month, oldest first, with the incident count for each', async () => {
            mockLocationService.getCoordinates.mockResolvedValue({ lat: 51.5074, lng: -0.1278 });
            mockedAxios.get
                .mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }] })
                .mockResolvedValueOnce({ data: [{ id: 3 }] })
                .mockResolvedValueOnce({ data: [] });

            const result = await service.getTrendByPostcode('SW1A 2AA', 3);

            expect(result).toHaveLength(3);
            expect(result.map((entry) => entry.total)).toEqual([2, 1, 0]);
            expect(result.every((entry) => /^\d{4}-\d{2}$/.test(entry.month))).toBe(true);
            // Oldest month first.
            expect(result[0].month < result[1].month).toBe(true);
            expect(result[1].month < result[2].month).toBe(true);
        });

        it('defaults a month to 0 if the Police API fails for it, instead of failing the whole trend', async () => {
            mockLocationService.getCoordinates.mockResolvedValue({ lat: 51.5074, lng: -0.1278 });
            mockedAxios.get
                .mockResolvedValueOnce({ data: [{ id: 1 }] })
                .mockRejectedValueOnce(new Error('Police API unavailable'));

            const result = await service.getTrendByPostcode('SW1A 2AA', 2);

            expect(result.map((entry) => entry.total)).toEqual([1, 0]);
        });
    });

    describe('write-through persistence to Postgres', () => {
        const fullCrime = {
            id: 42,
            category: 'burglary',
            location_type: 'Force',
            location: { latitude: 51.5074, longitude: -0.1278, street: { id: 7, name: 'On or near High Street' } },
            context: '',
            outcome_status: { category: 'Under investigation', date: '2026-05' },
            month: '2026-05',
        };

        beforeEach(() => {
            mockLocationService.getCoordinates.mockResolvedValue({ lat: 51.5074, lng: -0.1278 });
        });

        it('skips persistence entirely when the database is not configured', async () => {
            mockDatabaseService.isConfigured.mockReturnValue(false);
            mockedAxios.get.mockResolvedValue({ data: [fullCrime] });

            await service.getCrimesByPostcode('SW1A 2AA');
            await flushMicrotasks();

            expect(mockDatabaseService.query).not.toHaveBeenCalled();
        });

        it('archives fetched crimes and records the search ingestion when configured', async () => {
            mockDatabaseService.isConfigured.mockReturnValue(true);
            mockDatabaseService.query.mockResolvedValue({ rows: [] });
            mockedAxios.get.mockResolvedValue({ data: [fullCrime] });

            await service.getCrimesByPostcode('SW1A 2AA');
            await flushMicrotasks();

            expect(mockDatabaseService.query).toHaveBeenCalledTimes(2);

            const [crimesSql, crimesParams] = mockDatabaseService.query.mock.calls[0];
            expect(crimesSql).toContain('INSERT INTO crimes');
            expect(crimesSql).toContain('ON CONFLICT (id) DO NOTHING');
            expect(crimesParams).toEqual([
                fullCrime.id,
                fullCrime.category,
                fullCrime.month,
                fullCrime.location.latitude,
                fullCrime.location.longitude,
                fullCrime.location.street.id,
                fullCrime.location.street.name,
                fullCrime.outcome_status.category,
                fullCrime.outcome_status.date,
            ]);

            const [ingestionSql, ingestionParams] = mockDatabaseService.query.mock.calls[1];
            expect(ingestionSql).toContain('INSERT INTO crime_search_ingestions');
            expect(ingestionParams).toEqual([51.5074, -0.1278, '2026-05', 1]);
        });

        it('still records a zero-crime ingestion when nothing was found for an explicit month', async () => {
            mockDatabaseService.isConfigured.mockReturnValue(true);
            mockDatabaseService.query.mockResolvedValue({ rows: [] });
            mockedAxios.get.mockResolvedValue({ data: [] });

            await service.getTrendByPostcode('SW1A 2AA', 1);
            await flushMicrotasks();

            expect(mockDatabaseService.query).toHaveBeenCalledTimes(1);
            const [sql, params] = mockDatabaseService.query.mock.calls[0];
            expect(sql).toContain('INSERT INTO crime_search_ingestions');
            expect(params[3]).toBe(0);
        });

        it('does not persist again on a cache hit', async () => {
            mockDatabaseService.isConfigured.mockReturnValue(true);
            mockDatabaseService.query.mockResolvedValue({ rows: [] });
            mockedAxios.get.mockResolvedValue({ data: [fullCrime] });

            await service.getCrimesByPostcode('SW1A 2AA');
            await flushMicrotasks();
            await service.getCrimesByPostcode('SW1A 2AA');
            await flushMicrotasks();

            expect(mockDatabaseService.query).toHaveBeenCalledTimes(2);
        });

        it('still returns crimes to the caller even if archiving fails', async () => {
            mockDatabaseService.isConfigured.mockReturnValue(true);
            mockDatabaseService.query.mockRejectedValue(new Error('connection refused'));
            mockedAxios.get.mockResolvedValue({ data: [fullCrime] });

            const result = await service.getCrimesByPostcode('SW1A 2AA');
            await flushMicrotasks();

            expect(result).toEqual([fullCrime]);
        });
    });
});
