import { Request, Response } from 'express';
import { AiCopilotService } from '../services/ai/aiCopilot.service';
import { AiToolsService } from '../services/ai/aiTools.service';
import { KnowledgeIngestionService } from '../services/ai/knowledgeIngestion.service';
import { AiLearningEngineService } from '../services/ai/aiLearningEngine.service';
import prisma from '../prisma';

export const handleCopilotChat = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { message, conversationHistory } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'Message string is required' });
    }

    // Fetch user profile for enriched context (unit, rank, cadre, isPrincipalOfficer)
    const profile = await prisma.staffProfile.findUnique({
      where: { userId: user.id },
      select: { unitId: true, centerId: true, rank: true, cadre: true, level: true, staffId: true, isPrincipalOfficer: true }
    }).catch(() => null);

    const clientIp = (
      (req.headers['cf-connecting-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1'
    );

    const result = await AiCopilotService.processChat({
      user: {
        id: user.id,
        role: user.role,
        assignedUnitId: profile?.unitId,
        name: (user as any).name,
        rank: profile?.rank,
        cadre: profile?.cadre,
        level: profile?.level,
        isPrincipalOfficer: profile?.isPrincipalOfficer
      },
      prompt: message,
      conversationHistory,
      clientIp
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('🔥 AI Copilot Chat Error:', error);
    return res.status(500).json({
      message: 'Failed to process AI copilot query',
      error: error.message
    });
  }
};

export const handleRecordFeedback = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { query, copilotResponse, feedbackType, userCorrection, topic } = req.body;
    if (!query || !feedbackType) {
      return res.status(400).json({ message: 'query and feedbackType (THUMBS_UP, THUMBS_DOWN, CORRECTION) are required' });
    }

    const result = await AiLearningEngineService.recordFeedbackAndLearn({
      userId: user.id,
      userRole: user.role,
      query,
      copilotResponse: copilotResponse || '',
      feedbackType,
      userCorrection,
      topic
    });

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Feedback recorded and incorporated into continuous learning memory',
      result
    });
  } catch (error: any) {
    console.error('🔥 AI Feedback Error:', error);
    return res.status(500).json({ message: 'Failed to record feedback', error: error.message });
  }
};

export const handleGetLearnedInsights = async (req: Request, res: Response) => {
  try {
    const insights = AiLearningEngineService.getAllLearnedInsights();
    return res.status(200).json({ insights });
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to retrieve learned insights', error: error.message });
  }
};

export const handleDirectToolCall = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { toolName, params = {} } = req.body;
    if (!toolName) {
      return res.status(400).json({ message: 'toolName is required' });
    }

    const profile = await prisma.staffProfile.findUnique({
      where: { userId: user.id },
      select: { unitId: true }
    }).catch(() => null);

    const callerContext = {
      id: user.id,
      role: user.role,
      assignedUnitId: profile?.unitId
    };

    let toolResult: any;

    switch (toolName) {
      case 'trackMyApplications':
        toolResult = await AiToolsService.trackMyApplications(callerContext);
        break;
      case 'getMyLeaveBalance':
        toolResult = await AiToolsService.getMyLeaveBalance(callerContext, params.year);
        break;
      case 'checkPromotionEligibility':
        toolResult = await AiToolsService.checkPromotionEligibility(callerContext, params.staffId);
        break;
      case 'getDepartmentalWorkloadSummary':
        toolResult = await AiToolsService.getDepartmentalWorkloadSummary(callerContext, params.departmentId || callerContext.assignedUnitId || 'DEFAULT');
        break;
      case 'searchSystemManual':
        toolResult = await AiToolsService.searchSystemManual(params.module || 'System', params.query || '');
        break;
      default:
        return res.status(400).json({ message: `Unknown tool "${toolName}"` });
    }

    return res.status(200).json(toolResult);
  } catch (error: any) {
    console.error('🔥 AI Tool Call Error:', error);
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Tool execution failed',
      code: error.code
    });
  }
};

export const getSuggestedPrompts = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const role = user?.role || 'STAFF';
    const suggestions = AiCopilotService.getRoleBasedSuggestions(role);
    return res.status(200).json({ suggestions });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error retrieving suggestions' });
  }
};

export const initKnowledgeBase = async (req: Request, res: Response) => {
  try {
    const result = await KnowledgeIngestionService.initializeKnowledgeBase();
    return res.status(200).json({
      status: 'SUCCESS',
      message: 'NOUN Statutory Knowledge Base indexed successfully',
      totalIndexed: result.totalIndexed
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to initialize knowledge base', error: error.message });
  }
};

export const searchKnowledge = async (req: Request, res: Response) => {
  try {
    const { query, cadre, section, limit } = req.query;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ message: 'Query parameter is required' });
    }

    const results = await KnowledgeIngestionService.queryKnowledgeBase({
      query,
      cadreFilter: cadre as string,
      sectionFilter: section as string,
      limit: limit ? parseInt(limit as string, 10) : 5
    });

    return res.status(200).json({ results });
  } catch (error: any) {
    return res.status(500).json({ message: 'Knowledge search failed', error: error.message });
  }
};
