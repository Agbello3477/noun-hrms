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

// Resubmit application after Director rewrite request (supports both PUT and POST)
router.put('/:id/resubmit', resubmitApplication);
router.post('/:id/resubmit', resubmitApplication);

// Fetch my submitted applications (supports /my-applications and /my)
router.get('/my-applications', cacheMiddleware(15, { tags: ['tag:institutional_applications'] }), getMyApplications);
router.get('/my', cacheMiddleware(15, { tags: ['tag:institutional_applications'] }), getMyApplications);

// Fetch eligible Directors and caller's auto-detected designated Unit Head / Director
router.get('/eligible-directors', getEligibleDirectors);
router.get('/directors', getEligibleDirectors);

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2: DIRECTORATE VETTING
// ─────────────────────────────────────────────────────────────────────────────

// Director action: Recommend, Rewrite, or Reject (supports both PUT and POST)
router.put('/:id/director-action', directorAction);
router.post('/:id/director-action', directorAction);

// Director pending queue (supports /director-queue and /director/queue)
router.get(
  '/director-queue',
  cacheMiddleware(10, { tags: ['tag:institutional_applications', 'tag:pending_applications_docket'] }),
  getDirectorQueue
);
router.get(
  '/director/queue',
  cacheMiddleware(10, { tags: ['tag:institutional_applications', 'tag:pending_applications_docket'] }),
  getDirectorQueue
);

// ─────────────────────────────────────────────────────────────────────────────
// TIER 3: REGISTRY INWARD DESK (DOCKETING & ACKNOWLEDGMENT)
// ─────────────────────────────────────────────────────────────────────────────

// Registry Inward Desk folio stamping & acknowledgment (supports both PUT and POST)
router.put(
  '/:id/registry-acknowledge',
  requireRole(['REGISTRY_ADMIN', 'HR_ADMIN', 'SUPER_USER'] as any),
  registryAcknowledge
);
router.post(
  '/:id/registry-acknowledge',
  requireRole(['REGISTRY_ADMIN', 'HR_ADMIN', 'SUPER_USER'] as any),
  registryAcknowledge
);

// Registry Inward Desk queue (supports /registry-queue and /registry/queue)
router.get(
  '/registry-queue',
  requireRole(['REGISTRY_ADMIN', 'HR_ADMIN', 'SUPER_USER', 'REGISTRAR'] as any),
  cacheMiddleware(10, { tags: ['tag:institutional_applications', 'tag:pending_applications_docket'] }),
  getRegistryQueue
);
router.get(
  '/registry/queue',
  requireRole(['REGISTRY_ADMIN', 'HR_ADMIN', 'SUPER_USER', 'REGISTRAR'] as any),
  cacheMiddleware(10, { tags: ['tag:institutional_applications', 'tag:pending_applications_docket'] }),
  getRegistryQueue
);

// ─────────────────────────────────────────────────────────────────────────────
// TIER 4: REGISTRAR FINAL DETERMINATION
// ─────────────────────────────────────────────────────────────────────────────

// Registrar executive final determination (supports both PUT and POST)
router.put(
  '/:id/registrar-decision',
  requireRole(['REGISTRAR', 'DEPUTY_REGISTRAR', 'SUPER_USER'] as any),
  registrarDecision
);
router.post(
  '/:id/registrar-decision',
  requireRole(['REGISTRAR', 'DEPUTY_REGISTRAR', 'SUPER_USER'] as any),
  registrarDecision
);

// Registrar Executive application queue (supports /registrar-queue and /registrar/queue)
router.get(
  '/registrar-queue',
  requireRole(['REGISTRAR', 'DEPUTY_REGISTRAR', 'SUPER_USER'] as any),
  cacheMiddleware(10, { tags: ['tag:institutional_applications', 'tag:pending_applications_docket'] }),
  getRegistrarQueue
);
router.get(
  '/registrar/queue',
  requireRole(['REGISTRAR', 'DEPUTY_REGISTRAR', 'SUPER_USER'] as any),
  cacheMiddleware(10, { tags: ['tag:institutional_applications', 'tag:pending_applications_docket'] }),
  getRegistrarQueue
);

// ─────────────────────────────────────────────────────────────────────────────
// MASTER ARCHIVE & DETAIL LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

// Registry Permanent Master Application Archive (supports /archive and /archive/master)
router.get('/archive', cacheMiddleware(30, { tags: ['tag:institutional_applications'] }), getMasterArchive);
router.get('/archive/master', cacheMiddleware(30, { tags: ['tag:institutional_applications'] }), getMasterArchive);

// Application details by ID with complete revision audit trail
router.get('/:id', cacheMiddleware(15, { tags: ['tag:institutional_applications'] }), getApplicationById);

export default router;
