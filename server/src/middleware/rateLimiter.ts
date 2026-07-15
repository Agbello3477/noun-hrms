import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisService } from '../services/redis.service';
import { Request, Response } from 'express';

const isRedisActive = (redisService as any).isEnabled && (redisService as any).client;

// Store configuration
const store = isRedisActive 
    ? new RedisStore({
        sendCommand: (...args: string[]) => (redisService as any).client.call(...args),
    }) 
    : undefined; // Fallback to memory store if Redis is unavailable

// 1. Strict Auth Limiter (For Login / 2FA endpoints)
// 10 requests per 15 minutes
export const authLimiter = rateLimit({
    store,
    windowMs: 15 * 60 * 1000,
    max: 10, // Allowing 10 because a normal flow has login + 2fa requests
    message: { message: 'Too many authentication attempts from this IP, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        return req.ip || '0.0.0.0';
    }
});

// 2. General API Limiter
// 150 requests per minute
export const apiLimiter = rateLimit({
    store,
    windowMs: 60 * 1000,
    max: 150,
    message: { message: 'Too many requests from this IP, please try again after a minute' },
    standardHeaders: true,
    legacyHeaders: false,
});
