import { Router, Request, Response } from 'express';
import express from 'express';
import { sloTracker, logger } from '../services/observability.service';

const router = Router();

// Ensure body parser supports application/csp-report
const reportParser = express.json({ type: ['application/json', 'application/csp-report'] });

// 1. Outside-In Monitor Target (Ping)
router.get('/ping', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString()
    });
});

// 2. Service Level Objectives (SLOs) report
router.get('/slo', (req: Request, res: Response) => {
    const report = sloTracker.getSloStatus();
    res.status(200).json(report);
});

// 2b. Prometheus Exporter Endpoint (/metrics)
router.get('/metrics', (req: Request, res: Response) => {
    const slo = sloTracker.getSloStatus();
    const failedRequests = Math.round(slo.totalRequests * (1 - slo.availabilitySli / 100));
    const metricsText = [
        '# HELP hrms_uptime_status Status of the HRMS server (1 = UP, 0 = DOWN)',
        '# TYPE hrms_uptime_status gauge',
        'hrms_uptime_status 1',
        '# HELP hrms_availability_sli_ratio Current 30-day rolling availability ratio',
        '# TYPE hrms_availability_sli_ratio gauge',
        `hrms_availability_sli_ratio ${(slo.availabilitySli / 100).toFixed(4)}`,
        '# HELP hrms_latency_sli_ratio Current latency ratio under 500ms target',
        '# TYPE hrms_latency_sli_ratio gauge',
        `hrms_latency_sli_ratio ${(slo.latencySli / 100).toFixed(4)}`,
        '# HELP hrms_total_requests Total processed HTTP requests',
        '# TYPE hrms_total_requests counter',
        `hrms_total_requests ${slo.totalRequests}`,
        '# HELP hrms_failed_requests Total failed HTTP requests',
        '# TYPE hrms_failed_requests counter',
        `hrms_failed_requests ${failedRequests}`
    ].join('\n');

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(metricsText);
});

// 3. Content Security Policy Violation Collector (Report-Only)
router.post('/csp-report', reportParser, (req: Request, res: Response) => {
    const report = req.body?.['csp-report'] || req.body;
    
    if (report) {
        logger.warn('CSP Violation Detected', {
            documentUri: report['document-uri'],
            referrer: report['referrer'],
            blockedUri: report['blocked-uri'],
            violatedDirective: report['violated-directive'],
            originalPolicy: report['original-policy']
        });
    } else {
        logger.warn('Received empty or malformed CSP report', { body: req.body });
    }

    res.status(204).end(); // No content response for reports
});

export default router;
