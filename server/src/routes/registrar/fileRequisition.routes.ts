import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/requireRole';
import { cacheMiddleware } from '../../middleware/cacheMiddleware';
import {
  getRegistrarPendingQueue,
  registrarAuthorizeRequisition,
  getRequisitionById,
} from '../../controllers/fileRequisition.controller';

const router = Router();

// Apply Authentication guard to all routes
router.use(verifyToken);

// Strictly guarded to Registrar executive roles
const registrarGuard = requireRole(['REGISTRAR', 'DEPUTY_REGISTRAR', 'SUPER_USER'] as any);

router.get('/pending', registrarGuard, cacheMiddleware(10, { tags: ['tag:file_requisitions', 'tag:pending_file_docket'] }), getRegistrarPendingQueue);
router.post('/:id/authorize', registrarGuard, registrarAuthorizeRequisition);
router.get('/:id', registrarGuard, cacheMiddleware(10, { tags: ['tag:file_requisitions'] }), getRequisitionById);

export default router;
