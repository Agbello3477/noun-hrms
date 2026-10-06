import { Router } from 'express';
import {
  getFaculties,
  getDepartments,
  getAcademicProgrammes,
  getAcademicCourses,
  createOrUpdateCourse,
  allocateWorkload,
  revokeWorkloadAllocation,
  getStaffWorkloadDossier,
  getDepartmentalWorkloadMatrix,
  submitDepartmentalDocket,
  authorizeDepartmentalDocket,
  ratifyDepartmentalDocket,
  exportWorkloadAuditReport,
} from '../../controllers/academicWorkload.controller';
import { verifyToken, requireRole } from '../../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Public / Read access to academic structure with authentication
router.get('/faculties', verifyToken, getFaculties);
router.get('/departments', verifyToken, getDepartments);
router.get('/programmes', verifyToken, getAcademicProgrammes);
router.get('/courses', verifyToken, getAcademicCourses);

// Workload Dossier for staff
router.get('/workload/staff/:staffProfileId', verifyToken, getStaffWorkloadDossier);

// Departmental Matrix for HOD & Dean
router.get('/workload/department/:departmentId', verifyToken, getDepartmentalWorkloadMatrix);

// Export NUC Accreditation & Compliance Audit Report
router.get('/workload/export-audit', verifyToken, exportWorkloadAuditReport);

// Course Management (Admin, Dean, HOD, VC)
router.post(
  '/courses',
  verifyToken,
  requireRole([Role.SUPER_USER, Role.ADMIN, Role.HR_ADMIN, Role.UNIT_HEAD, Role.REGISTRAR, Role.VICE_CHANCELLOR]),
  createOrUpdateCourse
);

// Course Allocation (HOD, Dean, Admin)
router.post(
  '/workload/allocate',
  verifyToken,
  requireRole([Role.SUPER_USER, Role.ADMIN, Role.HR_ADMIN, Role.UNIT_HEAD, Role.UNIT_ADMIN, Role.REGISTRAR, Role.VICE_CHANCELLOR]),
  allocateWorkload
);

// Revoke Allocation
router.delete(
  '/workload/allocation/:id',
  verifyToken,
  requireRole([Role.SUPER_USER, Role.ADMIN, Role.HR_ADMIN, Role.UNIT_HEAD, Role.REGISTRAR, Role.VICE_CHANCELLOR]),
  revokeWorkloadAllocation
);

// Maker-Checker Docket Workflow
// 1. HOD Submits
router.put(
  '/workload/dockets/:departmentId/submit',
  verifyToken,
  requireRole([Role.SUPER_USER, Role.ADMIN, Role.HR_ADMIN, Role.UNIT_HEAD, Role.UNIT_ADMIN, Role.REGISTRAR]),
  submitDepartmentalDocket
);

// 2. Dean Approves
router.put(
  '/workload/dockets/:departmentId/dean-approval',
  verifyToken,
  requireRole([Role.SUPER_USER, Role.ADMIN, Role.HR_ADMIN, Role.UNIT_HEAD, Role.REGISTRAR, Role.VICE_CHANCELLOR]),
  authorizeDepartmentalDocket
);

// 3. Academic Planning / VC Ratifies
router.put(
  '/workload/dockets/:departmentId/ratify',
  verifyToken,
  requireRole([Role.SUPER_USER, Role.ADMIN, Role.HR_ADMIN, Role.REGISTRAR, Role.VICE_CHANCELLOR]),
  ratifyDepartmentalDocket
);

export default router;
