import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/requireRole';
import {
  getRegistrarPendingQueue,
  registrarAuthorizeRequisition,
  getRequisitionById,
} from '../../controllers/fileRequisition.controller';

const router = Router();

// Apply Authentication guard to all routes
router.use(verifyToken);

// Strictly guarded to Registrar executive roles and system admins
const registrarGuard = requireRole([
  'REGISTRAR',
  'DEPUTY_REGISTRAR',
  'SUPER_USER',
  'ADMIN',
  'VICE_CHANCELLOR',
] as any);

// Real-time live pending queue for executive release authorization
router.get('/pending', registrarGuard, getRegistrarPendingQueue);
router.post('/:id/authorize', registrarGuard, registrarAuthorizeRequisition);
router.get('/:id', registrarGuard, getRequisitionById);

export default router;
