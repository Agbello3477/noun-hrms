import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import {
    getRoster,
    createRoster,
    getIncidents,
    createIncident,
    updateIncident,
    createConsolidatedReport,
    getConsolidatedReports
} from '../controllers/security.controller';
import { Role } from '@prisma/client';

const router = Router();

router.use(verifyToken);

// Roster Shift assignments
router.get('/roster', requireRole([Role.SECURITY_HEAD, Role.SECURITY_OFFICER, Role.SUPER_USER, Role.ADMIN]), getRoster);
router.post('/roster', requireRole([Role.SECURITY_HEAD, Role.SUPER_USER, Role.ADMIN]), createRoster);

// Incidents list & command center updates
router.get('/incidents', requireRole([Role.SECURITY_HEAD, Role.SECURITY_OFFICER, Role.SUPER_USER, Role.ADMIN]), getIncidents);
router.put('/incidents', requireRole([Role.SECURITY_HEAD, Role.SUPER_USER, Role.ADMIN]), updateIncident);

// Incident report submission (open to ALL authenticated users/staff)
router.post('/incidents', createIncident);

// Consolidated security reporting
router.post('/reports', requireRole([Role.SECURITY_HEAD, Role.SUPER_USER, Role.ADMIN]), createConsolidatedReport);
router.get('/reports', requireRole([Role.SECURITY_HEAD, Role.VICE_CHANCELLOR, Role.SUPER_USER, Role.ADMIN]), getConsolidatedReports);

export default router;
