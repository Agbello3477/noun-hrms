import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { traceLocalStorage, logger, sloTracker } from '../services/observability.service';

export const observabilityMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // 1. Resolve or generate traceId
    const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();

    // 2. Set traceId on response headers for correlation/client verification
    res.setHeader('x-trace-id', traceId);

    // 3. Capture request start time
    const start = process.hrtime();

    // 4. Run the request within the AsyncLocalStorage tracing boundary
    traceLocalStorage.run({ traceId }, () => {
        res.on('finish', () => {
            const diff = process.hrtime(start);
            const durationMs = (diff[0] * 1e9 + diff[1]) / 1e6;

            // Record request outcomes to SLO metrics tracker
            sloTracker.recordRequest(res.statusCode, durationMs);

            // Correlated request logging
            logger.info('HTTP Request Processed', {
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                durationMs: Number(durationMs.toFixed(2)),
                userAgent: req.headers['user-agent'],
                ip: req.ip || req.socket.remoteAddress || '127.0.0.1'
            });
        });

        res.on('error', (err) => {
            logger.error('HTTP Request Response Error', {
                method: req.method,
                url: req.originalUrl,
                error: err.message
            });
        });

        next();
    });
};
