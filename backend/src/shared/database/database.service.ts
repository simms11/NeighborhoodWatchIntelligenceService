import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { SCHEMA_SQL } from './schema';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(DatabaseService.name);
    private pool: Pool | null = null;

    async onModuleInit(): Promise<void> {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            this.logger.warn('DATABASE_URL not set — database features are disabled.');
            return;
        }

        this.pool = new Pool({
            connectionString,
            ssl: { rejectUnauthorized: false },
        });

        try {
            await this.pool.query(SCHEMA_SQL);
            this.logger.log('Database schema is up to date.');
        } catch (error) {
            this.logger.error(`Failed to apply database schema: ${(error as Error).message}`);
        }
    }

    async onModuleDestroy(): Promise<void> {
        await this.pool?.end();
    }

    isConfigured(): boolean {
        return this.pool !== null;
    }

    query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: unknown[],
    ): Promise<QueryResult<T>> {
        if (!this.pool) {
            throw new Error('Database is not configured (DATABASE_URL not set).');
        }
        return this.pool.query<T>(text, params);
    }

    /** Cheap connectivity check for the health endpoint. */
    async ping(): Promise<boolean> {
        if (!this.pool) return false;

        try {
            await this.pool.query('SELECT 1');
            return true;
        } catch (error) {
            this.logger.error(`Database ping failed: ${(error as Error).message}`);
            return false;
        }
    }
}
