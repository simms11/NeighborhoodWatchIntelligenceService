import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { LocationService } from '../location/location.service';
import { CacheService } from '../../shared/cache/cache.service';
import { DatabaseService } from '../../shared/database/database.service';
import { Crime, MonthlyCrimeCount } from '@neighborhood-watch/shared-types';

const CRIME_CACHE_TTL_MS = 60 * 60 * 1000; // Police.uk data only refreshes monthly

// Approximates Police.uk's own street-level radius so archive reads surface
// the same crimes a live call would have. Longitude degrees compress at
// higher latitudes, so its delta is derived from latitude at query time.
const SEARCH_RADIUS_MILES = 1;
const KM_PER_MILE = 1.60934;
const KM_PER_DEGREE_LATITUDE = 111.32;

interface ArchivedCrimeRow {
  // node-postgres returns BIGINT columns as strings to avoid precision
  // loss on values outside JS's safe integer range.
  source_id: string | null;
  persistent_id: string | null;
  category: string;
  latitude: number;
  longitude: number;
  street_id: string | null;
  street_name: string | null;
  outcome_category: string | null;
  outcome_date: string | null;
  month: Date;
}

@Injectable()
export class CrimeService {
  private readonly logger = new Logger(CrimeService.name);
  private readonly POLICE_API_URL =
    'https://data.police.uk/api/crimes-street/all-crime';

  constructor(
    private readonly locationService: LocationService,
    private readonly cache: CacheService,
    private readonly database: DatabaseService,
  ) {}

  async getCrimesByPostcode(postcode: string): Promise<Crime[]> {
    const { lat, lng } = await this.locationService.getCoordinates(postcode);
    const { crimes } = await this.getCrimesAt(lat, lng);
    return crimes;
  }

  /**
   * Month-by-month incident counts for the trend view, oldest first.
   *
   * Fetched sequentially rather than in parallel — Police.uk's public API
   * rate-limits fairly aggressively, and firing several concurrent
   * requests for one trend lookup (on top of the main search) was enough
   * to trip it.
   */
  async getTrendByPostcode(
    postcode: string,
    months = 12,
  ): Promise<MonthlyCrimeCount[]> {
    const { lat, lng } = await this.locationService.getCoordinates(postcode);
    const monthKeys = this.lastNMonthKeys(months);

    const counts: MonthlyCrimeCount[] = [];
    for (const month of monthKeys) {
      try {
        const { crimes, calledLiveApi } = await this.getCrimesAt(
          lat,
          lng,
          month,
        );
        counts.push({ month, total: crimes.length });

        // Only throttle after an actual network call — a month served
        // from cache or the Postgres archive shouldn't pay a ~1s
        // artificial delay for no reason.
        if (calledLiveApi) {
          await this.delay(150);
        }
      } catch (error) {
        console.error(`Trend lookup failed for ${month}`, error);
        counts.push({ month, total: 0 });
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

  /**
   * Checks the in-memory cache, then the Postgres archive, before ever
   * calling Police.uk live — `calledLiveApi` tells callers whether a real
   * network request happened, so they know whether a rate-limit delay is
   * actually warranted.
   */
  private async getCrimesAt(
    lat: number,
    lng: number,
    date?: string,
  ): Promise<{ crimes: Crime[]; calledLiveApi: boolean }> {
    const cacheKey = this.buildCacheKey(lat, lng, date);
    const cached = this.cache.get<Crime[]>(cacheKey);
    if (cached !== undefined) {
      return { crimes: cached, calledLiveApi: false };
    }

    // `date` is only absent for the initial "latest" search — Police.uk
    // decides what that resolves to, but our own archive is keyed by
    // month, so we still need our best guess to look it up there first.
    const archiveMonth = date ?? this.lastNMonthKeys(1)[0];
    const archived = await this.getCrimesFromArchive(lat, lng, archiveMonth);
    if (archived) {
      this.cache.set(cacheKey, archived, CRIME_CACHE_TTL_MS);
      return { crimes: archived, calledLiveApi: false };
    }

    const response = await axios.get(this.POLICE_API_URL, {
      params: date ? { lat, lng, date } : { lat, lng },
    });
    const crimes = response.data as Crime[];
    this.cache.set(cacheKey, crimes, CRIME_CACHE_TTL_MS);

    // Fire-and-forget: archiving to Postgres is a nice-to-have for
    // future historical lookback, not something a user's search
    // should ever wait on.
    void this.persistCrimes(lat, lng, date, crimes);

    return { crimes, calledLiveApi: true };
  }

  /**
   * Serves crimes directly from Postgres when available — covering both
   * the lazy write-through archive and the Metropolitan Police bulk
   * backfill, which share the same table. A bounding box approximates
   * Police.uk's own ~1-mile street-level radius. Returns null (rather
   * than an empty array) when nothing is archived, so the caller knows to
   * fall back to a live call instead of reporting a false "zero crimes".
   */
  private async getCrimesFromArchive(
    lat: number,
    lng: number,
    month: string,
  ): Promise<Crime[] | null> {
    if (!this.database.isConfigured()) return null;

    const latDelta =
      (SEARCH_RADIUS_MILES * KM_PER_MILE) / KM_PER_DEGREE_LATITUDE;
    const lngDelta = latDelta / Math.cos((lat * Math.PI) / 180);

    try {
      const result = await this.database.query<ArchivedCrimeRow>(
        `SELECT source_id, persistent_id, category, latitude, longitude, street_id, street_name, outcome_category, outcome_date, month
                 FROM crimes
                 WHERE month = to_date($1, 'YYYY-MM')
                   AND latitude BETWEEN $2 AND $3
                   AND longitude BETWEEN $4 AND $5`,
        [month, lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta],
      );

      if (result.rows.length === 0) return null;

      return result.rows.map((row) => this.rowToCrime(row));
    } catch (error) {
      this.logger.error(
        `Archive lookup failed for ${lat},${lng} (${month}): ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * `source_id` is null for bulk-backfilled rows (they have no live-API
   * numeric id) — falls back to 0 rather than a synthetic value, since
   * `id` isn't used as a lookup key anywhere once a crime has already
   * come back from the archive, only as an opaque field on the response.
   */
  private rowToCrime(row: ArchivedCrimeRow): Crime {
    return {
      id: row.source_id ? Number(row.source_id) : 0,
      persistent_id: row.persistent_id ?? undefined,
      category: row.category,
      location_type: 'Force',
      location: {
        latitude: row.latitude,
        longitude: row.longitude,
        street: {
          id: row.street_id ? Number(row.street_id) : 0,
          name: row.street_name ?? '',
        },
      },
      context: '',
      outcome_status: row.outcome_category
        ? { category: row.outcome_category, date: row.outcome_date ?? '' }
        : null,
      month: row.month.toISOString().slice(0, 7),
    };
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
        const columnsPerCrime = 10;
        const placeholders = crimes.map((crime, i) => {
          const o = i * columnsPerCrime;
          values.push(
            crime.id,
            crime.persistent_id || null,
            crime.category,
            crime.month,
            crime.location.latitude,
            crime.location.longitude,
            crime.location.street.id,
            crime.location.street.name,
            crime.outcome_status?.category ?? null,
            crime.outcome_status?.date ?? null,
          );
          return `($${o + 1}, $${o + 2}, $${o + 3}, to_date($${o + 4}, 'YYYY-MM'), $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8}, $${o + 9}, $${o + 10})`;
        });

        await this.database.query(
          `INSERT INTO crimes (source_id, persistent_id, category, month, latitude, longitude, street_id, street_name, outcome_category, outcome_date)
                     VALUES ${placeholders.join(', ')}
                     ON CONFLICT (source_id) WHERE source_id IS NOT NULL DO NOTHING`,
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
      this.logger.error(
        `Failed to archive crimes for ${lat},${lng} (${month}): ${(error as Error).message}`,
      );
    }
  }

  /**
   * Keeps previously-searched locations current without requiring a user
   * to re-search. Runs daily rather than monthly — Police.uk's exact
   * publish date within a month varies, and re-checking is cheap (a
   * metadata lookup) on the days there's nothing new to fetch.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async refreshTrackedLocations(): Promise<void> {
    if (!this.database.isConfigured()) return;

    const latestMonth = this.lastNMonthKeys(1)[0];

    let locations: { latitude: number; longitude: number }[];
    try {
      const result = await this.database.query<{
        latitude: number;
        longitude: number;
      }>('SELECT DISTINCT latitude, longitude FROM crime_search_ingestions');
      locations = result.rows;
    } catch (error) {
      this.logger.error(
        `Failed to load tracked locations for refresh: ${(error as Error).message}`,
      );
      return;
    }

    this.logger.log(
      `Refreshing ${locations.length} tracked location(s) for ${latestMonth}.`,
    );

    for (const { latitude, longitude } of locations) {
      try {
        const alreadyIngested = await this.database.query(
          `SELECT 1 FROM crime_search_ingestions WHERE latitude = $1 AND longitude = $2 AND month = to_date($3, 'YYYY-MM')`,
          [latitude, longitude, latestMonth],
        );
        if ((alreadyIngested.rowCount ?? 0) > 0) continue;

        const { calledLiveApi } = await this.getCrimesAt(
          latitude,
          longitude,
          latestMonth,
        );

        if (calledLiveApi) {
          await this.delay(150);
        }
      } catch (error) {
        this.logger.error(
          `Failed to refresh ${latitude},${longitude}: ${(error as Error).message}`,
        );
      }
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
