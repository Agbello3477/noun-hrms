import { Router } from 'express';
import { getHRAnalytics, getManagerDashboardStats } from '../controllers/analytics.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Only HR Admin, Super User, and maybe Audit/Director can see global analytics
router.get('/dashboard',
    verifyToken,
    requireRole([Role.HR_ADMIN, Role.SUPER_USER, Role.AUDIT, Role.UNIT_HEAD, Role.ADMIN]),
    getHRAnalytics
);

// Manager Scoped Dashboard Analytics
router.get('/manager',
    verifyToken,
    requireRole([Role.HR_ADMIN, Role.SUPER_USER, Role.UNIT_HEAD, Role.STUDY_CENTER_MANAGER, Role.UNIT_ADMIN]),
    getManagerDashboardStats
);

export default router;
