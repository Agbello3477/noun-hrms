import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import {
  handleCopilotChat,
  handleDirectToolCall,
  getSuggestedPrompts,
  initKnowledgeBase,
  searchKnowledge
} from '../controllers/aiCopilot.controller';

const router = Router();

// All AI copilot endpoints require authentication
router.use(verifyToken);

// Chat & Autonomous Assistant
router.post('/chat', handleCopilotChat);

// Direct Deterministic Tool Dispatch
router.post('/tool-call', handleDirectToolCall);

// Role-based Suggested Prompts
router.get('/suggestions', getSuggestedPrompts);

// Knowledge Base & RAG Endpoints
router.post('/ingest/init', initKnowledgeBase);
router.get('/knowledge', searchKnowledge);

export default router;
