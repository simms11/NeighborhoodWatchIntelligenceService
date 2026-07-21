import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PostcodeUtils } from '../../shared/utils/postcode.utils';
import { CacheService } from '../../shared/cache/cache.service';
import { Coordinates } from './interfaces/coordinates.interface';

const GEOCODE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // coordinates for a place don't change

@Injectable()
export class LocationService {
    private readonly POSTCODES_IO_URL = 'https://api.postcodes.io/postcodes';
    private readonly PHOTON_API_URL = 'https://photon.komoot.io/api/';

    constructor(private readonly cache: CacheService) {}

    async getCoordinates(address: string): Promise<Coordinates> {
        const trimmed = address.trim();
        const cacheKey = `geocode:${PostcodeUtils.normalize(trimmed)}`;

        return this.cache.getOrSet(cacheKey, GEOCODE_CACHE_TTL_MS, () => this.resolveCoordinates(trimmed));
    }

    private async resolveCoordinates(trimmed: string): Promise<Coordinates> {
        if (PostcodeUtils.isValidPostcode(trimmed)) {
            const formatted = PostcodeUtils.format(trimmed);
            const postcodeMatch = await this.lookupPostcode(formatted);
            if (postcodeMatch) return postcodeMatch;
        }

        const cityMatch = await this.lookupCityName(trimmed);
        if (cityMatch) return cityMatch;

        throw new NotFoundException(`Could not locate: ${trimmed}`);
    }

    private async lookupPostcode(postcode: string): Promise<Coordinates | null> {
        try {
            const response = await axios.get(`${this.POSTCODES_IO_URL}/${encodeURIComponent(postcode)}`);
            const result = response.data?.result;

            if (result) {
                return { lat: result.latitude, lng: result.longitude };
            }
        } catch (error) {
            // Retired postcodes 404 but postcodes.io still returns their last known
            // location under `terminated` — that's still a valid place to search.
            const terminated = axios.isAxiosError(error) ? error.response?.data?.terminated : undefined;
            if (terminated?.latitude != null && terminated?.longitude != null) {
                return { lat: terminated.latitude, lng: terminated.longitude };
            }
            console.error(`postcodes.io lookup failed for: ${postcode}`);
        }

        return null;
    }

    private async lookupCityName(address: string): Promise<Coordinates | null> {
        try {
            const response = await axios.get(this.PHOTON_API_URL, {
                params: {
                    q: address,
                    limit: 1,
                },
            });

            const bestMatch = response.data?.features?.[0];
            if (bestMatch) {
                const [lng, lat] = bestMatch.geometry.coordinates;
                return { lat, lng };
            }
        } catch (error) {
            console.error(`Photon lookup failed for: ${address}`);
        }

        return null;
    }
}
