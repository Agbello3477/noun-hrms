
import { Router } from 'express';
import {
    createSession,
    updateSession,
    getSessions,
    getActiveSession,
    getMyForm,
    upsertForm,
    getAllForms,
    reviewForm
} from '../controllers/aper.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(verifyToken);

// --- Public / Staff Routes ---
router.get('/sessions/active', getActiveSession);
router.get('/my-form', getMyForm);
router.post('/form', upsertForm);

// --- HR Admin Routes ---
// Only HR Admin or Super User
router.post('/hr/sessions', requireRole([Role.HR_ADMIN, Role.SUPER_USER]), createSession);
router.put('/hr/sessions/:id', requireRole([Role.HR_ADMIN, Role.SUPER_USER]), updateSession);
router.get('/hr/sessions', requireRole([Role.HR_ADMIN, Role.SUPER_USER]), getSessions);
router.get('/hr/forms', requireRole([Role.HR_ADMIN, Role.SUPER_USER]), getAllForms);
router.put('/hr/review/:formId', requireRole([Role.HR_ADMIN, Role.SUPER_USER, Role.STUDY_CENTER_MANAGER, Role.UNIT_HEAD]), reviewForm);


export default router;
