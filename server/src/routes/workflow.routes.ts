
import { Router } from 'express';
import { moveDocument, getDocumentTrail } from '../controllers/workflow.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(verifyToken);

// Move Document (Admin, Registry, Bursary, Unit Admins)
const moveRoles = [
    Role.HR_ADMIN,
    Role.SUPER_USER,
    Role.UNIT_ADMIN,
    Role.UNIT_HEAD,
    Role.BURSARY,
    Role.STUDY_CENTER_MANAGER,
    Role.ADMIN
];

router.post('/move', requireRole(moveRoles), moveDocument);

// View Trail (Anyone with access to the document, usually restricted by logic in controller)
router.get('/trail/:documentId', getDocumentTrail);

export default router;
