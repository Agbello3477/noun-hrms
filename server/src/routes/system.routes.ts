import { Router } from 'express';
import { 
    getAuditLogs, 
    archiveAuditLogs, 
    getSystemSettings, 
    updateSystemSettings, 
    exportSystemAuditReport,
    getEmergencyHotlines,
    getDatabaseRlsStatus,
    triggerEnableDatabaseRls,
    sendTestEmail
} from '../controllers/system.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(verifyToken);
router.get('/logs', requireRole([Role.SUPER_USER, Role.ADMIN]), getAuditLogs);
router.post('/logs/archive', requireRole([Role.SUPER_USER, Role.ADMIN]), archiveAuditLogs);
router.get('/audit/export', requireRole([Role.SUPER_USER, Role.ADMIN]), exportSystemAuditReport);
router.get('/settings', requireRole([Role.SUPER_USER, Role.HR_ADMIN, Role.VICE_CHANCELLOR, Role.ADMIN]), getSystemSettings);
router.put('/settings', requireRole([Role.SUPER_USER, Role.HR_ADMIN, Role.ADMIN]), updateSystemSettings);
router.post('/test-email', requireRole([Role.SUPER_USER, Role.HR_ADMIN, Role.ADMIN]), sendTestEmail);
router.get('/emergency-hotlines', getEmergencyHotlines);

// Row Level Security (RLS) Management & Verification
router.get('/rls/status', requireRole([Role.SUPER_USER, Role.ADMIN]), getDatabaseRlsStatus);
router.post('/rls/enable', requireRole([Role.SUPER_USER, Role.ADMIN]), triggerEnableDatabaseRls);

export default router;

