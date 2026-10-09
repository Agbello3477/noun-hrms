import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/requireRole';
import { cacheMiddleware } from '../../middleware/cacheMiddleware';
import {
  lodgeRequisition,
  getEligibleStaffForRequisition,
  acknowledgeRequisition,
  dispatchRequisition,
  returnRequisition,
  getRegistryInwardQueue,
  getReadyForDispatchQueue,
  getMyRequisitions,
  getRequisitionById,
  getCustodyAuditLedger,
  getDigitalTranscript,
} from '../../controllers/fileRequisition.controller';

const router = Router();

// Apply Authentication guard to all routes
router.use(verifyToken);

// Roles authorized to lodge or view personal/unit file requisitions (Excludes regular STAFF)
const AUTHORIZED_FILE_REQUISITION_ROLES = [
  'UNIT_HEAD',
  'STUDY_CENTER_MANAGER',
  'UNIT_ADMIN',
  'HR_ADMIN',
  'REGISTRY_ADMIN',
  'REGISTRAR',
  'DEPUTY_REGISTRAR',
  'BURSARY',
  'AUDIT',
  'SUPER_USER',
  'ADMIN',
  'VICE_CHANCELLOR',
  'CLINIC_HEAD',
  'CLINIC_DOCTOR',
  'SECURITY_HEAD',
];

const REGISTRY_ALLOWED_ROLES = [
  'REGISTRY_ADMIN',
  'HR_ADMIN',
  'SUPER_USER',
  'ADMIN',
  'REGISTRAR',
  'DEPUTY_REGISTRAR',
  'VICE_CHANCELLOR',
] as any;

// ─── TIER 1: LODGE REQUISITION & PERSONAL VIEWS ──────────────────────────────
router.get(
  '/eligible-staff',
  requireRole(AUTHORIZED_FILE_REQUISITION_ROLES as any),
  getEligibleStaffForRequisition
);

router.post(
  '/lodge',
  requireRole(AUTHORIZED_FILE_REQUISITION_ROLES as any),
  lodgeRequisition
);

// Real-time live personal requisition queue
router.get(
  '/my',
  requireRole(AUTHORIZED_FILE_REQUISITION_ROLES as any),
  getMyRequisitions
);

// ─── TIER 2: REGISTRY INTAKE & QUEUES ────────────────────────────────────────
// Real-time live Registry intake queue (Zero-cache)
router.get(
  '/inward',
  requireRole(REGISTRY_ALLOWED_ROLES),
  getRegistryInwardQueue
);

router.post(
  '/:id/acknowledge',
  requireRole(REGISTRY_ALLOWED_ROLES),
  acknowledgeRequisition
);

// ─── TIER 4: DISPATCH & RELEASE ──────────────────────────────────────────────
// Real-time live dispatch queue (Zero-cache)
router.get(
  '/ready-for-dispatch',
  requireRole(REGISTRY_ALLOWED_ROLES),
  getReadyForDispatchQueue
);

router.post(
  '/:id/dispatch',
  requireRole(REGISTRY_ALLOWED_ROLES),
  dispatchRequisition
);

// ─── TIER 5: RETURN & RE-ARCHIVING ───────────────────────────────────────────
router.post(
  '/:id/return',
  requireRole([...REGISTRY_ALLOWED_ROLES, ...AUTHORIZED_FILE_REQUISITION_ROLES] as any),
  returnRequisition
);

// ─── AUDIT LEDGER & DIGITAL TRANSCRIPT VIEW ─────────────────────────────────
router.get(
  '/audit-ledger',
  requireRole(REGISTRY_ALLOWED_ROLES),
  getCustodyAuditLedger
);

router.get('/:id/digital-view', getDigitalTranscript);
router.get('/:id', getRequisitionById);

export default router;
