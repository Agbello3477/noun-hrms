import { Router } from 'express';
import { getPublications, createPublication, deletePublication, checkSabbatical, getTeachingWorkload, allocateCourse } from '../controllers/academic.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(verifyToken);

// Publications
router.get('/publications', getPublications);
router.post('/publications', createPublication);
router.delete('/publications/:id', deletePublication);

// Sabbatical
router.get('/sabbatical/eligibility', checkSabbatical);

// Teaching Workload
router.get('/workload', getTeachingWorkload);
router.post('/workload', allocateCourse);

export default router;
