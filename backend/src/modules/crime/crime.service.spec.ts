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

      await expect(
        service.getCrimesByPostcode('INVALID_POSTCODE'),
      ).rejects.toThrow(NotFoundException);

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
      mockLocationService.getCoordinates.mockResolvedValue({
        lat: 51.5074,
        lng: -0.1278,
      });
      mockedAxios.get.mockRejectedValue(new Error('Police API unavailable'));

      await expect(service.getCrimesByPostcode('SW1A 2AA')).rejects.toThrow(
        'Police API unavailable',
      );
    });

    it('caches results per coordinate so a repeat search skips the network', async () => {
      mockLocationService.getCoordinates.mockResolvedValue({
        lat: 51.5074,
        lng: -0.1278,
      });
      mockedAxios.get.mockResolvedValue({
        data: [{ id: 1, category: 'burglary' }],
      });

      await service.getCrimesByPostcode('SW1A 2AA');
      await service.getCrimesByPostcode('SW1A 2AA');

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTrendByPostcode', () => {
    it('returns one entry per month, oldest first, with the incident count for each', async () => {
      mockLocationService.getCoordinates.mockResolvedValue({
        lat: 51.5074,
        lng: -0.1278,
      });
      mockedAxios.get
        .mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }] })
        .mockResolvedValueOnce({ data: [{ id: 3 }] })
        .mockResolvedValueOnce({ data: [] });

      const result = await service.getTrendByPostcode('SW1A 2AA', 3);

      expect(result).toHaveLength(3);
      expect(result.map((entry) => entry.total)).toEqual([2, 1, 0]);
      expect(result.every((entry) => /^\d{4}-\d{2}$/.test(entry.month))).toBe(
        true,
      );
      // Oldest month first.
      expect(result[0].month < result[1].month).toBe(true);
      expect(result[1].month < result[2].month).toBe(true);
    });

    it('defaults a month to 0 if the Police API fails for it, instead of failing the whole trend', async () => {
      mockLocationService.getCoordinates.mockResolvedValue({
        lat: 51.5074,
        lng: -0.1278,
      });
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
      persistent_id: 'abc123def456',
      category: 'burglary',
      location_type: 'Force',
      location: {
        latitude: 51.5074,
        longitude: -0.1278,
        street: { id: 7, name: 'On or near High Street' },
      },
      context: '',
      outcome_status: { category: 'Under investigation', date: '2026-05' },
      month: '2026-05',
    };

    beforeEach(() => {
      mockLocationService.getCoordinates.mockResolvedValue({
        lat: 51.5074,
        lng: -0.1278,
      });
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

      // Calls[0] is the archive lookup (returns empty, falls through to live).
      expect(mockDatabaseService.query).toHaveBeenCalledTimes(3);

      const [crimesSql, crimesParams] = mockDatabaseService.query.mock.calls[1];
      expect(crimesSql).toContain('INSERT INTO crimes');
      expect(crimesSql).toContain(
        'ON CONFLICT (source_id) WHERE source_id IS NOT NULL DO NOTHING',
      );
      expect(crimesParams).toEqual([
        fullCrime.id,
        fullCrime.persistent_id,
        fullCrime.category,
        fullCrime.month,
        fullCrime.location.latitude,
        fullCrime.location.longitude,
        fullCrime.location.street.id,
        fullCrime.location.street.name,
        fullCrime.outcome_status.category,
        fullCrime.outcome_status.date,
      ]);

      const [ingestionSql, ingestionParams] =
        mockDatabaseService.query.mock.calls[2];
      expect(ingestionSql).toContain('INSERT INTO crime_search_ingestions');
      expect(ingestionParams).toEqual([51.5074, -0.1278, '2026-05', 1]);
    });

    it('stores a blank persistent_id as null rather than an empty string', async () => {
      mockDatabaseService.isConfigured.mockReturnValue(true);
      mockDatabaseService.query.mockResolvedValue({ rows: [] });
      mockedAxios.get.mockResolvedValue({
        data: [{ ...fullCrime, persistent_id: '' }],
      });

      await service.getCrimesByPostcode('SW1A 2AA');
      await flushMicrotasks();

      const [, crimesParams] = mockDatabaseService.query.mock.calls[1];
      expect(crimesParams[1]).toBeNull();
    });

    it('still records a zero-crime ingestion when nothing was found for an explicit month', async () => {
      mockDatabaseService.isConfigured.mockReturnValue(true);
      mockDatabaseService.query.mockResolvedValue({ rows: [] });
      mockedAxios.get.mockResolvedValue({ data: [] });

      await service.getTrendByPostcode('SW1A 2AA', 1);
      await flushMicrotasks();

      // Calls[0] is the archive lookup (returns empty, falls through to live).
      expect(mockDatabaseService.query).toHaveBeenCalledTimes(2);
      const [sql, params] = mockDatabaseService.query.mock.calls[1];
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

      // 1 archive lookup + 1 crimes insert + 1 ingestion insert from the
      // first (uncached) call; the second call is served entirely from
      // the in-memory cache and never touches the database.
      expect(mockDatabaseService.query).toHaveBeenCalledTimes(3);
    });

    it('still returns crimes to the caller even if archiving fails', async () => {
      mockDatabaseService.isConfigured.mockReturnValue(true);
      mockDatabaseService.query.mockRejectedValue(
        new Error('connection refused'),
      );
      mockedAxios.get.mockResolvedValue({ data: [fullCrime] });

      const result = await service.getCrimesByPostcode('SW1A 2AA');
      await flushMicrotasks();

      expect(result).toEqual([fullCrime]);
    });
  });

  describe('archive-first reads', () => {
    const archivedRow = {
      source_id: '135677814',
      persistent_id: null,
      category: 'burglary',
      latitude: 51.5074,
      longitude: -0.1278,
      street_id: null,
      street_name: 'On or near High Street',
      outcome_category: 'Under investigation',
      outcome_date: null,
      month: new Date('2026-05-01T00:00:00.000Z'),
    };

    beforeEach(() => {
      mockLocationService.getCoordinates.mockResolvedValue({
        lat: 51.5074,
        lng: -0.1278,
      });
      mockDatabaseService.isConfigured.mockReturnValue(true);
    });

    it('serves from the archive and never calls Police.uk when a match is found', async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [archivedRow] });

      const result = await service.getCrimesByPostcode('SW1A 2AA');

      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(mockDatabaseService.query).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        {
          id: 135677814,
          persistent_id: undefined,
          category: 'burglary',
          location_type: 'Force',
          location: {
            latitude: 51.5074,
            longitude: -0.1278,
            street: { id: 0, name: 'On or near High Street' },
          },
          context: '',
          outcome_status: { category: 'Under investigation', date: '' },
          month: '2026-05',
        },
      ]);
    });

    it('queries with a bounding box derived from the search point, not an exact match', async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [archivedRow] });

      await service.getCrimesByPostcode('SW1A 2AA');

      const [sql, params] = mockDatabaseService.query.mock.calls[0];
      expect(sql).toContain('BETWEEN');
      const [, latMin, latMax, lngMin, lngMax] = params as number[];
      expect(latMin).toBeLessThan(51.5074);
      expect(latMax).toBeGreaterThan(51.5074);
      expect(lngMin).toBeLessThan(-0.1278);
      expect(lngMax).toBeGreaterThan(-0.1278);
    });

    it('falls back to Police.uk live when the archive has nothing for that month', async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [] });
      mockedAxios.get.mockResolvedValue({ data: [] });

      await service.getCrimesByPostcode('SW1A 2AA');

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('falls back to Police.uk live if the archive lookup itself fails', async () => {
      mockDatabaseService.query.mockRejectedValue(
        new Error('connection refused'),
      );
      mockedAxios.get.mockResolvedValue({ data: [] });

      const result = await service.getCrimesByPostcode('SW1A 2AA');

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });

    it('does not apply the trend rate-limit delay for months served from the archive', async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [archivedRow] });

      const start = Date.now();
      const result = await service.getTrendByPostcode('SW1A 2AA', 3);
      const elapsedMs = Date.now() - start;

      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(result.every((entry) => entry.total === 1)).toBe(true);
      expect(elapsedMs).toBeLessThan(150);
    });
  });

  describe('refreshTrackedLocations', () => {
    const trackedLocations = [
      { latitude: 51.5074, longitude: -0.1278 },
      { latitude: 53.4808, longitude: -2.2426 },
    ];
    const refreshCrime = {
      id: 99,
      category: 'burglary',
      location_type: 'Force',
      location: {
        latitude: 53.4808,
        longitude: -2.2426,
        street: { id: 3, name: 'On or near Test Street' },
      },
      context: '',
      outcome_status: null,
      month: '2026-05',
    };

    it('does nothing when the database is not configured', async () => {
      mockDatabaseService.isConfigured.mockReturnValue(false);

      await service.refreshTrackedLocations();

      expect(mockDatabaseService.query).not.toHaveBeenCalled();
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('skips locations already ingested for the latest month, and fetches the ones that are missing it', async () => {
      mockDatabaseService.isConfigured.mockReturnValue(true);
      mockDatabaseService.query.mockImplementation(
        (sql: string, params?: unknown[]) => {
          if (sql.includes('DISTINCT latitude')) {
            return Promise.resolve({ rows: trackedLocations });
          }
          if (sql.startsWith('SELECT 1 FROM crime_search_ingestions')) {
            const [latitude] = params as [number, number, string];
            const alreadyCurrent = latitude === trackedLocations[0].latitude;
            return Promise.resolve({
              rowCount: alreadyCurrent ? 1 : 0,
              rows: [],
            });
          }
          return Promise.resolve({ rows: [] });
        },
      );
      mockedAxios.get.mockResolvedValue({ data: [refreshCrime] });

      await service.refreshTrackedLocations();

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://data.police.uk/api/crimes-street/all-crime',
        {
          params: {
            lat: trackedLocations[1].latitude,
            lng: trackedLocations[1].longitude,
            date: expect.stringMatching(/^\d{4}-\d{2}$/),
          },
        },
      );
    });

    it('keeps refreshing remaining locations if one fails', async () => {
      mockDatabaseService.isConfigured.mockReturnValue(true);
      mockDatabaseService.query.mockImplementation((sql: string) => {
        if (sql.includes('DISTINCT latitude')) {
          return Promise.resolve({ rows: trackedLocations });
        }
        if (sql.startsWith('SELECT 1 FROM crime_search_ingestions')) {
          return Promise.resolve({ rowCount: 0, rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });
      mockedAxios.get
        .mockRejectedValueOnce(new Error('Police API unavailable'))
        .mockResolvedValueOnce({ data: [refreshCrime] });

      await service.refreshTrackedLocations();

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('logs but does not throw if loading tracked locations fails', async () => {
      mockDatabaseService.isConfigured.mockReturnValue(true);
      mockDatabaseService.query.mockRejectedValue(
        new Error('connection refused'),
      );

      await expect(service.refreshTrackedLocations()).resolves.toBeUndefined();
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });
});
