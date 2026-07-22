import { DatabaseService } from './database.service';
import { Pool } from 'pg';
import { SCHEMA_SQL } from './schema';

jest.mock('pg', () => {
    const mPool = {
        query: jest.fn(),
        end: jest.fn(),
    };
    return { Pool: jest.fn(() => mPool) };
});

describe('DatabaseService', () => {
    let service: DatabaseService;
    const originalEnv = process.env.DATABASE_URL;

    afterEach(() => {
        process.env.DATABASE_URL = originalEnv;
        jest.clearAllMocks();
    });

    describe('when DATABASE_URL is not set', () => {
        beforeEach(async () => {
            delete process.env.DATABASE_URL;
            service = new DatabaseService();
            await service.onModuleInit();
        });

        it('reports as not configured', () => {
            expect(service.isConfigured()).toBe(false);
        });

        it('ping resolves false', async () => {
            expect(await service.ping()).toBe(false);
        });

        it('query throws rather than silently failing', () => {
            expect(() => service.query('SELECT 1')).toThrow();
        });
    });

    describe('schema migration on startup', () => {
        let mockPool: { query: jest.Mock; end: jest.Mock };

        beforeEach(() => {
            process.env.DATABASE_URL = 'postgresql://user:pass@host/db';
            service = new DatabaseService();

            mockPool = (Pool as unknown as jest.Mock)();
        });

        it('applies the schema migration against the pool', async () => {
            mockPool.query.mockResolvedValue({ rows: [] });

            await service.onModuleInit();

            expect(mockPool.query).toHaveBeenCalledWith(SCHEMA_SQL);
        });

        it('logs but does not throw if the migration fails', async () => {
            mockPool.query.mockRejectedValue(new Error('permission denied'));

            await expect(service.onModuleInit()).resolves.toBeUndefined();
        });
    });

    describe('when DATABASE_URL is set', () => {
        let mockPool: { query: jest.Mock; end: jest.Mock };

        beforeEach(async () => {
            process.env.DATABASE_URL = 'postgresql://user:pass@host/db';
            service = new DatabaseService();

            mockPool = (Pool as unknown as jest.Mock)();
            mockPool.query.mockResolvedValue({ rows: [] });

            await service.onModuleInit();
            mockPool.query.mockClear();
        });

        it('reports as configured', () => {
            expect(service.isConfigured()).toBe(true);
        });

        it('ping resolves true on a successful query', async () => {
            mockPool.query.mockResolvedValue({ rows: [] });
            expect(await service.ping()).toBe(true);
        });

        it('ping resolves false when the query fails, rather than throwing', async () => {
            mockPool.query.mockRejectedValue(new Error('connection refused'));
            expect(await service.ping()).toBe(false);
        });

        it('delegates query() to the underlying pool', async () => {
            mockPool.query.mockResolvedValue({ rows: [{ n: 1 }] });

            const result = await service.query('SELECT $1::int as n', [1]);

            expect(mockPool.query).toHaveBeenCalledWith('SELECT $1::int as n', [1]);
            expect(result.rows).toEqual([{ n: 1 }]);
        });

        it('closes the pool on module destroy', async () => {
            await service.onModuleDestroy();
            expect(mockPool.end).toHaveBeenCalled();
        });
    });
});
