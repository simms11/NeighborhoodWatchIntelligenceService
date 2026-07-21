import { Test, TestingModule } from '@nestjs/testing';
import { CrimeService } from './crime.service';
import { LocationService } from '../location/location.service';
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

        it('returns an empty array when the Police API request fails', async () => {
            mockLocationService.getCoordinates.mockResolvedValue({ lat: 51.5074, lng: -0.1278 });
            mockedAxios.get.mockRejectedValue(new Error('Police API unavailable'));

            const result = await service.getCrimesByPostcode('SW1A 2AA');

            expect(result).toEqual([]);
        });
    });
});