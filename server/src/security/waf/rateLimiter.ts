import { Request, Response } from 'express';
import { redisService } from '../../services/redis.service';
import { WAF_RULES } from './types';

// In-Memory Fallback Stores for when Redis is offline or for zero-dependency test execution
interface MemoryLimitRecord {
  count: number;
  resetAt: number;
}

const memoryRateLimitStore = new Map<string, MemoryLimitRecord>();
const memoryViolationStore = new Map<string, MemoryLimitRecord>();
const memoryJailStore = new Map<string, number>(); // ip -> expiresAt

// Cleanup memory stores every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memoryRateLimitStore.entries()) {
    if (now > v.resetAt) memoryRateLimitStore.delete(k);
  }
  for (const [k, v] of memoryViolationStore.entries()) {
    if (now > v.resetAt) memoryViolationStore.delete(k);
  }
  for (const [k, exp] of memoryJailStore.entries()) {
    if (now > exp) memoryJailStore.delete(k);
  }
}, 120000).unref?.();

/**
 * Extract verified client IP respecting reverse proxies (Cloudflare, Render Load Balancer).
 */
export function extractClientIp(req: Request): string {
  const cfIp = req.headers['cf-connecting-ip'] as string;
  if (cfIp && typeof cfIp === 'string') return cfIp.trim();

  const xff = req.headers['x-forwarded-for'] as string;
  if (xff && typeof xff === 'string') {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }

  const realIp = req.headers['x-real-ip'] as string;
  if (realIp && typeof realIp === 'string') return realIp.trim();

  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Check if the given client IP is currently jailed.
 */
export async function isIpJailed(ip: string): Promise<boolean> {
  const now = Date.now();

  // 1. Check in-memory store
  const memExpiry = memoryJailStore.get(ip);
  if (memExpiry && now < memExpiry) {
    return true;
  } else if (memExpiry && now >= memExpiry) {
    memoryJailStore.delete(ip);
  }

  // 2. Check Redis store
  if (redisService.isOnline()) {
    const redisJail = await redisService.get<string>(`waf:jail:${ip}`);
    if (redisJail) {
      return true;
    }
  }

  return false;
}

/**
 * Jail an IP for 1 hour (3600 seconds) due to repeated critical violations.
 */
export async function jailIp(ip: string): Promise<void> {
  const oneHourMs = 3600 * 1000;
  memoryJailStore.set(ip, Date.now() + oneHourMs);

  if (redisService.isOnline()) {
    await redisService.set(`waf:jail:${ip}`, 'JAILED', 3600);
  }
}

/**
 * Record a critical violation against an IP. If count reaches 3 within 10 minutes (600s), jail the IP.
 * Returns true if the IP just crossed the threshold into jail.
 */
export async function recordCriticalViolation(ip: string): Promise<boolean> {
  const now = Date.now();
  const tenMinutesMs = 600 * 1000;
  let count = 1;

  // In-memory counter
  const record = memoryViolationStore.get(ip);
  if (!record || now > record.resetAt) {
    memoryViolationStore.set(ip, { count: 1, resetAt: now + tenMinutesMs });
    count = 1;
  } else {
    record.count += 1;
    count = record.count;
  }

  // Redis counter
  if (redisService.isOnline()) {
    try {
      const redisCount = await redisService.incr(`waf:violations:${ip}`, 600);
      if (redisCount > count) count = redisCount;
    } catch {
      // Fallback to in-memory count
    }
  }

  if (count >= 3) {
    await jailIp(ip);
    return true;
  }

  return false;
}

/**
 * Distributed token bucket rate check.
 * Supports Redis with in-memory fallback.
 */
async function checkBucket(key: string, limit: number, windowSec: number): Promise<{ allowed: boolean; remaining: number; retryAfterSec: number }> {
  const now = Date.now();
  const windowMs = windowSec * 1000;

  // Check Redis if online
  if (redisService.isOnline()) {
    try {
      const current = await redisService.incr(key, windowSec);
      if (current > limit) {
        const ttl = await redisService.ttl(key);
        return {
          allowed: false,
          remaining: 0,
          retryAfterSec: ttl > 0 ? ttl : windowSec,
        };
      }
      return {
        allowed: true,
        remaining: Math.max(0, limit - current),
        retryAfterSec: 0,
      };
    } catch {
      // Fallback to in-memory
    }
  }

  // In-memory fallback
  const rec = memoryRateLimitStore.get(key);
  if (!rec || now > rec.resetAt) {
    memoryRateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: limit - 1,
      retryAfterSec: 0,
    };
  }

  rec.count += 1;
  if (rec.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((rec.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: retryAfter,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - rec.count),
    retryAfterSec: 0,
  };
}

/**
 * Check if path or method is exempt from rate limiting (healthchecks, static assets, OPTIONS).
 */
export function isExemptFromRateLimiting(path: string, method: string = 'GET'): boolean {
  if (method === 'OPTIONS') return true;
  const lower = path.toLowerCase();
  return (
    lower === '/' ||
    lower === '/api/health' ||
    lower === '/healthz' ||
    lower.startsWith('/uploads') ||
    lower.startsWith('/api/meta') ||
    lower.startsWith('/api/v1/meta')
  );
}

/**
 * Global Route Limiter: 1200 requests/minute per client IP (supports high-traffic SPAs, websockets & NATs)
 */
export async function checkGlobalRateLimit(ip: string): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const limit = parseInt(process.env.WAF_GLOBAL_RATE_LIMIT || '1200', 10);
  const res = await checkBucket(`waf:ratelimit:global:${ip}`, limit, 60);
  return { allowed: res.allowed, retryAfterSec: res.retryAfterSec };
}

/**
 * Sensitive Module Protection: 120 requests/minute for payroll & broadcast dispatch
 */
export function isSensitiveEndpoint(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.startsWith('/api/payroll') ||
    lower.startsWith('/api/v1/payroll') ||
    lower.includes('/payroll/run') ||
    lower.includes('/broadcast') ||
    lower.includes('/mass-dispatch')
  );
}

export async function checkSensitiveRateLimit(ip: string): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const limit = parseInt(process.env.WAF_SENSITIVE_RATE_LIMIT || '120', 10);
  const res = await checkBucket(`waf:ratelimit:sensitive:${ip}`, limit, 60);
  return { allowed: res.allowed, retryAfterSec: res.retryAfterSec };
}

/**
 * Strict Authentication Limiter: Max 25 failed attempts per 15 minutes (900 seconds)
 */
export function isAuthEndpoint(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower === '/api/v1/auth/login' ||
    lower === '/api/auth/login' ||
    lower === '/api/v1/auth/reset-password' ||
    lower === '/api/auth/reset-password'
  );
}

const memoryFailedAuthStore = new Map<string, MemoryLimitRecord>();

export async function checkFailedAuthLimit(ip: string): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const now = Date.now();
  const windowSec = 900; // 15 minutes
  const limit = parseInt(process.env.WAF_AUTH_FAIL_LIMIT || '25', 10);

  if (redisService.isOnline()) {
    try {
      const count = await redisService.get<number>(`waf:auth:fails:${ip}`);
      if (count && count >= limit) {
        const ttl = await redisService.ttl(`waf:auth:fails:${ip}`);
        return { allowed: false, retryAfterSec: ttl > 0 ? ttl : windowSec };
      }
    } catch {}
  }

  const rec = memoryFailedAuthStore.get(ip);
  if (rec && now < rec.resetAt && rec.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((rec.resetAt - now) / 1000)),
    };
  }

  return { allowed: true, retryAfterSec: 0 };
}

/**
 * Increment failed authentication count when an auth attempt fails (HTTP 401, 403, 400).
 */
export async function recordFailedAuth(ip: string): Promise<boolean> {
  const now = Date.now();
  const windowSec = 900; // 15 mins
  const windowMs = windowSec * 1000;
  let count = 1;

  if (redisService.isOnline()) {
    try {
      count = await redisService.incr(`waf:auth:fails:${ip}`, windowSec);
    } catch {}
  }

  const rec = memoryFailedAuthStore.get(ip);
  if (!rec || now > rec.resetAt) {
    memoryFailedAuthStore.set(ip, { count: 1, resetAt: now + windowMs });
  } else {
    rec.count += 1;
    if (rec.count > count) count = rec.count;
  }

  // If 25 failed attempts reached, treat as a critical violation toward jail
  if (count >= 25) {
    await recordCriticalViolation(ip);
    return true;
  }

  return false;
}

/**
 * Reset memory stores (utility for test suites)
 */
export function resetMemoryStores(): void {
  memoryRateLimitStore.clear();
  memoryViolationStore.clear();
  memoryJailStore.clear();
  memoryFailedAuthStore.clear();
}
