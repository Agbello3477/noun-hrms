import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisService } from '../services/redis.service';
import { Request, Response } from 'express';

const isRedisActive = (redisService as any).isEnabled && (redisService as any).client;

// Function to create a new store instance for each limiter
const createStore = (prefix: string) => {
    return undefined; // Temporarily force memory store to debug Redis hangs
};

// 1. Strict Auth Limiter (For Login / 2FA endpoints)
// 60 requests per 15 minutes
export const authLimiter = rateLimit({
    store: createStore('rl:auth:'),
    windowMs: 15 * 60 * 1000,
    max: 60, // Allowing 60 for multi-factor login and retries
    message: { message: 'Too many authentication attempts from this IP, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

// 2. General API Limiter
// 1200 requests per minute
export const apiLimiter = rateLimit({
    store: createStore('rl:api:'),
    windowMs: 60 * 1000,
    max: 1200,
    message: { message: 'Too many requests from this IP, please try again after a minute' },
    standardHeaders: true,
    legacyHeaders: false,
});
