import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class LocationService {
    private readonly POSTCODES_IO_URL = 'https://api.postcodes.io/postcodes';
    private readonly NOMINATIM_API_URL = 'https://nominatim.openstreetmap.org/search';
    private readonly UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

    async getCoordinates(address: string): Promise<{ latitude: number; longitude: number }> {
        const trimmed = address.trim();

        if (this.UK_POSTCODE_REGEX.test(trimmed)) {
            const postcodeMatch = await this.lookupPostcode(trimmed);
            if (postcodeMatch) return postcodeMatch;
        }

        const nominatimMatch = await this.lookupNominatim(trimmed);
        if (nominatimMatch) return nominatimMatch;

        throw new NotFoundException(`Could not locate: ${address}`);
    }

    private async lookupPostcode(postcode: string): Promise<{ latitude: number; longitude: number } | null> {
        try {
            const response = await axios.get(`${this.POSTCODES_IO_URL}/${encodeURIComponent(postcode)}`);
            const result = response.data?.result;

            if (result) {
                return { latitude: result.latitude, longitude: result.longitude };
            }
        } catch (error) {
            console.error(`postcodes.io lookup failed for: ${postcode}`);
        }

        return null;
    }

    private async lookupNominatim(address: string): Promise<{ latitude: number; longitude: number } | null> {
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
        } catch (error) {
            console.error(`Nominatim lookup failed for: ${address}`);
        }

        return null;
    }
}
