import { Router } from 'express';
import { issueQuery, respondToQuery, getQueries, resolveQuery, acknowledgeWarning } from '../controllers/query.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';
import { upload } from '../middleware/upload.middleware';
import { validate, queryIssueSchema, queryRespondSchema } from '../middleware/validation';

const router = Router();

const issuerRoles = [
    Role.HR_ADMIN,
    Role.SUPER_USER,
    Role.STUDY_CENTER_MANAGER,
    Role.UNIT_HEAD,
    Role.UNIT_ADMIN,
    Role.ADMIN,
    Role.REGISTRAR,
    Role.VICE_CHANCELLOR
];

// Issue Query or Warning (HR & Unit Managers)
router.post('/issue',
    verifyToken,
    requireRole(issuerRoles),
    validate(queryIssueSchema),
    issueQuery
);

router.post('/',
    verifyToken,
    requireRole(issuerRoles),
    validate(queryIssueSchema),
    issueQuery
);

// Respond to Query (Staff) - with optional attachment
router.post('/respond',
    verifyToken,
    upload.single('file'),
    validate(queryRespondSchema),
    respondToQuery
);

// Acknowledge Warning (Staff)
router.post('/:id/acknowledge',
    verifyToken,
    acknowledgeWarning
);

router.post('/acknowledge',
    verifyToken,
    acknowledgeWarning
);

// Get Queries
router.get('/', verifyToken, getQueries);

// Resolve Query
router.put('/:id/resolve',
    verifyToken,
    requireRole(issuerRoles),
    resolveQuery
);

export default router;
