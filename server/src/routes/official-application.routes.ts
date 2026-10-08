import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { Role } from '@prisma/client';
import {
    createApplication,
    getMyApplications,
    getIncomingApplications,
    getApplicationById,
    acknowledgeApplication,
    updateApplicationStatus
} from '../controllers/official-application.controller';

const router = Router();

// All routes require authentication
router.use(verifyToken);

const registryRoles = [
    Role.HR_ADMIN,
    Role.SUPER_USER,
    Role.ADMIN,
    Role.VICE_CHANCELLOR
];

// Create official application to HR/Registry (Open to all authenticated staff, unit heads, directors, deans)
router.post('/', upload.single('attachment'), createApplication);

// Get current user's submitted applications
router.get('/my', getMyApplications);

// Get incoming applications docket for Registry / HR review
router.get('/incoming', requireRole(registryRoles), getIncomingApplications);

// Get single application by ID
router.get('/:id', getApplicationById);

// Registry Acknowledge & Apply Electronic Stamp
router.put('/:id/acknowledge', requireRole(registryRoles), acknowledgeApplication);

// Update processing status (IN_REVIEW, APPROVED, REJECTED)
router.put('/:id/status', requireRole(registryRoles), updateApplicationStatus);

export default router;
