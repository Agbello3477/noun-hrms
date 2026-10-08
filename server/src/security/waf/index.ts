import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import {
  WafMode,
  WAF_RULES,
  WafViolation,
  SecurityAlertEvent,
} from './types';
import {
  inspectString,
  inspectObject,
  inspectUserAgent,
  inspectHostHeader,
} from './engine';
import {
  extractClientIp,
  isIpJailed,
  recordCriticalViolation,
  isExemptFromRateLimiting,
  checkGlobalRateLimit,
  isSensitiveEndpoint,
  checkSensitiveRateLimit,
  isAuthEndpoint,
  checkFailedAuthLimit,
  recordFailedAuth,
} from './rateLimiter';
import {
  formatWatTimestamp,
  maskPayloadSnippet,
  dispatchSecurityAlert,
} from './telemetry';
import { SentinelSDK } from '../../sentinel-sdk';

export * from './types';
export * from './engine';
export * from './rateLimiter';
export * from './telemetry';
export * from './responseMasker';

export interface WafOptions {
  mode?: WafMode;
  sentinelInstance?: SentinelSDK | null;
  allowedDomains?: string[];
  maxJsonBodyBytes?: number;        // Default: 2MB (2 * 1024 * 1024)
  maxMultipartBodyBytes?: number;   // Default: 25MB (25 * 1024 * 1024)
}

/**
 * Stage 1 WAF Middleware: Pre-Parser Pipeline
 * Mounts before body parsers to evaluate:
 * - IP Jail status (sub-millisecond instant drop)
 * - Scanner User-Agents
 * - Host header verification
 * - Body size ceilings (Content-Length)
 * - URI Path and Query parameter SQLi / XSS / LFI / Cmd Injection
 * - Distributed Token Bucket rate limiters
 */
export function createWafPreParserMiddleware(options: WafOptions = {}) {
  const mode = options.mode || (process.env.WAF_MODE as WafMode) || 'BLOCK';
  const allowedDomains = options.allowedDomains || [
    'nounhrms.web.app',
    'nounhrms.firebaseapp.com',
    'noun-hrms.onrender.com',
    'localhost',
    '127.0.0.1',
  ];
  const maxJsonBytes = options.maxJsonBodyBytes || 2 * 1024 * 1024; // 2MB
  const maxMultipartBytes = options.maxMultipartBodyBytes || 25 * 1024 * 1024; // 25MB

  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime();
    const clientIp = extractClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || '';
    const currentMode = (process.env.WAF_MODE as WafMode) || mode;

    // Helper to send WAF 403 block response
    const blockRequest = (
      statusCode: number,
      code: string,
      rule: string,
      message: string,
      severity: 'MEDIUM' | 'HIGH' | 'CRITICAL',
      sample?: any
    ) => {
      const incidentId = `WAF-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const alert: SecurityAlertEvent = {
        timestamp: formatWatTimestamp(),
        rule,
        severity,
        clientIp,
        userAgent,
        method: req.method,
        uri: req.originalUrl || req.url,
        payloadSnippet: maskPayloadSnippet(sample || `${req.method} ${req.url}`),
        actionTaken: 'BLOCKED',
      };

      dispatchSecurityAlert(alert, options.sentinelInstance);

      if (currentMode === 'MONITOR') {
        (req as any).wafFlagged = true;
        (req as any).wafAlert = alert;
        return next();
      }

      return res.status(statusCode).json({
        error: true,
        code,
        rule,
        message,
        incidentId,
        timestamp: formatWatTimestamp(),
      });
    };

    // 1. IP Jail Verification (< 0.1ms)
    const jailed = await isIpJailed(clientIp);
    if (jailed) {
      return blockRequest(
        403,
        'ERR_IP_TEMPORARILY_BLOCKED',
        WAF_RULES.IP_JAILED,
        'Your IP address has been temporarily blocked due to repeated security policy violations. Contact university security if you believe this is in error.',
        'CRITICAL'
      );
    }

    // 2. User-Agent Scanner Inspection
    const scannerViolation = inspectUserAgent(userAgent);
    if (scannerViolation) {
      await recordCriticalViolation(clientIp);
      return blockRequest(
        403,
        'ERR_SCANNER_DETECTED',
        scannerViolation.rule,
        'Access denied: Automated security vulnerability scanners are prohibited.',
        scannerViolation.severity,
        userAgent
      );
    }

    // 3. Host Header Verification
    const hostViolation = inspectHostHeader(req.headers.host, allowedDomains);
    if (hostViolation) {
      return blockRequest(
        403,
        'ERR_INVALID_HOST_HEADER',
        hostViolation.rule,
        'Access denied: Invalid Host header specification.',
        hostViolation.severity,
        req.headers.host
      );
    }

    // 4. Request Payload Size Hard Ceiling
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const contentType = (req.headers['content-type'] || '').toLowerCase();

    if (contentType.includes('application/json') && contentLength > maxJsonBytes) {
      return blockRequest(
        413,
        'ERR_PAYLOAD_TOO_LARGE',
        WAF_RULES.PAYLOAD_TOO_LARGE,
        `Payload too large: JSON bodies must not exceed ${Math.round(maxJsonBytes / (1024 * 1024))}MB.`,
        'HIGH'
      );
    }

    if (contentType.includes('multipart/form-data') && contentLength > maxMultipartBytes) {
      return blockRequest(
        413,
        'ERR_PAYLOAD_TOO_LARGE',
        WAF_RULES.PAYLOAD_TOO_LARGE,
        `Payload too large: Multipart uploads must not exceed ${Math.round(maxMultipartBytes / (1024 * 1024))}MB.`,
        'HIGH'
      );
    }

    // 5. URI Path and Query Parameter Inspection
    const pathViolations = inspectString(req.path, 'path');
    if (pathViolations.length > 0) {
      const v = pathViolations[0];
      if (v.severity === 'CRITICAL') await recordCriticalViolation(clientIp);
      return blockRequest(
        403,
        'ERR_WAF_SECURITY_VIOLATION',
        v.rule,
        'Request rejected: Malicious pattern detected in URI path.',
        v.severity,
        req.path
      );
    }

    const queryViolations = inspectObject(req.query, 'query');
    if (queryViolations.length > 0) {
      const v = queryViolations[0];
      if (v.severity === 'CRITICAL') await recordCriticalViolation(clientIp);
      return blockRequest(
        403,
        'ERR_WAF_SECURITY_VIOLATION',
        v.rule,
        'Request rejected: Malicious pattern detected in query parameters.',
        v.severity,
        req.query
      );
    }

    // 6. Adaptive Token-Bucket Rate Limiting (skipped for exempt routes like healthchecks, uploads, metadata, OPTIONS)
    if (!isExemptFromRateLimiting(req.path, req.method)) {
      const authHeader = (req.headers.authorization || '') as string;
      const isAuthenticated = authHeader.startsWith('Bearer ') && authHeader.length > 20;
      const rateIdentifier = isAuthenticated
        ? `auth_${crypto.createHash('sha256').update(authHeader).digest('hex').substring(0, 16)}`
        : `ip_${clientIp}`;

      // A. Global route limiter: 3600 req/min (Auth) / 2400 req/min (IP)
      const globalRate = await checkGlobalRateLimit(rateIdentifier, isAuthenticated);
      if (!globalRate.allowed) {
        res.setHeader('Retry-After', globalRate.retryAfterSec);
        return blockRequest(
          429,
          'ERR_GLOBAL_RATE_LIMIT_EXCEEDED',
          WAF_RULES.GLOBAL_RATE_LIMIT_EXCEEDED,
          'Too many requests. Please slow down and try again shortly.',
          'MEDIUM'
        );
      }

      // B. Sensitive module protection: 600 req/min
      if (isSensitiveEndpoint(req.path)) {
        const sensitiveRate = await checkSensitiveRateLimit(rateIdentifier);
        if (!sensitiveRate.allowed) {
          res.setHeader('Retry-After', sensitiveRate.retryAfterSec);
          return blockRequest(
            429,
            'ERR_SENSITIVE_RATE_LIMIT_EXCEEDED',
            WAF_RULES.SENSITIVE_RATE_LIMIT_EXCEEDED,
            'Rate limit exceeded on sensitive operational module. Try again after 1 minute.',
            'HIGH'
          );
        }
      }

      // C. Strict Authentication limiter: Max 25 failed attempts per 15 min
      if (isAuthEndpoint(req.path)) {
        const authLimit = await checkFailedAuthLimit(clientIp);
        if (!authLimit.allowed) {
          res.setHeader('Retry-After', authLimit.retryAfterSec);
          return blockRequest(
            429,
            'ERR_AUTH_RATE_LIMIT_EXCEEDED',
            WAF_RULES.AUTH_BRUTE_FORCE_EXCEEDED,
            'Too many failed login attempts. Authentication has been temporarily restricted for 15 minutes.',
            'HIGH'
          );
        }

        // Track failed attempt on response finish
        res.on('finish', () => {
          if (res.statusCode === 401 || res.statusCode === 400 || res.statusCode === 403) {
            recordFailedAuth(clientIp).catch(() => {});
          }
        });
      }
    }

    // Check overhead latency
    const diff = process.hrtime(startTime);
    const latencyMs = Number(((diff[0] * 1e3) + (diff[1] * 1e-6)).toFixed(3));
    res.setHeader('X-WAF-Latency-Ms', latencyMs.toString());

    next();
  };
}

/**
 * Stage 2 WAF Middleware: Body Inspection Pipeline
 * Mounts immediately after body parsers (express.json) to inspect JSON objects:
 * - Recursive HTML entity & URL decoded XSS
 * - SQL Injection vectors in POST/PUT bodies
 * - Prototype pollution (__proto__, constructor.prototype)
 * - NoSQL injection ($where, $gt, etc.)
 * - Command injection
 */
export function createWafBodyInspectorMiddleware(options: WafOptions = {}) {
  const mode = options.mode || (process.env.WAF_MODE as WafMode) || 'BLOCK';

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
      return next();
    }

    const currentMode = (process.env.WAF_MODE as WafMode) || mode;
    const clientIp = extractClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || '';

    const violations = inspectObject(req.body, 'body');

    if (violations.length > 0) {
      const v = violations[0];
      if (violations.some((item) => item.severity === 'CRITICAL')) {
        await recordCriticalViolation(clientIp);
      }

      const incidentId = `WAF-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const alert: SecurityAlertEvent = {
        timestamp: formatWatTimestamp(),
        rule: v.rule,
        severity: v.severity,
        clientIp,
        userAgent,
        method: req.method,
        uri: req.originalUrl || req.url,
        payloadSnippet: maskPayloadSnippet(req.body),
        actionTaken: 'BLOCKED',
      };

      dispatchSecurityAlert(alert, options.sentinelInstance);

      if (currentMode === 'MONITOR') {
        (req as any).wafFlagged = true;
        (req as any).wafViolations = violations;
        return next();
      }

      return res.status(403).json({
        error: true,
        code: 'ERR_WAF_SECURITY_VIOLATION',
        rule: v.rule,
        message: `Request rejected: Malicious payload pattern detected in body field (${v.field || 'body'}).`,
        incidentId,
        timestamp: formatWatTimestamp(),
      });
    }

    next();
  };
}
