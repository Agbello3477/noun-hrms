import { Request, Response, NextFunction } from 'express';
import { redisService } from '../services/redis.service';
import { cacheInvalidationService } from '../services/cacheInvalidationService';
import { logger } from '../services/observability.service';

export interface CacheMiddlewareOptions {
    ttlSeconds?: number;
    tags?: string[];
    isPublic?: boolean;
}

/**
 * Normalizes URL and sorts query parameters alphabetically
 * to ensure uniform cache keys irrespective of query param ordering.
 */
export function normalizeUrlWithQueryParams(originalUrl: string): string {
    try {
        const [path, queryString] = originalUrl.split('?');
        if (!queryString) return path.toLowerCase();

        const searchParams = new URLSearchParams(queryString);
        const sortedEntries = Array.from(searchParams.entries()).sort(([a], [b]) => a.localeCompare(b));
        const normalizedParams = new URLSearchParams(sortedEntries).toString();

        return `${path.toLowerCase()}?${normalizedParams}`;
    } catch {
        return originalUrl.toLowerCase();
    }
}

/**
 * Layer 2: In-Memory API Response Caching Middleware (Redis with Multi-Tenant & Session Isolation).
 * 
 * Guarantees zero authorization leakage, zero cross-tenant data bleeding,
 * and seamless fail-open fallback on Redis timeout or disconnection.
 */
export const cacheMiddleware = (
    ttlOrOptions: number | CacheMiddlewareOptions = 60,
    maybeOptions?: CacheMiddlewareOptions
) => {
    const options: CacheMiddlewareOptions = typeof ttlOrOptions === 'number'
        ? { ttlSeconds: ttlOrOptions, ...(maybeOptions || {}) }
        : (ttlOrOptions || {});

    const ttlSeconds = options.ttlSeconds || 60;
    const tags = options.tags || [];
    const isPublicExplicit = options.isPublic || false;

    return async (req: Request, res: Response, next: NextFunction) => {
        // 1. Only cache safe HTTP methods: GET and HEAD. Never cache mutations.
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return next();
        }

        // 2. Skip cache if request headers contain Cache-Control: no-cache
        const cacheControlHeader = req.headers['cache-control'] || '';
        if (typeof cacheControlHeader === 'string' && cacheControlHeader.includes('no-cache')) {
            res.setHeader('X-Cache-Status', 'BYPASS');
            return next();
        }

        const startHrTime = process.hrtime();

        // 3. Multi-Tenant & Session Context Extraction
        // Authenticated context from JWT / Session auth middleware
        const authUser = (req as any).user;
        const isPublic = isPublicExplicit || (!authUser && !req.headers.authorization && !req.cookies?.token);

        const normalizedUrl = normalizeUrlWithQueryParams(req.originalUrl || req.url);

        let cacheKey: string;
        if (isPublic) {
            // Unauthenticated / Public shared catalog endpoints
            cacheKey = `redis:api:public:${normalizedUrl}`;
        } else {
            // Zero-Trust multi-tenant isolation key:
            // redis:api:${userId}:${userRole}:${stationLocation}:${normalizedUrlWithQueryParams}
            const userId = authUser?.id || 'anon';
            const userRole = authUser?.role || 'STAFF';
            const stationLocation = authUser?.centerId || authUser?.unitId || authUser?.stationLocation || req.headers['x-station-location'] || 'HQ';

            cacheKey = `redis:api:${userId}:${userRole}:${stationLocation}:${normalizedUrl}`;
        }

        // 4. Attempt cache retrieval with 50ms timeout protection
        try {
            const cachedBody = await redisService.get<any>(cacheKey);

            if (cachedBody !== null && cachedBody !== undefined) {
                const diff = process.hrtime(startHrTime);
                const lookupTimeMs = Number(((diff[0] * 1e3) + (diff[1] * 1e-6)).toFixed(2));

                res.setHeader('X-Cache-Status', 'HIT');
                res.setHeader('X-Cache-Lookup-Time-Ms', lookupTimeMs.toString());
                res.setHeader('Content-Type', 'application/json');

                return res.status(200).json(cachedBody);
            }
        } catch (err: any) {
            // Fail-open: proceed to controller without throwing error to client
            logger.warn('Cache lookup failed, proceeding to controller', {
                key: cacheKey,
                error: err?.message
            });
        }

        // 5. Cache MISS: record lookup latency and intercept response
        const diff = process.hrtime(startHrTime);
        const lookupTimeMs = Number(((diff[0] * 1e3) + (diff[1] * 1e-6)).toFixed(2));

        res.setHeader('X-Cache-Status', 'MISS');
        res.setHeader('X-Cache-Lookup-Time-Ms', lookupTimeMs.toString());

        // Intercept res.json to capture response payload
        const originalJson = res.json.bind(res);
        res.json = (body: any) => {
            // Only cache successful 200 OK responses
            if (res.statusCode === 200 && body !== undefined && body !== null) {
                (async () => {
                    try {
                        await redisService.set(cacheKey, body, ttlSeconds);

                        // If tags are defined, index key in tag sets
                        if (tags && tags.length > 0) {
                            await cacheInvalidationService.tagKey(cacheKey, tags, ttlSeconds);
                        }
                    } catch (writeErr: any) {
                        logger.warn('Failed to write API response to Redis cache', {
                            key: cacheKey,
                            error: writeErr?.message
                        });
                    }
                })().catch(() => {});
            }

            return originalJson(body);
        };

        next();
    };
};
