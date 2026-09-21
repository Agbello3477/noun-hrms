import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';
import {
    updatePromotionDueDate,
    getPromotionDueList,
    evaluatePromotionCycle,
    batchActionPromotions,
    getPromotionAuditLogs,
    calculateMaturityPreview
} from '../controllers/promotion.controller';

const router = Router();

// Require JWT authentication for all promotion routes
router.use(verifyToken);

const promotionViewRoles = [Role.HR_ADMIN, Role.VICE_CHANCELLOR, Role.SUPER_USER, Role.ADMIN];
const promotionManageRoles = [Role.HR_ADMIN, Role.VICE_CHANCELLOR, Role.SUPER_USER, Role.ADMIN];

// Preview / Calculation helper
router.get('/calculate', requireRole(promotionViewRoles), calculateMaturityPreview);

// Paginated Due List & Export
router.get('/due-list', requireRole(promotionViewRoles), getPromotionDueList);

// Audit trail for a specific staff member
router.get('/audit-logs/:staffId', requireRole(promotionViewRoles), getPromotionAuditLogs);

// Schedule & Maturity Override
router.patch('/:staffId/due-date', requireRole(promotionManageRoles), updatePromotionDueDate);

// Evaluate Annual Cycle (Maturity Engine)
router.post('/evaluate-cycle', requireRole(promotionManageRoles), evaluatePromotionCycle);

// Batch Candidate Actions
router.post('/batch-action', requireRole(promotionManageRoles), batchActionPromotions);

export default router;
