import { Router } from 'express';
import {
  applyForStatutoryLeave,
  getMyLeaveBalances,
  getMyLeaveApplications,
  getPendingLeaveApplications,
  endorseLeaveByHod,
  authorizeLeaveByRegistry,
  authorizeLeaveByDean,
  rejectLeaveApplication,
  previewWorkingDays,
  getMyFacultyHierarchy
} from '../controllers/leaveApplication.controller';
import {
  createLeaveSession,
  updateLeaveSession,
  getLeaveSessions,
  getActiveLeaveSession,
  deleteLeaveSession
} from '../controllers/leaveSession.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(verifyToken);

// Leave Sessions (Registry Annual Exercise Windows)
const registryRoles = [
  Role.HR_ADMIN,
  Role.REGISTRY_ADMIN,
  Role.REGISTRAR,
  Role.DEPUTY_REGISTRAR,
  Role.SUPER_USER,
  Role.ADMIN,
  Role.VICE_CHANCELLOR
];

router.get('/sessions', getLeaveSessions);
router.get('/sessions/active', getActiveLeaveSession);
router.post('/sessions', requireRole(registryRoles), createLeaveSession);
router.put('/sessions/:id', requireRole(registryRoles), updateLeaveSession);
router.delete('/sessions/:id', requireRole(registryRoles), deleteLeaveSession);

// Staff self-service endpoints
router.post('/apply', applyForStatutoryLeave);
router.post('/preview-working-days', previewWorkingDays);
router.get('/balances', getMyLeaveBalances);
router.get('/applications/my', getMyLeaveApplications);
router.get('/faculty-hierarchy', getMyFacultyHierarchy);

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
router.put('/:id/authorize-dean', requireRole(approverRoles), authorizeLeaveByDean);
router.put(
  '/:id/authorize-registry',
  requireRole(approverRoles),
  authorizeLeaveByRegistry
);
router.put('/:id/reject', requireRole(approverRoles), rejectLeaveApplication);

export default router;

