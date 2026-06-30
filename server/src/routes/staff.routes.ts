
import { Router } from 'express';
import { getAllStaff, createStaff, getStaffById, getUnitStaff, getAcademicStaff, getTransferredStaff } from '../controllers/staff.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Protect all staff routes
router.use(verifyToken);

// Phase 3 Permissions:
// View All Staff: HR, Super User, Center Manager, Unit Head, Admin
const viewRoles = [
    Role.HR_ADMIN,
    Role.SUPER_USER,
    Role.STUDY_CENTER_MANAGER,
    Role.UNIT_HEAD,
    Role.UNIT_ADMIN,
    Role.ADMIN,
    Role.VICE_CHANCELLOR
];

// Create Staff: HR Admin, Super User, Admin, Unit Head, Center Manager, Unit Admin
const manageRoles = [
    Role.HR_ADMIN,
    Role.SUPER_USER,
    Role.ADMIN,
    Role.UNIT_HEAD,
    Role.STUDY_CENTER_MANAGER,
    Role.UNIT_ADMIN
];

// Unit Heads and Unit Admins viewing their own staff
const unitRoles = [
    Role.UNIT_HEAD,
    Role.UNIT_ADMIN,
    Role.STUDY_CENTER_MANAGER,
    Role.ADMIN // Admin can debug
];

router.get('/', requireRole(viewRoles), getAllStaff);
router.get('/academic', requireRole(viewRoles), getAcademicStaff);
router.get('/unit', requireRole(unitRoles), getUnitStaff);
router.get('/transferred', requireRole([Role.UNIT_HEAD, Role.UNIT_ADMIN, Role.STUDY_CENTER_MANAGER, Role.ADMIN]), getTransferredStaff);

// Individual staff can view their own profile, usually handled by checking ID vs requested ID in controller or separate /me endpoint.
// But for generic getById:
router.get('/:id', requireRole([...viewRoles, Role.STAFF]), getStaffById);

router.post('/', requireRole(manageRoles), createStaff);

import { upload } from '../middleware/upload.middleware';
import { updateStaff, uploadSignature } from '../controllers/staff.controller';

// Update Profile (Self or Admin)
// Use upload.single('passport')
router.put('/:id', upload.single('passport'), updateStaff);

// Upload VC Signature
router.post('/signature', upload.single('file'), uploadSignature);

export default router;
