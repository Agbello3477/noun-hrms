import { redisService } from '../services/redis.service';
import { logger } from '../services/observability.service';

export interface DbCacheOptions {
    tags?: string[];
    bypassCache?: boolean;
}

/**
 * Layer 3 Database Query & Aggregate Computation Cache Wrapper.
 * 
 * Intercepts expensive database calculations, queries, and joins.
 * Writes to Redis with explicit schema namespace tags for atomic invalidation.
 * Resiliently fails open (executes DB query directly) on timeout or cache failure.
 */
export async function getCachedQuery<T>(
    cacheKey: string,
    ttlSeconds: number,
    queryExecutionFn: () => Promise<T>,
    optionsOrTags?: DbCacheOptions | string[]
): Promise<T> {
    const options: DbCacheOptions = Array.isArray(optionsOrTags) 
        ? { tags: optionsOrTags } 
        : (optionsOrTags || {});

    // If caller explicitly requested cache bypass
    if (options.bypassCache) {
        return await queryExecutionFn();
    }

    const startTime = process.hrtime();

    try {
        // 1. Attempt cache lookup with sub-50ms timeout
        const cachedResult = await redisService.get<T>(cacheKey);
        if (cachedResult !== null && cachedResult !== undefined) {
            return cachedResult;
        }
    } catch (err: any) {
        logger.warn('dbCache lookup failed; falling back to direct database query', {
            key: cacheKey,
            error: err?.message
        });
    }

    // 2. Cache MISS or failed: execute database query
    const result = await queryExecutionFn();

    // 3. Cache the computed result asynchronously (non-blocking)
    if (result !== undefined && result !== null) {
        (async () => {
            try {
                await redisService.set(cacheKey, result, ttlSeconds);

                // Index key under tags for atomic event-driven invalidation
                if (options.tags && options.tags.length > 0) {
                    for (const tag of options.tags) {
                        const normalizedTag = tag.startsWith('tag:') ? tag : `tag:${tag}`;
                        await redisService.sadd(normalizedTag, cacheKey);
                        // Ensure tag set stays alive at least as long as the key TTL
                        await redisService.expire(normalizedTag, ttlSeconds * 2);
                    }
                }
            } catch (cacheErr: any) {
                logger.warn('dbCache write failed', {
                    key: cacheKey,
                    error: cacheErr?.message
                });
            }
        })().catch(() => {});
    }

    return result;
}

/**
 * Utility to generate standardized database query cache keys
 */
export function buildDbCacheKey(namespace: string, ...identifiers: (string | number | boolean | undefined | null)[]): string {
    const sanitized = identifiers
        .map(id => (id === undefined || id === null || id === '' ? 'all' : String(id).trim()))
        .join(':');
    return `redis:db:${namespace}:${sanitized}`;
}
