import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';
import {
    updatePromotionDueDate,
    getPromotionDueList,
    getPromotionCandidates,
    syncPromotionCandidates,
    evaluatePromotionCycle,
    batchActionPromotions,
    getPromotionAuditLogs,
    calculateMaturityPreview,
    getPendingPromotionOverrides,
    authorizePromotionOverride,
    rejectPromotionOverride
} from '../controllers/promotion.controller';

const router = Router();

router.use(verifyToken);

const promotionViewRoles = [Role.HR_ADMIN, Role.REGISTRAR, Role.VICE_CHANCELLOR, Role.SUPER_USER, Role.ADMIN];
const promotionManageRoles = [Role.HR_ADMIN, Role.REGISTRAR, Role.VICE_CHANCELLOR, Role.SUPER_USER, Role.ADMIN];
const registrarRoles = [Role.REGISTRAR, Role.SUPER_USER, Role.VICE_CHANCELLOR];

// Preview / Calculation helper
router.get('/calculate', requireRole(promotionViewRoles), calculateMaturityPreview);

// Paginated Due List & Candidates View
router.get('/due-list', requireRole(promotionViewRoles), getPromotionDueList);
router.get('/candidates', requireRole(promotionViewRoles), getPromotionCandidates);

// Pending Promotion Overrides (Registrar Queue)
router.get('/pending-overrides', requireRole(promotionViewRoles), getPendingPromotionOverrides);
router.post('/:staffId/authorize-override', requireRole(registrarRoles), authorizePromotionOverride);
router.post('/:staffId/reject-override', requireRole(registrarRoles), rejectPromotionOverride);

// On-demand Candidate Sync
router.post('/sync-candidates', requireRole(promotionManageRoles), syncPromotionCandidates);

// Audit trail for a specific staff member
router.get('/audit-logs/:staffId', requireRole(promotionViewRoles), getPromotionAuditLogs);

// Schedule & Maturity Override
router.patch('/:staffId/due-date', requireRole(promotionManageRoles), updatePromotionDueDate);

// Evaluate Annual Cycle (Maturity Engine)
router.post('/evaluate-cycle', requireRole(promotionManageRoles), evaluatePromotionCycle);

// Batch Candidate Actions
router.post('/batch-action', requireRole(promotionManageRoles), batchActionPromotions);

export default router;
