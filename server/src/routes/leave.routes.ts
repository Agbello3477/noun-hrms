
import { Router } from 'express';
import { applyForLeave, getMyLeaves, getUnitPendingLeaves, updateLeaveStatus } from '../controllers/leave.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';
import { validate, leaveApplySchema } from '../middleware/validation';

const router = Router();

router.use(verifyToken);

// All Staff
router.post('/apply', validate(leaveApplySchema), applyForLeave);
router.get('/me', getMyLeaves);

// Unit Heads / Directors / Center Managers
const approvalRoles = [
    Role.UNIT_HEAD,
    Role.STUDY_CENTER_MANAGER,
    Role.HR_ADMIN,
    Role.ADMIN,
    Role.SUPER_USER,
    Role.VICE_CHANCELLOR
];

router.get('/pending', requireRole(approvalRoles), getUnitPendingLeaves);
router.post('/status', requireRole(approvalRoles), updateLeaveStatus);

export default router;
