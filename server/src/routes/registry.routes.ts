
import { Router } from 'express';
import multer from 'multer';
import { uploadDocument, getStaffDossier, deleteDocument, updateDocument } from '../controllers/document.controller';
import { transferStaff, batchTransfer, getTransferHistory, getCenters } from '../controllers/transfer.controller';
import { createStaffFile, addExistingFile, getJobFiles, getStaffFile } from '../controllers/hr.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.use(verifyToken);

// Document Management
router.post('/upload',
    requireRole([Role.HR_ADMIN, Role.STUDY_CENTER_MANAGER, Role.SUPER_USER, Role.ADMIN]),
    upload.single('file'),
    uploadDocument
);

router.get('/dossier/:staffId', getStaffDossier);
router.delete('/documents/:id', requireRole([Role.HR_ADMIN, Role.SUPER_USER]), deleteDocument);
router.put('/documents/:id', requireRole([Role.HR_ADMIN, Role.SUPER_USER]), updateDocument);

// Staff Transfer (Registry/HR Only)
const transferRoles = [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN];

router.get('/centers', requireRole([...transferRoles, Role.STUDY_CENTER_MANAGER]), getCenters);
router.post('/transfer', requireRole(transferRoles), transferStaff);
router.post('/transfer/batch', requireRole(transferRoles), upload.single('file'), batchTransfer);
router.get('/transfers', requireRole(transferRoles), getTransferHistory);

// Phase 12: Staff File Management (HR Accounts)
const fileRoles = [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN];

router.post('/files/create', requireRole(fileRoles), createStaffFile);
router.post('/files/existing', requireRole(fileRoles), addExistingFile);
router.get('/files/:id', requireRole(fileRoles), getStaffFile);
router.get('/files', requireRole(fileRoles), getJobFiles);

export default router;
