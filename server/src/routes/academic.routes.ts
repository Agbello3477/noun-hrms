import { Router } from 'express';
import {
    getPublications,
    createPublication,
    updatePublication,
    deletePublication,
    vetPublication,
    getAcademicEvaluation,
    getAcademicDossier,
    checkSabbatical,
    getTeachingWorkload,
    allocateCourse,
    getCourses
} from '../controllers/academic.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(verifyToken);

const vettingCommitteeRoles = [
    Role.HR_ADMIN,
    Role.REGISTRAR,
    Role.SUPER_USER,
    Role.ADMIN,
    Role.VICE_CHANCELLOR,
    Role.UNIT_HEAD
];

// Publications Management
router.get('/publications', getPublications);
router.post('/publications', upload.single('file'), createPublication);
router.put('/publications/:id', upload.single('file'), updatePublication);
router.delete('/publications/:id', deletePublication);

// Committee Vetting & Scoring
router.post('/publications/:id/vet', requireRole(vettingCommitteeRoles), vetPublication);

// Criteria Evaluation & Appraisal Dossier
router.get('/evaluation/:staffId', getAcademicEvaluation);
router.get('/dossier/:staffId', getAcademicDossier);

// Sabbatical
router.get('/sabbatical/eligibility', checkSabbatical);

// Courses
router.get('/courses', getCourses);

// Teaching Workload
router.get('/workload', getTeachingWorkload);
router.post('/workload', allocateCourse);

export default router;
