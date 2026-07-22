import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { LocationService } from '../location/location.service';
import { CacheService } from '../../shared/cache/cache.service';
import { DatabaseService } from '../../shared/database/database.service';
import { Crime, MonthlyCrimeCount } from './interfaces/crime.interface';

const CRIME_CACHE_TTL_MS = 60 * 60 * 1000; // Police.uk data only refreshes monthly

@Injectable()
export class CrimeService {
    private readonly logger = new Logger(CrimeService.name);
    private readonly POLICE_API_URL = 'https://data.police.uk/api/crimes-street/all-crime';

    constructor(
        private readonly locationService: LocationService,
        private readonly cache: CacheService,
        private readonly database: DatabaseService,
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
            const crimes = response.data as Crime[];

            // Fire-and-forget: archiving to Postgres is a nice-to-have for
            // future historical lookback, not something a user's search
            // should ever wait on.
            void this.persistCrimes(lat, lng, date, crimes);

            return crimes;
        });
    }

    /**
     * Write-through archive: every location someone actually searches gets
     * persisted, building historical coverage organically instead of
     * bulk-backfilling the whole UK (which free-tier Postgres storage
     * couldn't hold anyway).
     */
    private async persistCrimes(
        lat: number,
        lng: number,
        date: string | undefined,
        crimes: Crime[],
    ): Promise<void> {
        if (!this.database.isConfigured()) return;

        // Police.uk returns one month's data per call; every crime in the
        // batch shares the same `month`. Falls back to the requested `date`
        // for the rare case of zero crimes with no month to read it from.
        const month = crimes[0]?.month ?? date;
        if (!month) return;

        try {
            if (crimes.length > 0) {
                const values: unknown[] = [];
                const placeholders = crimes.map((crime, i) => {
                    const o = i * 9;
                    values.push(
                        crime.id,
                        crime.category,
                        crime.month,
                        crime.location.latitude,
                        crime.location.longitude,
                        crime.location.street.id,
                        crime.location.street.name,
                        crime.outcome_status?.category ?? null,
                        crime.outcome_status?.date ?? null,
                    );
                    return `($${o + 1}, $${o + 2}, to_date($${o + 3}, 'YYYY-MM'), $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8}, $${o + 9})`;
                });

                await this.database.query(
                    `INSERT INTO crimes (id, category, month, latitude, longitude, street_id, street_name, outcome_category, outcome_date)
                     VALUES ${placeholders.join(', ')}
                     ON CONFLICT (id) DO NOTHING`,
                    values,
                );
            }

            await this.database.query(
                `INSERT INTO crime_search_ingestions (latitude, longitude, month, crime_count)
                 VALUES ($1, $2, to_date($3, 'YYYY-MM'), $4)
                 ON CONFLICT (latitude, longitude, month)
                 DO UPDATE SET crime_count = EXCLUDED.crime_count, ingested_at = now()`,
                [lat, lng, month, crimes.length],
            );
        } catch (error) {
            this.logger.error(`Failed to archive crimes for ${lat},${lng} (${month}): ${(error as Error).message}`);
        }
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
