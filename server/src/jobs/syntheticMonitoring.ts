import http from 'http';
import https from 'https';
import cron from 'node-cron';
import { logger } from '../services/observability.service';

const pingEndpoint = (targetUrl: string, probeId: string): Promise<void> => {
    return new Promise((resolve) => {
        const start = process.hrtime();
        const client = targetUrl.startsWith('https') ? https : http;

        const req = client.get(targetUrl, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                const diff = process.hrtime(start);
                const durationMs = (diff[0] * 1e9 + diff[1]) / 1e6;

                if (res.statusCode === 200) {
                    logger.info('[Synthetic Monitor] Health Probe Passed', {
                        probeId,
                        target: targetUrl,
                        statusCode: res.statusCode,
                        latencyMs: Number(durationMs.toFixed(2)),
                        status: 'SUCCESS'
                    });
                } else {
                    logger.warn('[Synthetic Monitor] Health Probe Returned Non-200', {
                        probeId,
                        target: targetUrl,
                        statusCode: res.statusCode,
                        latencyMs: Number(durationMs.toFixed(2)),
                        status: 'FAIL',
                        response: body
                    });
                }
                resolve();
            });
        });

        req.on('error', (err) => {
            const diff = process.hrtime(start);
            const durationMs = (diff[0] * 1e9 + diff[1]) / 1e6;

            logger.error('[Synthetic Monitor] Health Probe Failed to Connect', {
                probeId,
                target: targetUrl,
                error: err.message,
                latencyMs: Number(durationMs.toFixed(2)),
                status: 'CRITICAL'
            });
            resolve();
        });

        req.end();
    });
};

export const runSyntheticChecks = async (): Promise<void> => {
    const port = process.env.PORT || 5055;
    const localUrl = `http://localhost:${port}/healthz`;
    const publicUrl = process.env.PUBLIC_API_URL || 'https://noun-hrms.onrender.com/healthz';

    const traceId = `synthetic-probe-${Date.now()}`;

    // Execute both local probe and external public HTTPS probe to keep Render warm
    await Promise.all([
        pingEndpoint(localUrl, `${traceId}-local`),
        pingEndpoint(publicUrl, `${traceId}-external`)
    ]);
};

export const scheduleSyntheticMonitoring = () => {
    // Run synthetic monitoring and Render keep-alive warming checks every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        await runSyntheticChecks();
    });

    logger.info('[Synthetic Monitor] External keep-alive warming checks scheduled to run every 5 minutes.');
};
