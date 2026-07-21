import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { LocationService } from '../location/location.service';
import { CacheService } from '../../shared/cache/cache.service';
import { Crime, MonthlyCrimeCount } from './interfaces/crime.interface';

const CRIME_CACHE_TTL_MS = 60 * 60 * 1000; // Police.uk data only refreshes monthly

@Injectable()
export class CrimeService {
    private readonly POLICE_API_URL = 'https://data.police.uk/api/crimes-street/all-crime';

    constructor(
        private readonly locationService: LocationService,
        private readonly cache: CacheService,
    ) {}

    async getCrimesByPostcode(postcode: string): Promise<Crime[]> {
        const { lat, lng } = await this.locationService.getCoordinates(postcode);
        return this.getCrimesAt(lat, lng);
    }

    /**
     * Month-by-month incident counts for the trend view, oldest first.
     *
     * Fetched sequentially rather than in parallel — Police.uk's public API
     * rate-limits fairly aggressively, and firing several concurrent
     * requests for one trend lookup (on top of the main search) was enough
     * to trip it.
     */
    async getTrendByPostcode(postcode: string, months = 12): Promise<MonthlyCrimeCount[]> {
        const { lat, lng } = await this.locationService.getCoordinates(postcode);
        const monthKeys = this.lastNMonthKeys(months);

        const counts: MonthlyCrimeCount[] = [];
        for (const month of monthKeys) {
            // Only throttle on an actual network call — a fully-cached trend
            // shouldn't pay a ~1s artificial delay for no reason.
            const cacheKey = this.buildCacheKey(lat, lng, month);
            const wasCached = this.cache.get(cacheKey) !== undefined;

            try {
                const crimes = await this.getCrimesAt(lat, lng, month);
                counts.push({ month, total: crimes.length });
            } catch (error) {
                console.error(`Trend lookup failed for ${month}`, error);
                counts.push({ month, total: 0 });
            }

            if (!wasCached) {
                await this.delay(150);
            }
        }

        return counts;
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private buildCacheKey(lat: number, lng: number, date?: string): string {
        return `crimes:${lat}:${lng}:${date ?? 'latest'}`;
    }

    private async getCrimesAt(lat: number, lng: number, date?: string): Promise<Crime[]> {
        const cacheKey = this.buildCacheKey(lat, lng, date);

        return this.cache.getOrSet(cacheKey, CRIME_CACHE_TTL_MS, async () => {
            const response = await axios.get(this.POLICE_API_URL, {
                params: date ? { lat, lng, date } : { lat, lng },
            });
            return response.data as Crime[];
        });
    }

    /**
     * Police.uk's street-level data typically lags ~2 months behind the
     * current date, so the trend window ends there rather than "now".
     */
    private lastNMonthKeys(count: number): string[] {
        const cursor = new Date();
        cursor.setDate(1);
        cursor.setMonth(cursor.getMonth() - 2);

        const months: string[] = [];
        for (let i = 0; i < count; i++) {
            const year = cursor.getFullYear();
            const month = String(cursor.getMonth() + 1).padStart(2, '0');
            months.unshift(`${year}-${month}`);
            cursor.setMonth(cursor.getMonth() - 1);
        }

        return months;
    }
}
