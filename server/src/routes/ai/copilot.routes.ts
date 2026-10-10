import { Router } from 'express';
import { CopilotController } from '../../controllers/copilotController';
import { verifyJwtAuth } from '../../middleware/auth.middleware';

const router = Router();

/**
 * @route   POST /api/v1/ai/chat
 * @desc    Enterprise NOUN-Sentinel AI conversational reasoning copilot
 * @access  Private (JWT Authenticated)
 */
router.post('/chat', verifyJwtAuth, CopilotController.chat);

export default router;
