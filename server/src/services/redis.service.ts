import Redis from 'ioredis';

class RedisService {
    private client: Redis | null = null;
    private isEnabled = false;

    constructor() {
        if (process.env.REDIS_URL) {
            this.client = new Redis(process.env.REDIS_URL);
            this.isEnabled = true;

            this.client.on('error', (err) => {
                console.error('Redis Error:', err);
                this.isEnabled = false;
            });

            this.client.on('connect', () => {
                console.log('Redis connected successfully');
                this.isEnabled = true;
            });
        }
    }

    async get<T>(key: string): Promise<T | null> {
        if (!this.isEnabled || !this.client) return null;
        try {
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Redis get error:', error);
            return null;
        }
    }

    async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
        if (!this.isEnabled || !this.client) return;
        try {
            await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        } catch (error) {
            console.error('Redis set error:', error);
        }
    }

    async del(key: string): Promise<void> {
        if (!this.isEnabled || !this.client) return;
        try {
            await this.client.del(key);
        } catch (error) {
            console.error('Redis del error:', error);
        }
    }

    // Pattern based delete (use cautiously)
    async clearPattern(pattern: string): Promise<void> {
        if (!this.isEnabled || !this.client) return;
        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(...keys);
            }
        } catch (error) {
            console.error('Redis clear pattern error:', error);
        }
    }
}

export const redisService = new RedisService();
