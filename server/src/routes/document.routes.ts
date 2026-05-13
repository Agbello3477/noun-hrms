import { Router } from 'express';
import { uploadDocument, deleteDocument, getMyDocuments } from '../controllers/document.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Upload document (Staff can upload their own or HR for others - logic in controller)
router.post('/upload', verifyToken, uploadDocument);

// Get my documents
router.get('/my', verifyToken, getMyDocuments);

// Delete document - Strict HR Admin / Super User only
router.delete('/:id',
    verifyToken,
    requireRole([Role.HR_ADMIN, Role.SUPER_USER]),
    deleteDocument
);

export default router;
