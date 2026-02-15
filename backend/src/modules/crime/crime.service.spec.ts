import { Test, TestingModule } from '@nestjs/testing';
import { CrimeService } from './crime.service';
import { LocationService } from '../location/location.service';
import { NotFoundException } from '@nestjs/common';

describe('CrimeService', () => {
    let service: CrimeService;
    let locationService: LocationService;

    const mockLocationService = {
        getCoordinates: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CrimeService,
                {
                    provide: LocationService,
                    useValue: mockLocationService,
                },
            ],
        }).compile();

        service = module.get(CrimeService) as any;
        locationService = module.get(LocationService) as any;
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getCrimesByPostcode', () => {
        it('should throw NotFoundException when postcode is invalid', async () => {
            mockLocationService.getCoordinates.mockRejectedValue(
                new NotFoundException('Location not found'),
            );

            await expect(service.getCrimesByPostcode('INVALID_POSTCODE')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should return crime data for a valid postcode', async () => {
            const mockCoords = { latitude: 51.5074, longitude: -0.1278 };
            mockLocationService.getCoordinates.mockResolvedValue(mockCoords);

            const result = await service.getCrimesByPostcode('SW1A 2AA');

            expect(Array.isArray(result)).toBe(true);
        });
    });
});