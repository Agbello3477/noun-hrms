import { Router } from 'express';
import { getHRAnalytics, getManagerDashboardStats, getRecruitmentAnalytics } from '../controllers/analytics.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Only HR Admin, Super User, and maybe Audit/Director can see global analytics
router.get('/dashboard',
    verifyToken,
    requireRole([Role.HR_ADMIN, Role.SUPER_USER, Role.AUDIT, Role.UNIT_HEAD, Role.ADMIN, Role.VICE_CHANCELLOR]),
    getHRAnalytics
);

// Manager Scoped Dashboard Analytics
router.get('/manager',
    verifyToken,
    requireRole([Role.HR_ADMIN, Role.SUPER_USER, Role.UNIT_HEAD, Role.STUDY_CENTER_MANAGER, Role.UNIT_ADMIN, Role.VICE_CHANCELLOR]),
    getManagerDashboardStats
);

// HR Recruitment Analytics with filters (year, month, gender, zone, region)
router.get('/recruitment',
    verifyToken,
    requireRole([Role.HR_ADMIN, Role.SUPER_USER, Role.AUDIT, Role.ADMIN, Role.VICE_CHANCELLOR]),
    getRecruitmentAnalytics
);

export default router;
