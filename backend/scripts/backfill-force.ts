/**
 * One-time bulk backfill for a single police force, sourced from Police.uk's
 * custom CSV download (data.police.uk/data/). Not part of the running app —
 * run manually: `DATABASE_URL=... npx ts-node scripts/backfill-force.ts <extracted-dir> <force-slug>`
 *
 * <extracted-dir> is expected to contain one subdirectory per month
 * (e.g. `2025-06/2025-06-metropolitan-street.csv`), matching the layout of
 * Police.uk's downloaded zip once extracted.
 *
 * The bulk CSV's "Crime type" labels don't match the live API's category
 * slugs 1:1 (e.g. the CSV's "Violence and sexual offences" corresponds to
 * the live API's "violent-crime"), so they're mapped explicitly here rather
 * than derived with a naive lowercase-and-hyphenate transform.
 */
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const CATEGORY_MAP: Record<string, string> = {
    'Anti-social behaviour': 'anti-social-behaviour',
    'Bicycle theft': 'bicycle-theft',
    Burglary: 'burglary',
    'Criminal damage and arson': 'criminal-damage-arson',
    Drugs: 'drugs',
    'Other crime': 'other-crime',
    'Other theft': 'other-theft',
    'Possession of weapons': 'possession-of-weapons',
    'Public order': 'public-order',
    Robbery: 'robbery',
    Shoplifting: 'shoplifting',
    'Theft from the person': 'theft-from-the-person',
    'Vehicle crime': 'vehicle-crime',
    'Violence and sexual offences': 'violent-crime',
};

function normalizeCategory(raw: string): string {
    const mapped = CATEGORY_MAP[raw];
    if (mapped) return mapped;
    console.warn(`  Unrecognized crime type "${raw}" — falling back to a derived slug.`);
    return raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

interface ParsedRow {
    persistentId: string | null;
    month: string;
    latitude: number;
    longitude: number;
    streetName: string;
    category: string;
    outcomeCategory: string | null;
}

/**
 * Minimal RFC 4180 field splitter. Police.uk's CSVs are usually
 * comma-only, but LSOA names occasionally contain a comma themselves
 * (e.g. `"Bournemouth, Christchurch and Poole 035A"`) and are quoted —
 * a plain `split(',')` silently shifts every column after that point.
 */
function parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (inQuotes) {
            if (char === '"') {
                if (line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += char;
            }
        } else if (char === '"') {
            inQuotes = true;
        } else if (char === ',') {
            fields.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    fields.push(current);
    return fields;
}

function parseCsvFile(filePath: string): ParsedRow[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim().length > 0);
    const dataLines = lines.slice(1); // drop header

    const rows: ParsedRow[] = [];
    let skipped = 0;

    for (const line of dataLines) {
        const cols = parseCsvLine(line);
        const [crimeId, month, , , longitude, latitude, location, , , crimeType, outcomeCategory] = cols;

        if (!latitude || !longitude) {
            skipped++;
            continue;
        }

        rows.push({
            persistentId: crimeId || null,
            month,
            latitude: Number(latitude),
            longitude: Number(longitude),
            streetName: location,
            category: normalizeCategory(crimeType),
            outcomeCategory: outcomeCategory || null,
        });
    }

    if (skipped > 0) {
        console.warn(`  Skipped ${skipped} row(s) with missing coordinates in ${path.basename(filePath)}`);
    }

    return rows;
}

async function insertBatch(pool: Pool, rows: ParsedRow[]): Promise<void> {
    if (rows.length === 0) return;

    const columnsPerRow = 7;
    const values: unknown[] = [];
    const placeholders = rows.map((row, i) => {
        const o = i * columnsPerRow;
        values.push(
            row.persistentId,
            row.category,
            row.month,
            row.latitude,
            row.longitude,
            row.streetName,
            row.outcomeCategory,
        );
        return `($${o + 1}, $${o + 2}, to_date($${o + 3}, 'YYYY-MM'), $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, 'bulk')`;
    });

    await pool.query(
        `INSERT INTO crimes (persistent_id, category, month, latitude, longitude, street_name, outcome_category, source)
         VALUES ${placeholders.join(', ')}
         ON CONFLICT (persistent_id) WHERE persistent_id IS NOT NULL AND persistent_id <> '' DO NOTHING`,
        values,
    );
}

async function main() {
    const [dir, force] = process.argv.slice(2);

    if (!dir || !force) {
        console.error('Usage: ts-node scripts/backfill-force.ts <extracted-dir> <force-slug>');
        process.exit(1);
    }

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('DATABASE_URL is not set.');
        process.exit(1);
    }

    const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

    const monthDirs = fs
        .readdirSync(dir)
        .filter((name) => /^\d{4}-\d{2}$/.test(name))
        .sort();

    if (monthDirs.length === 0) {
        console.error(`No month directories (YYYY-MM) found under ${dir}`);
        await pool.end();
        process.exit(1);
    }

    for (const month of monthDirs) {
        const alreadyDone = await pool.query(
            `SELECT 1 FROM force_backfill_status WHERE force = $1 AND month = to_date($2, 'YYYY-MM')`,
            [force, month],
        );
        if ((alreadyDone.rowCount ?? 0) > 0) {
            console.log(`${month}: already backfilled, skipping.`);
            continue;
        }

        const csvPath = path.join(dir, month, `${month}-${force}-street.csv`);
        if (!fs.existsSync(csvPath)) {
            console.warn(`${month}: expected file not found at ${csvPath}, skipping.`);
            continue;
        }

        const rows = parseCsvFile(csvPath);
        console.log(`${month}: parsed ${rows.length} rows, inserting in batches...`);

        const BATCH_SIZE = 2000;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            await insertBatch(pool, rows.slice(i, i + BATCH_SIZE));
        }

        await pool.query(
            `INSERT INTO force_backfill_status (force, month, crime_count)
             VALUES ($1, to_date($2, 'YYYY-MM'), $3)
             ON CONFLICT (force, month) DO UPDATE SET crime_count = EXCLUDED.crime_count, backfilled_at = now()`,
            [force, month, rows.length],
        );

        console.log(`${month}: done (${rows.length} rows).`);
    }

    await pool.end();
    console.log('Backfill complete.');
}

export { parseCsvFile, normalizeCategory };

if (require.main === module) {
    main().catch((error) => {
        console.error('Backfill failed:', error);
        process.exit(1);
    });
}
