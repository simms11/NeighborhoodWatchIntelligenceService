import { Test, TestingModule } from '@nestjs/testing';
import { CrimeService } from './crime.service';
import { LocationService } from '../location/location.service';
import { CacheService } from '../../shared/cache/cache.service';
import { NotFoundException } from '@nestjs/common';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CrimeService', () => {
    let service: CrimeService;

    const mockLocationService = {
        getCoordinates: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CrimeService,
                CacheService,
                {
                    provide: LocationService,
                    useValue: mockLocationService,
                },
            ],
        }).compile();

        service = module.get(CrimeService);
    });

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
});
