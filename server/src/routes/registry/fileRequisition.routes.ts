import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/requireRole';
import {
  lodgeRequisition,
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

// ─── TIER 1: LODGE REQUISITION & PERSONAL VIEWS ──────────────────────────────
router.post('/lodge', lodgeRequisition);
router.get('/my', getMyRequisitions);

// ─── TIER 2: REGISTRY INTAKE & QUEUES ────────────────────────────────────────
router.get(
  '/inward',
  requireRole(['REGISTRY_ADMIN', 'HR_ADMIN', 'SUPER_USER'] as any),
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
  getCustodyAuditLedger
);

router.get('/:id/digital-view', getDigitalTranscript);
router.get('/:id', getRequisitionById);

export default router;
