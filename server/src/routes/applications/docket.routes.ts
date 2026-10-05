import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/requireRole';
import { cacheMiddleware } from '../../middleware/cacheMiddleware';
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

// Fetch my submitted applications (Session-isolated 15s cache)
router.get('/my-applications', cacheMiddleware(15, { tags: ['tag:institutional_applications'] }), getMyApplications);

// Fetch eligible Directors and caller's auto-detected designated Unit Head / Director
router.get('/eligible-directors', getEligibleDirectors);
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

// Director pending queue (10s active docket cache)
router.get(
  '/director-queue',
  requireRole(['UNIT_HEAD', 'DIRECTOR', 'DEAN', 'SUPER_USER', 'VICE_CHANCELLOR'] as any),
  cacheMiddleware(10, { tags: ['tag:institutional_applications', 'tag:pending_applications_docket'] }),
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

// Registry Inward Desk queue (10s active docket cache)
router.get(
  '/registry-queue',
  requireRole(['REGISTRY_ADMIN', 'HR_ADMIN', 'SUPER_USER', 'REGISTRAR'] as any),
  cacheMiddleware(10, { tags: ['tag:institutional_applications', 'tag:pending_applications_docket'] }),
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

// Registrar Executive application queue (10s active docket cache)
router.get(
  '/registrar-queue',
  requireRole(['REGISTRAR', 'DEPUTY_REGISTRAR', 'SUPER_USER'] as any),
  cacheMiddleware(10, { tags: ['tag:institutional_applications', 'tag:pending_applications_docket'] }),
  getRegistrarQueue
);

// ─────────────────────────────────────────────────────────────────────────────
// MASTER ARCHIVE & DETAIL LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

// Registry Permanent Master Application Archive (30s cache)
router.get('/archive', cacheMiddleware(30, { tags: ['tag:institutional_applications'] }), getMasterArchive);

// Application details by ID with complete revision audit trail (15s cache)
router.get('/:id', cacheMiddleware(15, { tags: ['tag:institutional_applications'] }), getApplicationById);

export default router;
