import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class LocationService {
    private readonly NOMINATIM_API_URL = 'https://nominatim.openstreetmap.org/search';

    async getCoordinates(address: string): Promise<{ latitude: number; longitude: number }> {
        try {
            const response = await axios.get(this.NOMINATIM_API_URL, {
                params: {
                    q: address,
                    format: 'json',
                    limit: 1,
                },
                headers: {
                    'User-Agent': 'NeighborhoodWatchApp/1.0',
                },
            });

            if (response.data && response.data.length > 0) {
                const bestMatch = response.data[0];
                return {
                    latitude: parseFloat(bestMatch.lat),
                    longitude: parseFloat(bestMatch.lon),
                };
            }

            throw new Error('No results found');
        } catch (error) {
            console.error(`Geocoding failed for: ${address}`);
            throw new NotFoundException(`Could not locate: ${address}`);
        }
    }
}