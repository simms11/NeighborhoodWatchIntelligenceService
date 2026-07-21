import { Test, TestingModule } from '@nestjs/testing';
import { LocationService } from './location.service';
import { NotFoundException } from '@nestjs/common';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('LocationService', () => {
    let service: LocationService;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockedAxios.isAxiosError.mockReturnValue(false);

        const module: TestingModule = await Test.createTestingModule({
            providers: [LocationService],
        }).compile();

        service = module.get(LocationService);
    });

    it('formats and resolves a valid postcode via postcodes.io', async () => {
        mockedAxios.get.mockResolvedValue({
            data: { result: { latitude: 51.5, longitude: -0.12 } },
        });

        const result = await service.getCoordinates('sw1a2aa');

        expect(result).toEqual({ lat: 51.5, lng: -0.12 });
        expect(mockedAxios.get).toHaveBeenCalledWith(
            expect.stringContaining(encodeURIComponent('SW1A 2AA')),
        );
    });

    it('falls back to the terminated-postcode coordinates when postcodes.io 404s with one', async () => {
        const error = {
            response: {
                data: {
                    status: 404,
                    error: 'Postcode not found',
                    terminated: { postcode: 'M1 1AG', latitude: 53.483298, longitude: -2.231452 },
                },
            },
        };
        mockedAxios.get.mockRejectedValue(error);
        mockedAxios.isAxiosError.mockReturnValue(true);

        const result = await service.getCoordinates('M1 1AG');

        expect(result).toEqual({ lat: 53.483298, lng: -2.231452 });
        // Should not have fallen through to the Photon geocoder.
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('falls back to Photon when a postcode-shaped query has no postcodes.io match at all', async () => {
        mockedAxios.get
            .mockRejectedValueOnce({ response: { data: { status: 404 } } })
            .mockResolvedValueOnce({
                data: { features: [{ geometry: { coordinates: [-2.2314725, 53.4832925] } }] },
            });
        mockedAxios.isAxiosError.mockReturnValue(true);

        const result = await service.getCoordinates('ZZ1 1AG');

        expect(result).toEqual({ lat: 53.4832925, lng: -2.2314725 });
        expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('queries Photon directly for a freeform city name', async () => {
        mockedAxios.get.mockResolvedValue({
            data: { features: [{ geometry: { coordinates: [-2.2324547, 53.4424618] } }] },
        });

        const result = await service.getCoordinates('Manchester');

        expect(result).toEqual({ lat: 53.4424618, lng: -2.2324547 });
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        expect(mockedAxios.get).toHaveBeenCalledWith(
            'https://photon.komoot.io/api/',
            { params: { q: 'Manchester', limit: 1 } },
        );
    });

    it('throws NotFoundException when nothing resolves the location', async () => {
        mockedAxios.get.mockRejectedValue(new Error('network error'));

        await expect(service.getCoordinates('Nowhereville')).rejects.toThrow(NotFoundException);
    });
});
