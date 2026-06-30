import { Request, Response, NextFunction } from 'express';
import { redisService } from '../services/redis.service';

interface RateLimitOptions {
    windowMs: number; // Time window in milliseconds
    max: number;      // Max requests allowed in the window
    message: string;  // Error message response
}

// Memory fallback store to prevent memory leaks and keep rate-limiting active if Redis is offline
const memoryStore = new Map<string, { count: number; resetTime: number }>();

// Cleanup memory store every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of memoryStore.entries()) {
        if (now > value.resetTime) {
            memoryStore.delete(key);
        }
    }
}, 300000);

export const rateLimit = (options: RateLimitOptions) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Resolve client IP (IP address or fallback to socket)
        const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

        // For auth routes, bind the rate limit to both IP and the targeted email/username
        // This stops attackers from brute-forcing a single account using multiple IP addresses (distributed brute-force)
        const userEmail = req.body?.email ? String(req.body.email).trim().toLowerCase() : '';
        const identifier = userEmail ? `${ip}:${userEmail}` : ip;

        // Redis namespace key
        const key = `ratelimit:${req.baseUrl || ''}${req.path}:${identifier}`;

        const now = Date.now();
        const windowSec = Math.ceil(options.windowMs / 1000);

        // 1. Try Redis Rate Limiter first
        const isRedisActive = (redisService as any).isEnabled && (redisService as any).client;
        if (isRedisActive) {
            try {
                const count = await redisService.incr(key, windowSec);
                if (count > options.max) {
                    res.setHeader('Retry-After', windowSec);
                    return res.status(429).json({
                        message: options.message,
                        retryAfterSeconds: windowSec
                    });
                }
                return next();
            } catch (error) {
                console.error('Redis rate limiting failed. Falling back to memory store:', error);
            }
        }

        // 2. Fallback to In-Memory Rate Limiter
        const record = memoryStore.get(key);

        if (!record || now > record.resetTime) {
            memoryStore.set(key, {
                count: 1,
                resetTime: now + options.windowMs
            });
            return next();
        }

        record.count += 1;

        if (record.count > options.max) {
            const secondsLeft = Math.ceil((record.resetTime - now) / 1000);
            res.setHeader('Retry-After', secondsLeft);
            return res.status(429).json({
                message: options.message,
                retryAfterSeconds: secondsLeft
            });
        }

        return next();
    };
};

// Authentication rate limiter: 5 attempts max per 1 minute window
export const authRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: 'Too many authentication attempts. Please try again after 1 minute.'
});

// General API rate limiter: 100 requests max per 1 minute window
export const apiRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: 'Too many requests on this endpoint. Please try again after 1 minute.'
});
