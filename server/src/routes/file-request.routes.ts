import { Router } from 'express';
import { createRequest, approveRequest, getRequests, approveRequestRoute, rejectRequestRoute, returnRequest } from '../controllers/file-request.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Create Request (VC, Registrar, Dean, etc) - Open to Unit Heads+
router.post('/request',
    verifyToken,
    requireRole([Role.UNIT_HEAD, Role.STUDY_CENTER_MANAGER, Role.HR_ADMIN, Role.SUPER_USER, Role.BURSARY, Role.AUDIT]),
    createRequest
);

router.post('/',
    verifyToken,
    requireRole([Role.UNIT_HEAD, Role.STUDY_CENTER_MANAGER, Role.HR_ADMIN, Role.SUPER_USER, Role.BURSARY, Role.AUDIT]),
    createRequest
);

// Approve (Legacy POST, keeping for backward compatibility)
router.post('/approve',
    verifyToken,
    requireRole([Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN]),
    approveRequest
);

// Approve (PUT REST Endpoint)
router.put('/:id/approve',
    verifyToken,
    requireRole([Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN]),
    approveRequestRoute
);

// Reject (PUT REST Endpoint)
router.put('/:id/reject',
    verifyToken,
    requireRole([Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN]),
    rejectRequestRoute
);

// Return (PUT REST Endpoint)
router.put('/:id/return',
    verifyToken,
    returnRequest
);

// Get my requests (or HR incoming)
router.get('/', verifyToken, getRequests);

export default router;
