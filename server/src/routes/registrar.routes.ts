import { Router } from 'express';
import { verifyJwt } from '../middleware/verifyJwt';
import { requireRole } from '../middleware/requireRole';
import { enforceMakerChecker } from '../middleware/enforceMakerChecker';
import { authorizeStaffPostingHandler } from '../controllers/registrarPostingController';
import { clearStaffFileHandler } from '../controllers/registrarFileController';

const router = Router();

// Staff Posting Authorization (Absolute path)
router.put(
  '/api/v1/registrar/postings/:id/authorize',
  verifyJwt,
  requireRole(['REGISTRAR', 'DEPUTY_REGISTRAR', 'SUPER_USER', 'VICE_CHANCELLOR']),
  enforceMakerChecker({
    entityType: 'staffPosting',
    paramKey: 'id',
    imputerField: 'imputedById',
    statusField: 'status',
    allowedStatuses: ['PENDING_REGISTRAR_AUTHORIZATION', 'PENDING_REGISTRAR_APPROVAL']
  }),
  authorizeStaffPostingHandler
);

// Staff Posting Authorization (Mounted relative path)
router.put(
  '/postings/:id/authorize',
  verifyJwt,
  requireRole(['REGISTRAR', 'DEPUTY_REGISTRAR', 'SUPER_USER', 'VICE_CHANCELLOR']),
  enforceMakerChecker({
    entityType: 'staffPosting',
    paramKey: 'id',
    imputerField: 'imputedById',
    statusField: 'status',
    allowedStatuses: ['PENDING_REGISTRAR_AUTHORIZATION', 'PENDING_REGISTRAR_APPROVAL']
  }),
  authorizeStaffPostingHandler
);

// New Staff Digital File Clearance & Account Release (Absolute path)
router.put(
  '/api/v1/registrar/files/:staffId/clear',
  verifyJwt,
  requireRole(['REGISTRAR', 'SUPER_USER', 'VICE_CHANCELLOR']),
  enforceMakerChecker({
    entityType: 'staffProfile',
    paramKey: 'staffId',
    imputerField: 'createdById',
    statusField: 'accountStatus',
    allowedStatuses: ['PENDING_REGISTRAR_CLEARANCE']
  }),
  clearStaffFileHandler
);

// New Staff Digital File Clearance & Account Release (Mounted relative path)
router.put(
  '/files/:staffId/clear',
  verifyJwt,
  requireRole(['REGISTRAR', 'SUPER_USER', 'VICE_CHANCELLOR']),
  enforceMakerChecker({
    entityType: 'staffProfile',
    paramKey: 'staffId',
    imputerField: 'createdById',
    statusField: 'accountStatus',
    allowedStatuses: ['PENDING_REGISTRAR_CLEARANCE']
  }),
  clearStaffFileHandler
);

export default router;
