import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { LocationService } from '../location/location.service';
import { Crime } from './interfaces/crime.interface';

@Injectable()
export class CrimeService {
    private readonly POLICE_API_URL = 'https://data.police.uk/api/crimes-street/all-crime';

    constructor(private readonly locationService: LocationService) {}

    async getCrimesByPostcode(postcode: string): Promise<Crime[]> {
        const { latitude, longitude } = await this.locationService.getCoordinates(postcode);

        try {
            const response = await axios.get(this.POLICE_API_URL, {
                params: {
                    lat: latitude,
                    lng: longitude,
                },
            });
            return response.data;
        } catch (error) {
            console.error('Police API request failed', error);
            return [];
        }
    }
}