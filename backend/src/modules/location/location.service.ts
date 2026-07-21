import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class LocationService {
    private readonly POSTCODES_IO_URL = 'https://api.postcodes.io/postcodes';
    private readonly PHOTON_API_URL = 'https://photon.komoot.io/api/';
    private readonly UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

    async getCoordinates(address: string): Promise<{ latitude: number; longitude: number }> {
        const trimmed = address.trim();

        if (this.UK_POSTCODE_REGEX.test(trimmed)) {
            const postcodeMatch = await this.lookupPostcode(trimmed);
            if (postcodeMatch) return postcodeMatch;
        }

        const cityMatch = await this.lookupCityName(trimmed);
        if (cityMatch) return cityMatch;

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

    private async lookupCityName(address: string): Promise<{ latitude: number; longitude: number } | null> {
        try {
            const response = await axios.get(this.PHOTON_API_URL, {
                params: {
                    q: address,
                    limit: 1,
                },
            });

            const bestMatch = response.data?.features?.[0];
            if (bestMatch) {
                const [longitude, latitude] = bestMatch.geometry.coordinates;
                return { latitude, longitude };
            }
        } catch (error) {
            console.error(`Photon lookup failed for: ${address}`);
        }

        return null;
    }
}
