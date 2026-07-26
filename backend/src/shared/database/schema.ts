/**
 * Idempotent schema for the historical crime archive.
 *
 * Storage model: lazy/on-demand archiving (every searched location gets
 * persisted) plus a small one-time bulk backfill for a single police force,
 * so at least one area has real multi-year depth immediately rather than
 * waiting years for the lazy archive to accumulate it.
 *
 * `crimes.pk` is a synthetic surrogate key rather than Police.uk's own crime
 * ID, because the two data sources don't share an ID scheme: the live API
 * returns a numeric `id` (stored in `source_id`), while bulk CSV downloads
 * only have a `persistent_id` hash — often blank for anti-social-behaviour
 * rows. Partial unique indexes on each let both sources coexist without
 * colliding, while still deduping re-fetches of the same live crime or the
 * same bulk row.
 */
export const SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS crimes (
        pk BIGSERIAL PRIMARY KEY,
        source_id BIGINT,
        persistent_id TEXT,
        category TEXT NOT NULL,
        month DATE NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        street_id BIGINT,
        street_name TEXT,
        outcome_category TEXT,
        outcome_date TEXT,
        source TEXT NOT NULL DEFAULT 'live',
        ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Migrate a pre-existing 'crimes' table from before bulk-backfill support,
    -- where Police.uk's live-API numeric id was still the primary key.
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'crimes' AND column_name = 'id'
        ) THEN
            ALTER TABLE crimes RENAME COLUMN id TO source_id;
            ALTER TABLE crimes DROP CONSTRAINT IF EXISTS crimes_pkey;
            ALTER TABLE crimes ADD COLUMN IF NOT EXISTS pk BIGSERIAL;
            ALTER TABLE crimes ADD PRIMARY KEY (pk);
        END IF;
    END $$;

    ALTER TABLE crimes ADD COLUMN IF NOT EXISTS persistent_id TEXT;
    ALTER TABLE crimes ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'live';

    CREATE UNIQUE INDEX IF NOT EXISTS idx_crimes_source_id ON crimes (source_id) WHERE source_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_crimes_persistent_id ON crimes (persistent_id) WHERE persistent_id IS NOT NULL AND persistent_id <> '';
    CREATE INDEX IF NOT EXISTS idx_crimes_search ON crimes (latitude, longitude, month);

    CREATE TABLE IF NOT EXISTS crime_search_ingestions (
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        month DATE NOT NULL,
        crime_count INTEGER NOT NULL,
        ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (latitude, longitude, month)
    );

    -- Coverage tracking for bulk-backfilled forces. Separate from
    -- crime_search_ingestions because a force-wide CSV dump has no single
    -- searched lat/lng to key on.
    CREATE TABLE IF NOT EXISTS force_backfill_status (
        force TEXT NOT NULL,
        month DATE NOT NULL,
        crime_count INTEGER NOT NULL,
        backfilled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (force, month)
    );
`;
