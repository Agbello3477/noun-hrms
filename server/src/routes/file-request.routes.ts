import { Router } from 'express';
import { createRequest, approveRequest, getRequests } from '../controllers/file-request.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Create Request (VC, Registrar, Dean, etc) - Open to Unit Heads+
router.post('/request',
    verifyToken,
    requireRole([Role.UNIT_HEAD, Role.STUDY_CENTER_MANAGER, Role.HR_ADMIN, Role.SUPER_USER, Role.BURSARY, Role.AUDIT]),
    createRequest
);

// Approve (HR Only)
router.post('/approve',
    verifyToken,
    requireRole([Role.HR_ADMIN, Role.SUPER_USER]),
    approveRequest
);

// Get my requests (or HR incoming)
router.get('/', verifyToken, getRequests);

export default router;
