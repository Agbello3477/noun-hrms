import { Router } from 'express';
import { issueQuery, respondToQuery, getQueries, resolveQuery } from '../controllers/query.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';
import { upload } from '../middleware/upload.middleware';

const router = Router();

// Issue Query (HR Only)
router.post('/issue',
    verifyToken,
    requireRole([Role.HR_ADMIN, Role.SUPER_USER]),
    issueQuery
);

// Respond (Staff) - with optional attachment
router.post('/respond',
    verifyToken,
    upload.single('file'),
    respondToQuery
);

// Get Queries
router.get('/', verifyToken, getQueries);

// Resolve Query
router.put('/:id/resolve',
    verifyToken,
    requireRole([Role.HR_ADMIN, Role.SUPER_USER]),
    resolveQuery
);

export default router;
