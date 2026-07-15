import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisService } from '../services/redis.service';
import { Request, Response } from 'express';

const isRedisActive = (redisService as any).isEnabled && (redisService as any).client;

// Function to create a new store instance for each limiter
const createStore = (prefix: string) => {
    if (isRedisActive) {
        return new RedisStore({
            sendCommand: (...args: string[]) => (redisService as any).client.call(...args),
            prefix
        });
    }
    return undefined; // Fallback to memory store if Redis is unavailable
};

// 1. Strict Auth Limiter (For Login / 2FA endpoints)
// 10 requests per 15 minutes
export const authLimiter = rateLimit({
    store: createStore('rl:auth:'),
    windowMs: 15 * 60 * 1000,
    max: 10, // Allowing 10 because a normal flow has login + 2fa requests
    message: { message: 'Too many authentication attempts from this IP, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

// 2. General API Limiter
// 150 requests per minute
export const apiLimiter = rateLimit({
    store: createStore('rl:api:'),
    windowMs: 60 * 1000,
    max: 150,
    message: { message: 'Too many requests from this IP, please try again after a minute' },
    standardHeaders: true,
    legacyHeaders: false,
});
