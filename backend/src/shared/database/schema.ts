/**
 * Idempotent schema for the historical crime archive.
 *
 * Storage model: lazy/on-demand. Rather than bulk-backfilling all of the UK
 * (which would blow past Neon's free-tier storage in no time), crimes are
 * only persisted here as a side effect of someone actually searching a
 * location. Over time this builds a real archive of the areas people care
 * about, and — because Police.uk's live API only exposes a rolling ~3 year
 * window — this is also what lets previously-searched months survive past
 * that window instead of disappearing.
 */
export const SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS crimes (
        id BIGINT PRIMARY KEY,
        category TEXT NOT NULL,
        month DATE NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        street_id BIGINT,
        street_name TEXT,
        outcome_category TEXT,
        outcome_date TEXT,
        ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_crimes_search ON crimes (latitude, longitude, month);

    CREATE TABLE IF NOT EXISTS crime_search_ingestions (
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        month DATE NOT NULL,
        crime_count INTEGER NOT NULL,
        ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (latitude, longitude, month)
    );
`;
