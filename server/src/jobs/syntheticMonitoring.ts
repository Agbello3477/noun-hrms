import http from 'http';
import cron from 'node-cron';
import { logger } from '../services/observability.service';

export const runSyntheticChecks = async (): Promise<void> => {
    const port = process.env.PORT || 5055;
    const targetUrl = `http://localhost:${port}/healthz`;
    const start = process.hrtime();

    const traceId = `synthetic-probe-${Date.now()}`;

    // Execute health check
    const req = http.get(targetUrl, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
            const diff = process.hrtime(start);
            const durationMs = (diff[0] * 1e9 + diff[1]) / 1e6;

            if (res.statusCode === 200) {
                logger.info('[Synthetic Monitor] Health Check Passed', {
                    probeId: traceId,
                    target: targetUrl,
                    statusCode: res.statusCode,
                    latencyMs: Number(durationMs.toFixed(2)),
                    status: 'SUCCESS'
                });
            } else {
                logger.warn('[Synthetic Monitor] Health Check Returned Non-200', {
                    probeId: traceId,
                    target: targetUrl,
                    statusCode: res.statusCode,
                    latencyMs: Number(durationMs.toFixed(2)),
                    status: 'FAIL',
                    response: body
                });
            }
        });
    });

    req.on('error', (err) => {
        const diff = process.hrtime(start);
        const durationMs = (diff[0] * 1e9 + diff[1]) / 1e6;

        logger.error('[Synthetic Monitor] Health Check Failed to Connect', {
            probeId: traceId,
            target: targetUrl,
            error: err.message,
            latencyMs: Number(durationMs.toFixed(2)),
            status: 'CRITICAL'
        });
    });

    req.end();
};

export const scheduleSyntheticMonitoring = () => {
    // Run synthetic monitoring probe checks every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        await runSyntheticChecks();
    });

    logger.info('[Synthetic Monitor] Synthetic checks scheduled to run every 5 minutes.');
};
