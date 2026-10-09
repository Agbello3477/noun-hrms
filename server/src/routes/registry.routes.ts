import { Router } from 'express';
import multer from 'multer';
import { uploadDocument, getStaffDossier, deleteDocument, updateDocument, batchUploadDocuments } from '../controllers/document.controller';
import {
    transferStaff,
    batchTransfer,
    getTransferHistory,
    getCenters,
    getPendingTransfers,
    authorizeTransfer,
    rejectTransfer,
    downloadPostingOrderLetter
} from '../controllers/transfer.controller';
import {
    createStaffFile,
    addExistingFile,
    getJobFiles,
    getStaffFile,
    deleteStaffFile,
    getArchivedFiles,
    restoreStaffFile,
    getPendingClearanceFiles,
    clearStaffFile,
    rejectStaffFile
} from '../controllers/hr.controller';
import {
    getDisciplinaryLeaveAuditReport,
    getStaffMovementAuditReport
} from '../controllers/registryReport.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(verifyToken);

const dossierUploadRoles = [
    Role.HR_ADMIN,
    Role.REGISTRY_ADMIN,
    Role.REGISTRAR,
    Role.STUDY_CENTER_MANAGER,
    Role.SUPER_USER,
    Role.ADMIN,
    Role.VICE_CHANCELLOR
];

// Document Management
router.post('/upload',
    requireRole(dossierUploadRoles),
    upload.single('file'),
    uploadDocument
);

router.post('/batch-upload',
    requireRole(dossierUploadRoles),
    upload.array('files', 100),
    batchUploadDocuments
);

router.get('/dossier/:staffId', getStaffDossier);
router.delete('/documents/:id', requireRole([Role.HR_ADMIN, Role.REGISTRAR, Role.SUPER_USER]), deleteDocument);
router.put('/documents/:id', requireRole([Role.HR_ADMIN, Role.REGISTRAR, Role.SUPER_USER]), updateDocument);

// Staff Transfer (Maker-Checker Workflow)
const transferImputerRoles = [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.REGISTRAR, Role.REGISTRY_ADMIN];
const registrarAuthorizerRoles = [Role.REGISTRAR, Role.SUPER_USER, Role.VICE_CHANCELLOR];
const transferViewerRoles = [
    ...transferImputerRoles,
    Role.REGISTRAR,
    Role.VICE_CHANCELLOR,
    Role.UNIT_HEAD,
    Role.STUDY_CENTER_MANAGER,
    Role.UNIT_ADMIN,
    Role.BURSARY,
    Role.STAFF
];

router.get('/centers', requireRole([...transferImputerRoles, Role.STUDY_CENTER_MANAGER]), getCenters);
router.post('/transfer', requireRole(transferImputerRoles), transferStaff);
router.post('/transfers', requireRole(transferImputerRoles), transferStaff);
router.post('/transfer/batch', requireRole(transferImputerRoles), upload.single('file'), batchTransfer);
router.get('/transfers', requireRole(transferViewerRoles), getTransferHistory);
router.get('/transfers/pending-authorization', requireRole([...transferImputerRoles, Role.REGISTRAR]), getPendingTransfers);
router.get('/transfers/pending', requireRole([...transferImputerRoles, Role.REGISTRAR]), getPendingTransfers);
router.post('/transfers/:id/authorize', requireRole(registrarAuthorizerRoles), authorizeTransfer);
router.post('/transfers/:id/reject', requireRole(registrarAuthorizerRoles), rejectTransfer);
router.get('/transfers/:id/letter', requireRole(transferViewerRoles), downloadPostingOrderLetter);

// Staff File Management & Maker-Checker Clearance Gate
const fileRoles = [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.REGISTRAR];

router.post('/files/create', requireRole(fileRoles), upload.single('passport'), createStaffFile);
router.post('/files/existing', requireRole(fileRoles), upload.single('passport'), addExistingFile);
router.get('/files/pending-clearance', requireRole(fileRoles), getPendingClearanceFiles);
router.post('/files/:id/clear', requireRole(registrarAuthorizerRoles), clearStaffFile);
router.post('/files/:id/reject', requireRole(registrarAuthorizerRoles), rejectStaffFile);
router.get('/files/archive', requireRole([Role.HR_ADMIN, Role.REGISTRY_ADMIN, Role.REGISTRAR, Role.SUPER_USER, Role.ADMIN]), getArchivedFiles);
router.post('/files/archive/:id/restore', requireRole([Role.HR_ADMIN, Role.REGISTRY_ADMIN, Role.REGISTRAR, Role.SUPER_USER, Role.ADMIN]), restoreStaffFile);
router.get('/files/:id', requireRole(fileRoles), getStaffFile);
router.get('/files', requireRole(fileRoles), getJobFiles);
router.delete('/files/:id', requireRole(fileRoles), deleteStaffFile);

// Registry Audit Reports (PDF & CSV & JSON)
const reportRoles = [Role.HR_ADMIN, Role.REGISTRAR, Role.SUPER_USER, Role.VICE_CHANCELLOR, Role.AUDIT];
router.get('/reports/disciplinary-leave-audit', requireRole(reportRoles), getDisciplinaryLeaveAuditReport);
router.get('/reports/staff-movement-audit', requireRole(reportRoles), getStaffMovementAuditReport);

// Promotion & Annual Maturity Subsystem
import promotionRoutes from './promotion.routes';
router.use('/promotions', promotionRoutes);

export default router;
