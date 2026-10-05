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
router.get('/my-applications', getMyApplications);
router.get('/my', getMyApplications);

// Fetch eligible Directors and caller's auto-detected designated Unit Head / Director
router.get('/eligible-directors', getEligibleDirectors);
router.get('/directors', getEligibleDirectors);

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2: DIRECTORATE VETTING
// ─────────────────────────────────────────────────────────────────────────────

// Director action: Recommend, Rewrite, or Reject (supports both PUT and POST)
router.put('/:id/director-action', directorAction);
router.post('/:id/director-action', directorAction);

// Director pending queue (supports /director-queue and /director/queue) - Real-time live queue
router.get('/director-queue', getDirectorQueue);
router.get('/director/queue', getDirectorQueue);

// ─────────────────────────────────────────────────────────────────────────────
// TIER 3: REGISTRY INWARD DESK (DOCKETING & ACKNOWLEDGMENT)
// ─────────────────────────────────────────────────────────────────────────────

const REGISTRY_ALLOWED_ROLES = [
  'REGISTRY_ADMIN',
  'HR_ADMIN',
  'SUPER_USER',
  'ADMIN',
  'REGISTRAR',
  'DEPUTY_REGISTRAR',
  'VICE_CHANCELLOR',
] as any;

// Registry Inward Desk folio stamping & acknowledgment (supports both PUT and POST)
router.put('/:id/registry-acknowledge', requireRole(REGISTRY_ALLOWED_ROLES), registryAcknowledge);
router.post('/:id/registry-acknowledge', requireRole(REGISTRY_ALLOWED_ROLES), registryAcknowledge);

// Registry Inward Desk queue (supports /registry-queue and /registry/queue) - Real-time live queue
router.get('/registry-queue', requireRole(REGISTRY_ALLOWED_ROLES), getRegistryQueue);
router.get('/registry/queue', requireRole(REGISTRY_ALLOWED_ROLES), getRegistryQueue);

// ─────────────────────────────────────────────────────────────────────────────
// TIER 4: REGISTRAR FINAL DETERMINATION
// ─────────────────────────────────────────────────────────────────────────────

const REGISTRAR_ALLOWED_ROLES = [
  'REGISTRAR',
  'DEPUTY_REGISTRAR',
  'SUPER_USER',
  'ADMIN',
  'VICE_CHANCELLOR',
] as any;

// Registrar executive final determination (supports both PUT and POST)
router.put('/:id/registrar-decision', requireRole(REGISTRAR_ALLOWED_ROLES), registrarDecision);
router.post('/:id/registrar-decision', requireRole(REGISTRAR_ALLOWED_ROLES), registrarDecision);

// Registrar Executive application queue (supports /registrar-queue and /registrar/queue) - Real-time live queue
router.get('/registrar-queue', requireRole(REGISTRAR_ALLOWED_ROLES), getRegistrarQueue);
router.get('/registrar/queue', requireRole(REGISTRAR_ALLOWED_ROLES), getRegistrarQueue);

// ─────────────────────────────────────────────────────────────────────────────
// MASTER ARCHIVE & DETAIL LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

// Registry Permanent Master Application Archive (supports /archive and /archive/master)
router.get('/archive', cacheMiddleware(30, { tags: ['tag:institutional_applications'] }), getMasterArchive);
router.get('/archive/master', cacheMiddleware(30, { tags: ['tag:institutional_applications'] }), getMasterArchive);

// Application details by ID with complete revision audit trail
router.get('/:id', getApplicationById);

export default router;
