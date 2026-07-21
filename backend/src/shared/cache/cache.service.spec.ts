import { CacheService } from './cache.service';

describe('CacheService', () => {
    let service: CacheService;

    beforeEach(() => {
        service = new CacheService();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('returns undefined for a key that was never set', () => {
        expect(service.get('missing')).toBeUndefined();
    });

    it('returns a cached value before it expires', () => {
        service.set('key', 'value', 1000);
        expect(service.get('key')).toBe('value');
    });

    it('expires a value once its TTL has passed', () => {
        jest.useFakeTimers();

        service.set('key', 'value', 1000);
        jest.advanceTimersByTime(1001);

        expect(service.get('key')).toBeUndefined();
    });

    describe('getOrSet', () => {
        it('computes and caches on a miss, then reuses the cached value on a hit', async () => {
            const compute = jest.fn().mockResolvedValue('computed');

            const first = await service.getOrSet('key', 1000, compute);
            const second = await service.getOrSet('key', 1000, compute);

            expect(first).toBe('computed');
            expect(second).toBe('computed');
            expect(compute).toHaveBeenCalledTimes(1);
        });
    });

    it('delete removes a cached entry', () => {
        service.set('key', 'value', 1000);
        service.delete('key');

        expect(service.get('key')).toBeUndefined();
    });

    it('clear removes all cached entries', () => {
        service.set('a', 1, 1000);
        service.set('b', 2, 1000);
        service.clear();

        expect(service.get('a')).toBeUndefined();
        expect(service.get('b')).toBeUndefined();
    });
});
