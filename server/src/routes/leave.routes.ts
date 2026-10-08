import { Router } from 'express';
import { applyForLeave, getMyLeaves, getUnitPendingLeaves, updateLeaveStatus, getActiveLeaves, resumeFromLeave } from '../controllers/leave.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';
import { validate, leaveApplySchema } from '../middleware/validation';

const router = Router();

router.use(verifyToken);

// All Staff
router.post('/apply', validate(leaveApplySchema), applyForLeave);
router.post('/resume', resumeFromLeave);
router.get('/me', getMyLeaves);
router.get('/active', getActiveLeaves);

// Unit Heads / Directors / Center Managers / Departmental Heads
const approvalRoles = [
    Role.UNIT_HEAD,
    Role.UNIT_ADMIN,
    Role.STUDY_CENTER_MANAGER,
    Role.CLINIC_HEAD,
    Role.SECURITY_HEAD,
    Role.BURSARY,
    Role.AUDIT,
    Role.HR_ADMIN,
    Role.ADMIN,
    Role.SUPER_USER,
    Role.VICE_CHANCELLOR
];

router.get('/pending', requireRole(approvalRoles), getUnitPendingLeaves);
router.post('/status', requireRole(approvalRoles), updateLeaveStatus);

export default router;
