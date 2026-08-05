import { Request, Response, NextFunction } from 'express';
import { redisService } from '../services/redis.service';
import { logger } from '../services/observability.service';

export const cacheMiddleware = (ttlSeconds: number = 60) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        const isOnline = redisService.isOnline();
        if (!isOnline) {
            return next();
        }

        // Cache key based on full original url (includes query params)
        const cacheKey = `apicache:${req.originalUrl}`;

        try {
            const cachedBody = await redisService.get<any>(cacheKey);
            if (cachedBody) {
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('Content-Type', 'application/json');
                return res.status(200).json(cachedBody);
            }

            res.setHeader('X-Cache', 'MISS');

            // Intercept res.json to capture response payload
            const originalJson = res.json.bind(res);
            res.json = (body: any) => {
                if (res.statusCode === 200) {
                    redisService.set(cacheKey, body, ttlSeconds).catch(err => {
                        logger.error('Failed to write API response to Redis cache', {
                            key: cacheKey,
                            error: err.message
                        });
                    });
                }
                return originalJson(body);
            };

            next();
        } catch (error: any) {
            logger.error('Response cache middleware encountered an error', { error: error.message });
            next();
        }
    };
};
