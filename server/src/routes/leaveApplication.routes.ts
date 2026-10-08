import { Router } from 'express';
import {
  applyForStatutoryLeave,
  getMyLeaveBalances,
  getMyLeaveApplications,
  getPendingLeaveApplications,
  endorseLeaveByHod,
  authorizeLeaveByRegistry,
  rejectLeaveApplication,
  previewWorkingDays
} from '../controllers/leaveApplication.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(verifyToken);

// Staff self-service endpoints
router.post('/apply', applyForStatutoryLeave);
router.post('/preview-working-days', previewWorkingDays);
router.get('/balances', getMyLeaveBalances);
router.get('/applications/my', getMyLeaveApplications);

// Approver / Registry endpoints
const approverRoles = [
  Role.UNIT_HEAD,
  Role.UNIT_ADMIN,
  Role.STUDY_CENTER_MANAGER,
  Role.CLINIC_HEAD,
  Role.SECURITY_HEAD,
  Role.HR_ADMIN,
  Role.REGISTRY_ADMIN,
  Role.REGISTRAR,
  Role.DEPUTY_REGISTRAR,
  Role.SUPER_USER,
  Role.VICE_CHANCELLOR
];

router.get('/applications/pending', requireRole(approverRoles), getPendingLeaveApplications);
router.put('/:id/endorse-hod', requireRole(approverRoles), endorseLeaveByHod);
router.put(
  '/:id/authorize-registry',
  requireRole([
    Role.HR_ADMIN,
    Role.REGISTRY_ADMIN,
    Role.REGISTRAR,
    Role.DEPUTY_REGISTRAR,
    Role.SUPER_USER,
    Role.VICE_CHANCELLOR
  ]),
  authorizeLeaveByRegistry
);
router.put('/:id/reject', requireRole(approverRoles), rejectLeaveApplication);

export default router;
