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
  logDossierAccessAction,
  getDossierAuditLedger,
  sendDossierInquiry,
  getMyDossierInquiries,
  submitDossierJustification,
  resolveDossierInquiry,
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

// ─── DOSSIER DOWNLOAD / PRINT SECURITY AUDIT & REGISTRY INQUIRY ─────────────
// Log any download or print action (authenticated users)
router.post('/dossier-action', logDossierAccessAction);

// Registry view of all dossier download / print audit logs
router.get(
  '/dossier-audit-ledger',
  requireRole(REGISTRY_ALLOWED_ROLES),
  getDossierAuditLedger
);

// Registry dispatches inquiry requesting reason for download/print
router.post(
  '/dossier-inquiry',
  requireRole(REGISTRY_ALLOWED_ROLES),
  sendDossierInquiry
);

// Target officer gets their pending inquiries
router.get('/my-dossier-inquiries', getMyDossierInquiries);

// Target officer submits their official reason/justification
router.post('/submit-justification', submitDossierJustification);

// Registry resolves/acknowledges the justification
router.post(
  '/resolve-inquiry',
  requireRole(REGISTRY_ALLOWED_ROLES),
  resolveDossierInquiry
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

