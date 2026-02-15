import { Test, TestingModule } from '@nestjs/testing';
import { LocationService } from './location.service';
import { HttpService } from '@nestjs/axios';
import { NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('LocationService', () => {
    let service: LocationService;
    let httpService: HttpService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                LocationService,
                {
                    provide: HttpService,
                    useValue: {
                        get: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get(LocationService);
        httpService = module.get(HttpService);
    });

    it('should return coordinates for a valid postcode', async () => {
        // ARRANGE
        const mockResponse = {
            data: { result: { latitude: 51.5, longitude: -0.12 } },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
        } as AxiosResponse;

        (httpService.get as jest.Mock).mockReturnValue(of(mockResponse));

        // ACT
        const result = await service.getCoordinates('SW1A 2AA');

        // ASSERT
        expect(result).toEqual({ lat: 51.5, lng: -0.12 });
        expect(httpService.get).toHaveBeenCalledWith(
            expect.stringContaining('SW1A2AA'),
        );
    });

    it('should throw NotFoundException if API returns 404', async () => {
        // ARRANGE
        const errorResponse = {
            response: { status: 404 },
        };

        (httpService.get as jest.Mock).mockReturnValue(throwError(() => errorResponse));

        // ACT & ASSERT
        await expect(service.getCoordinates('INVALID')).rejects.toThrow(
            NotFoundException,
        );
    });
});