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
