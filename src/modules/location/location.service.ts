import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Coordinates } from './interfaces/coordinates.interface';

@Injectable()
export class LocationService {
    private readonly logger = new Logger(LocationService.name);

    constructor(private readonly httpService: HttpService) {}

    async getCoordinates(postcode: string): Promise<Coordinates> {
        const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();

        try {
            const { data } = await firstValueFrom(
                this.httpService.get(`https://api.postcodes.io/postcodes/${cleanPostcode}`)
            );

            if (!data || !data.result) {
                throw new NotFoundException('Postcode coordinates not found');
            }

            return {
                lat: data.result.latitude,
                lng: data.result.longitude,
            };
        } catch (error: any) {
            if (error.response?.status === 404) {
                throw new NotFoundException(`Location not found for postcode: ${postcode}`);
            }
            this.logger.error(`Location API error: ${error.message}`);
            throw error;
        }
    }
}