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

router.get(
  '/my',
  requireRole(AUTHORIZED_FILE_REQUISITION_ROLES as any),
  cacheMiddleware(15, { tags: ['tag:file_requisitions'] }),
  getMyRequisitions
);

// ─── TIER 2: REGISTRY INTAKE & QUEUES ────────────────────────────────────────
router.get(
  '/inward',
  requireRole(['REGISTRY_ADMIN', 'HR_ADMIN', 'SUPER_USER'] as any),
  cacheMiddleware(10, { tags: ['tag:file_requisitions', 'tag:pending_file_docket'] }),
  getRegistryInwardQueue
);

router.post(
  '/:id/acknowledge',
  requireRole(['REGISTRY_ADMIN', 'HR_ADMIN', 'SUPER_USER'] as any),
  acknowledgeRequisition
);

// ─── TIER 4: DISPATCH & RELEASE ──────────────────────────────────────────────
router.get(
  '/ready-for-dispatch',
  requireRole(['REGISTRY_ADMIN', 'HR_ADMIN', 'SUPER_USER'] as any),
  cacheMiddleware(10, { tags: ['tag:file_requisitions', 'tag:pending_file_docket'] }),
  getReadyForDispatchQueue
);

router.post(
  '/:id/dispatch',
  requireRole(['REGISTRY_ADMIN', 'HR_ADMIN', 'SUPER_USER'] as any),
  dispatchRequisition
);

// ─── TIER 5: RETURN & RE-ARCHIVING ───────────────────────────────────────────
router.post(
  '/:id/return',
  requireRole(['REGISTRY_ADMIN', 'HR_ADMIN', 'SUPER_USER'] as any),
  returnRequisition
);

// ─── AUDIT LEDGER & DIGITAL TRANSCRIPT VIEW ─────────────────────────────────
router.get(
  '/audit-ledger',
  requireRole(['REGISTRY_ADMIN', 'HR_ADMIN', 'REGISTRAR', 'DEPUTY_REGISTRAR', 'SUPER_USER'] as any),
  cacheMiddleware(15, { tags: ['tag:file_requisitions'] }),
  getCustodyAuditLedger
);

router.get('/:id/digital-view', getDigitalTranscript);
router.get('/:id', cacheMiddleware(10, { tags: ['tag:file_requisitions'] }), getRequisitionById);

export default router;
