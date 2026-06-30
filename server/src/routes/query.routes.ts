import { Router } from 'express';
import { issueQuery, respondToQuery, getQueries, resolveQuery } from '../controllers/query.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';
import { upload } from '../middleware/upload.middleware';
import { validate, queryIssueSchema, queryRespondSchema } from '../middleware/validation';

const router = Router();

// Issue Query (HR & Unit Managers)
router.post('/issue',
    verifyToken,
    requireRole([Role.HR_ADMIN, Role.SUPER_USER, Role.STUDY_CENTER_MANAGER, Role.UNIT_HEAD, Role.UNIT_ADMIN]),
    validate(queryIssueSchema),
    issueQuery
);

// Respond (Staff) - with optional attachment
router.post('/respond',
    verifyToken,
    upload.single('file'),
    validate(queryRespondSchema),
    respondToQuery
);

// Get Queries
router.get('/', verifyToken, getQueries);

// Resolve Query
router.put('/:id/resolve',
    verifyToken,
    requireRole([Role.HR_ADMIN, Role.SUPER_USER, Role.STUDY_CENTER_MANAGER, Role.UNIT_HEAD, Role.UNIT_ADMIN]),
    resolveQuery
);

export default router;
