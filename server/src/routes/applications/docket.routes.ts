import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/requireRole';
import {
  submitApplication,
  resubmitApplication,
  directorAction,
  registryAcknowledge,
  registrarDecision,
  getMyApplications,
  getDirectorQueue,
  getRegistryQueue,
  getRegistrarQueue,
  getMasterArchive,
  getEligibleDirectors,
  getApplicationById,
} from '../../controllers/applicationWorkflowController';

const router = Router();

// Apply Authentication guard to all routes
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1: STAFF SUBMISSION & REVISION
// ─────────────────────────────────────────────────────────────────────────────

// Submit a new application routed through Director
router.post('/submit', submitApplication);

// Resubmit application after Director rewrite request
router.put('/:id/resubmit', resubmitApplication);

// Fetch my submitted applications
router.get('/my-applications', getMyApplications);

// Fetch eligible Directors for submission dropdown
router.get('/directors', getEligibleDirectors);

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2: DIRECTORATE VETTING
// ─────────────────────────────────────────────────────────────────────────────

// Director action: Recommend, Rewrite, or Reject
router.put(
  '/:id/director-action',
  requireRole(['UNIT_HEAD', 'DIRECTOR', 'DEAN', 'SUPER_USER', 'VICE_CHANCELLOR'] as any),
  directorAction
);

// Director pending queue
router.get(
  '/director-queue',
  requireRole(['UNIT_HEAD', 'DIRECTOR', 'DEAN', 'SUPER_USER', 'VICE_CHANCELLOR'] as any),
  getDirectorQueue
);

// ─────────────────────────────────────────────────────────────────────────────
// TIER 3: REGISTRY INWARD DESK (DOCKETING & ACKNOWLEDGMENT)
// ─────────────────────────────────────────────────────────────────────────────

// Registry Inward Desk folio stamping & acknowledgment
router.put(
  '/:id/registry-acknowledge',
  requireRole(['REGISTRY_ADMIN', 'HR_ADMIN', 'SUPER_USER'] as any),
  registryAcknowledge
);

// Registry Inward Desk queue
router.get(
  '/registry-queue',
  requireRole(['REGISTRY_ADMIN', 'HR_ADMIN', 'SUPER_USER', 'REGISTRAR'] as any),
  getRegistryQueue
);

// ─────────────────────────────────────────────────────────────────────────────
// TIER 4: REGISTRAR FINAL DETERMINATION
// ─────────────────────────────────────────────────────────────────────────────

// Registrar executive final determination (Dual-Control Maker-Checker enforced)
router.put(
  '/:id/registrar-decision',
  requireRole(['REGISTRAR', 'DEPUTY_REGISTRAR', 'SUPER_USER'] as any),
  registrarDecision
);

// Registrar Executive application queue
router.get(
  '/registrar-queue',
  requireRole(['REGISTRAR', 'DEPUTY_REGISTRAR', 'SUPER_USER'] as any),
  getRegistrarQueue
);

// ─────────────────────────────────────────────────────────────────────────────
// MASTER ARCHIVE & DETAIL LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

// Registry Permanent Master Application Archive
router.get('/archive', getMasterArchive);

// Application details by ID with complete revision audit trail
router.get('/:id', getApplicationById);

export default router;
