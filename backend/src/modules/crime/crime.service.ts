import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { LocationService } from '../location/location.service';
import { CacheService } from '../../shared/cache/cache.service';
import { Crime } from './interfaces/crime.interface';

const CRIME_CACHE_TTL_MS = 60 * 60 * 1000; // Police.uk data only refreshes monthly

export interface MonthlyCrimeCount {
    month: string;
    total: number;
}

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

    /** Month-by-month incident counts for the trend view, oldest first. */
    async getTrendByPostcode(postcode: string, months = 6): Promise<MonthlyCrimeCount[]> {
        const { lat, lng } = await this.locationService.getCoordinates(postcode);
        const monthKeys = this.lastNMonthKeys(months);

        return Promise.all(
            monthKeys.map(async (month) => {
                try {
                    const crimes = await this.getCrimesAt(lat, lng, month);
                    return { month, total: crimes.length };
                } catch (error) {
                    console.error(`Trend lookup failed for ${month}`, error);
                    return { month, total: 0 };
                }
            }),
        );
    }

    private async getCrimesAt(lat: number, lng: number, date?: string): Promise<Crime[]> {
        const cacheKey = `crimes:${lat}:${lng}:${date ?? 'latest'}`;

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
