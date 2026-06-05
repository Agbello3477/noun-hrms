import { Router } from 'express';
import { getAuditLogs } from '../controllers/system.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(verifyToken);
router.get('/logs', requireRole([Role.SUPER_USER, Role.ADMIN]), getAuditLogs);

export default router;
