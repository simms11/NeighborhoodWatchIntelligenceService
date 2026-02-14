import { Test, TestingModule } from '@nestjs/testing';
import { CrimeService } from './crime.service';
import { LocationService } from '../location/location.service';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { BadRequestException } from '@nestjs/common';
import { AxiosResponse } from 'axios';

describe('CrimeService', () => {
    let service: CrimeService;
    let locationService: LocationService;
    let httpService: HttpService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CrimeService,
                {
                    provide: LocationService,
                    useValue: {
                        getCoordinates: jest.fn(),
                    },
                },
                {
                    provide: HttpService,
                    useValue: {
                        get: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get(CrimeService);
        locationService = module.get(LocationService);
        httpService = module.get(HttpService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should throw BadRequest for invalid postcode format', async () => {
        await expect(service.findCrimesByPostcode('INVALID_POSTCODE')).rejects.toThrow(
            BadRequestException,
        );
    });

    it('should return mapped crimes for a valid postcode', async () => {
        // ARRANGE
        const mockCoords = { lat: 51.5, lng: -0.12 };
        (locationService.getCoordinates as jest.Mock).mockResolvedValue(mockCoords);

        // 2. Mock the Police API response
        const mockPoliceData = {
            data: [
                {
                    id: 12345,
                    category: 'burglary',
                    location_type: 'Force',
                    location: {
                        latitude: '51.5000',
                        longitude: '-0.1200',
                        street: { id: 999, name: 'Downing Street' },
                    },
                    context: '',
                    outcome_status: null,
                    month: '2024-01',
                },
            ],
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
        } as AxiosResponse;

        (httpService.get as jest.Mock).mockReturnValue(of(mockPoliceData));

        // ACT
        const result = await service.findCrimesByPostcode('SW1A 2AA');

        // ASSERT
        expect(locationService.getCoordinates).toHaveBeenCalledWith('SW1A2AA');

        expect(httpService.get).toHaveBeenCalledWith(
            expect.stringContaining('lat=51.5&lng=-0.12'),
        );

        expect(result[0].location.latitude).toBe(51.5);
        expect(result[0].location.longitude).toBe(-0.12);
        expect(result[0].category).toBe('burglary');
    });
});