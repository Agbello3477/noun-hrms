import { Router } from 'express';
import { generateMeetingToken } from '../controllers/meeting.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/token', verifyToken, generateMeetingToken);

export default router;
