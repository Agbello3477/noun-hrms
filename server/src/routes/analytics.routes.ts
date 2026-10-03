import { Router } from 'express';
import { getHRAnalytics, getManagerDashboardStats, getRecruitmentAnalytics, getVcExecutiveAnalytics, getDashboardBootstrap, getSlaKpiMetrics } from '../controllers/analytics.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { cacheMiddleware } from '../middleware/cacheMiddleware';
import { Role } from '@prisma/client';

const router = Router();

// Service Request SLA & KPI Timeframe Engine
router.get('/sla-kpi',
    verifyToken,
    cacheMiddleware(30, { tags: ['tag:dashboard_kpis'] }),
    getSlaKpiMetrics
);

// Consolidated Single-Payload Dashboard Bootstrap (sub-5ms fast load via Layer 2 cache)
router.get('/dashboard-bootstrap',
    verifyToken,
    cacheMiddleware(30, { tags: ['tag:dashboard_kpis'] }),
    getDashboardBootstrap
);

// VC Executive Command Dashboard
router.get('/vc-executive',
    verifyToken,
    requireRole([Role.VICE_CHANCELLOR, Role.SUPER_USER]),
    cacheMiddleware(60, { tags: ['tag:dashboard_kpis', 'tag:executive_analytics'] }),
    getVcExecutiveAnalytics
);

// Only HR Admin, Super User, and maybe Audit/Director can see global analytics
router.get('/dashboard',
    verifyToken,
    requireRole([Role.HR_ADMIN, Role.SUPER_USER, Role.AUDIT, Role.UNIT_HEAD, Role.ADMIN, Role.VICE_CHANCELLOR]),
    cacheMiddleware(30, { tags: ['tag:dashboard_kpis'] }),
    getHRAnalytics
);

// Manager Scoped Dashboard Analytics
router.get('/manager',
    verifyToken,
    requireRole([Role.HR_ADMIN, Role.SUPER_USER, Role.UNIT_HEAD, Role.STUDY_CENTER_MANAGER, Role.UNIT_ADMIN, Role.VICE_CHANCELLOR]),
    cacheMiddleware(30, { tags: ['tag:dashboard_kpis', 'tag:manager_dashboard'] }),
    getManagerDashboardStats
);

// HR Recruitment Analytics with filters (year, month, gender, zone, region)
router.get('/recruitment',
    verifyToken,
    requireRole([Role.HR_ADMIN, Role.SUPER_USER, Role.AUDIT, Role.ADMIN, Role.VICE_CHANCELLOR]),
    cacheMiddleware(60, { tags: ['tag:dashboard_kpis'] }),
    getRecruitmentAnalytics
);

export default router;
