import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

/**
 * Minimal in-process TTL cache. Deliberately not backed by Redis — this is a
 * single-instance demo service, and an external cache store would be
 * infrastructure the deployment doesn't need.
 */
@Injectable()
export class CacheService {
    private readonly store = new Map<string, CacheEntry<unknown>>();

    get<T>(key: string): T | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;

        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }

        return entry.value as T;
    }

    set<T>(key: string, value: T, ttlMs: number): void {
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }

    /** Returns a cached value, or computes, caches, and returns a fresh one. */
    async getOrSet<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
        const cached = this.get<T>(key);
        if (cached !== undefined) return cached;

        const value = await compute();
        this.set(key, value, ttlMs);
        return value;
    }

    delete(key: string): void {
        this.store.delete(key);
    }

    clear(): void {
        this.store.clear();
    }
}
