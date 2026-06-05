import { Router } from 'express';
import { createMemo, getMemos, getMemoById, respondToMemo } from '../controllers/memo.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import multer from 'multer';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.use(verifyToken);

// Create general memo (restricted to admin/HR roles, with optional attachment)
router.post('/', requireRole(['SUPER_USER', 'HR_ADMIN', 'ADMIN']), upload.single('file'), createMemo);

// Get list of memos (accessible to all authenticated users)
router.get('/', getMemos);

// Get specific memo details (accessible to all authenticated users)
router.get('/:id', getMemoById);

// Submit response/feedback to a memo (accessible to all authenticated users)
router.post('/:id/respond', respondToMemo);

export default router;
