import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { formatWatTimestamp } from './telemetry';

const REGEX_PRISMA_ERRORS = /(?:PrismaClientKnownRequestError|PrismaClientUnknownRequestError|PrismaClientValidationError|PrismaClientRustPanicError|PrismaClientInitializationError)/i;
const REGEX_SQL_TRACES = /(?:syntax error at or near|violates foreign key constraint|relation ".*" does not exist|column ".*" does not exist|SELECT\s+.*FROM|INSERT\s+INTO|UPDATE\s+.*SET|DELETE\s+FROM)/i;
const REGEX_STACK_TRACES = /\s+at\s+[\w\.<>$\/\\-]+\s*\([^\)]+:\d+:\d+\)|\s+at\s+[^\n]+:\d+:\d+/;
const REGEX_INTERNAL_PATHS = /(?:\/(?:Users|home|app|var|etc|opt)\/[\w\.-]+|node_modules[\/\\]|[a-zA-Z]:\\[\w\.-]+)/i;

/**
 * Sanitize error message or string from data leakages
 */
export function sanitizeServerErrorMessage(message: string): string {
  if (!message || typeof message !== 'string') return message;

  if (
    REGEX_PRISMA_ERRORS.test(message) ||
    REGEX_SQL_TRACES.test(message) ||
    REGEX_STACK_TRACES.test(message) ||
    REGEX_INTERNAL_PATHS.test(message)
  ) {
    return 'A database or internal service error occurred. The trace has been suppressed for security.';
  }

  return message;
}

/**
 * Middleware: Zero-Trust Response Masking Interceptor.
 * Intercepts res.send and res.json for 500-level error responses to guarantee
 * no database error traces, stack traces, or internal server paths leak to clients.
 */
export function zeroTrustResponseMaskingMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = function (body: any): Response {
    if (res.statusCode >= 500) {
      const incidentId = `SEC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      
      // Log full internal error on server console for sysadmin debugging
      console.error(`🔒 [Zero-Trust Masker] Incident ${incidentId} on ${req.method} ${req.originalUrl}:`, body);

      const safePayload = {
        error: true,
        code: 'ERR_INTERNAL_SERVER_ERROR',
        message: 'A secure server error occurred. The incident has been recorded for review.',
        incidentId,
        timestamp: formatWatTimestamp(),
      };

      return originalJson(safePayload);
    }
    return originalJson(body);
  };

  res.send = function (body: any): Response {
    if (res.statusCode >= 500) {
      if (typeof body === 'string') {
        try {
          const parsed = JSON.parse(body);
          return res.json(parsed);
        } catch {
          const incidentId = `SEC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
          return originalSend(JSON.stringify({
            error: true,
            code: 'ERR_INTERNAL_SERVER_ERROR',
            message: 'A secure server error occurred. The incident has been recorded for review.',
            incidentId,
            timestamp: formatWatTimestamp(),
          }));
        }
      }
    }
    return originalSend(body);
  };

  next();
}
