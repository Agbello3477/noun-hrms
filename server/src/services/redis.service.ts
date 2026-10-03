import Redis from 'ioredis';

interface CacheEntry {
    value: string;
    expiresAt: number;
}

class RedisService {
    private client: Redis | null = null;
    private isEnabled = false;
    // Resilient in-memory fallback for offline/disconnected states and zero-crash operation
    private memoryCache: Map<string, CacheEntry> = new Map();
    private memorySets: Map<string, Set<string>> = new Map();
    private readonly defaultTimeoutMs = 50;

    constructor() {
        if (process.env.REDIS_URL) {
            try {
                this.client = new Redis(process.env.REDIS_URL, {
                    connectTimeout: 500,
                    commandTimeout: 100, // Short command timeout at driver level
                    maxRetriesPerRequest: 1,
                    enableOfflineQueue: false,
                    retryStrategy: (times) => {
                        if (times > 3) return null; // Stop retrying after 3 attempts
                        return Math.min(times * 100, 1000);
                    }
                });
                this.isEnabled = true;

                this.client.on('error', (err) => {
                    // Fail silently to prevent crashing server when Redis is unreachable
                    this.isEnabled = false;
                });

                this.client.on('connect', () => {
                    this.isEnabled = true;
                });
            } catch (err) {
                this.isEnabled = false;
            }
        }
    }

    /**
     * Executes a promise with a hard timeout (default 50ms).
     * If the promise rejects or times out, it throws so callers can fail-open.
     */
    private async withTimeout<T>(promise: Promise<T>, ms: number = this.defaultTimeoutMs): Promise<T> {
        let timer: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
                reject(new Error(`Redis command timed out after ${ms}ms`));
            }, ms);
        });

        try {
            return await Promise.race([promise, timeoutPromise]);
        } finally {
            clearTimeout(timer!);
        }
    }

    async get<T>(key: string): Promise<T | null> {
        // Try live Redis client if available and enabled
        if (this.isEnabled && this.client) {
            try {
                const data = await this.withTimeout(this.client.get(key));
                return data ? JSON.parse(data) : null;
            } catch {
                // Redis command failed or timed out: fall through to memory fallback
            }
        }

        // In-memory fallback
        const entry = this.memoryCache.get(key);
        if (entry) {
            if (Date.now() > entry.expiresAt) {
                this.memoryCache.delete(key);
                return null;
            }
            try {
                return JSON.parse(entry.value);
            } catch {
                return null;
            }
        }
        return null;
    }

    async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
        const serialized = JSON.stringify(value);

        if (this.isEnabled && this.client) {
            try {
                await this.withTimeout(this.client.set(key, serialized, 'EX', ttlSeconds));
            } catch {
                // Continue to write to memory fallback for resilience
            }
        }

        // Update in-memory fallback
        this.memoryCache.set(key, {
            value: serialized,
            expiresAt: Date.now() + (ttlSeconds * 1000)
        });
    }

    async del(key: string): Promise<void> {
        if (this.isEnabled && this.client) {
            try {
                await this.withTimeout(this.client.del(key));
            } catch {
                // Ignored, proceed to memory deletion
            }
        }
        this.memoryCache.delete(key);
    }

    async delMultiple(keys: string[]): Promise<void> {
        if (!keys || keys.length === 0) return;

        if (this.isEnabled && this.client) {
            try {
                await this.withTimeout(this.client.del(...keys));
            } catch {
                // Ignored
            }
        }

        for (const k of keys) {
            this.memoryCache.delete(k);
        }
    }

    // Set operations for tag-based query cache invalidation
    async sadd(tagKey: string, ...members: string[]): Promise<void> {
        if (!members || members.length === 0) return;

        if (this.isEnabled && this.client) {
            try {
                await this.withTimeout(this.client.sadd(tagKey, ...members));
            } catch {
                // Ignored
            }
        }

        let set = this.memorySets.get(tagKey);
        if (!set) {
            set = new Set<string>();
            this.memorySets.set(tagKey, set);
        }
        for (const m of members) {
            set.add(m);
        }
    }

    async smembers(tagKey: string): Promise<string[]> {
        if (this.isEnabled && this.client) {
            try {
                const members = await this.withTimeout(this.client.smembers(tagKey));
                if (members && members.length > 0) return members;
            } catch {
                // Fallback to memory set
            }
        }

        const set = this.memorySets.get(tagKey);
        return set ? Array.from(set) : [];
    }

    async srem(tagKey: string, ...members: string[]): Promise<void> {
        if (!members || members.length === 0) return;

        if (this.isEnabled && this.client) {
            try {
                await this.withTimeout(this.client.srem(tagKey, ...members));
            } catch {
                // Ignored
            }
        }

        const set = this.memorySets.get(tagKey);
        if (set) {
            for (const m of members) {
                set.delete(m);
            }
            if (set.size === 0) {
                this.memorySets.delete(tagKey);
            }
        }
    }

    // Atomic increment with expiration
    async incr(key: string, ttlSeconds: number): Promise<number> {
        if (this.isEnabled && this.client) {
            try {
                const count = await this.withTimeout(this.client.incr(key));
                if (count === 1) {
                    await this.withTimeout(this.client.expire(key, ttlSeconds));
                }
                return count;
            } catch {
                // Fallback to memory increment
            }
        }

        const entry = this.memoryCache.get(key);
        let current = 0;
        if (entry && Date.now() <= entry.expiresAt) {
            current = parseInt(entry.value, 10) || 0;
        }
        current += 1;
        this.memoryCache.set(key, {
            value: String(current),
            expiresAt: Date.now() + (ttlSeconds * 1000)
        });
        return current;
    }

    // Fetch key remaining expiration time (TTL) in seconds
    async ttl(key: string): Promise<number> {
        if (this.isEnabled && this.client) {
            try {
                return await this.withTimeout(this.client.ttl(key));
            } catch {
                // Fallback to memory
            }
        }

        const entry = this.memoryCache.get(key);
        if (!entry) return -2;
        const remainingMs = entry.expiresAt - Date.now();
        if (remainingMs <= 0) {
            this.memoryCache.delete(key);
            return -2;
        }
        return Math.ceil(remainingMs / 1000);
    }

    async expire(key: string, ttlSeconds: number): Promise<void> {
        if (this.isEnabled && this.client) {
            try {
                await this.withTimeout(this.client.expire(key, ttlSeconds));
            } catch {
                // Fallback
            }
        }

        const entry = this.memoryCache.get(key);
        if (entry) {
            entry.expiresAt = Date.now() + (ttlSeconds * 1000);
        }
    }

    // Pattern based delete (use cautiously)
    async clearPattern(pattern: string): Promise<void> {
        if (this.isEnabled && this.client) {
            try {
                const keys = await this.withTimeout(this.client.keys(pattern), 200);
                if (keys && keys.length > 0) {
                    await this.withTimeout(this.client.del(...keys));
                }
            } catch {
                // Ignored
            }
        }

        // Memory regex clear
        const regexStr = '^' + pattern.replace(/\*/g, '.*') + '$';
        const regex = new RegExp(regexStr);
        for (const k of this.memoryCache.keys()) {
            if (regex.test(k)) {
                this.memoryCache.delete(k);
            }
        }
        for (const k of this.memorySets.keys()) {
            if (regex.test(k)) {
                this.memorySets.delete(k);
            }
        }
    }

    async ping(): Promise<boolean> {
        if (!this.isEnabled || !this.client) return false;
        try {
            await this.withTimeout(this.client.ping(), 50);
            return true;
        } catch {
            return false;
        }
    }

    isOnline(): boolean {
        return this.isEnabled && this.client !== null;
    }

    async lpush(key: string, value: string): Promise<number | null> {
        if (!this.isEnabled || !this.client) return null;
        try {
            return await this.withTimeout(this.client.lpush(key, value));
        } catch {
            return null;
        }
    }

    async brpop(key: string, timeoutSeconds: number): Promise<[string, string] | null> {
        if (!this.isEnabled || !this.client) return null;
        try {
            return await this.client.brpop(key, timeoutSeconds);
        } catch (error) {
            if (!(error instanceof Error && error.message.includes('Connection is closed'))) {
                console.error('Redis brpop error:', error);
            }
            return null;
        }
    }

    /**
     * Purge all in-memory cache entries (useful for testing)
     */
    flushMemory(): void {
        this.memoryCache.clear();
        this.memorySets.clear();
    }
}

export const redisService = new RedisService();

