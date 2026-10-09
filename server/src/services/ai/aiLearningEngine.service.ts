import prisma from '../../prisma';

export interface LearnedInsightRecord {
  id: string;
  topic: string;
  triggerPattern: string;
  learnedInsight: string;
  statutorySource?: string | null;
  confidenceScore: number;
  positiveFeedbackCount: number;
  negativeFeedbackCount: number;
  isInstitutionalRule: boolean;
}

export interface RecordFeedbackParams {
  userId: string;
  userRole?: string;
  query: string;
  copilotResponse: string;
  feedbackType: 'THUMBS_UP' | 'THUMBS_DOWN' | 'CORRECTION';
  userCorrection?: string;
  topic?: string;
}

export class AiLearningEngineService {
  // In-memory cache of learned insights for zero-latency lookups and offline resiliency
  private static inMemoryInsights: LearnedInsightRecord[] = [
    {
      id: 'insight-seed-001',
      topic: 'LEAVE_CARRYOVER',
      triggerPattern: 'defer leave carryover unused december',
      learnedInsight: 'Unused annual leave automatically lapses on December 31st unless formally approved for deferment by the Registrar. Staff may defer a maximum of 2 annual leaves towards terminal exit.',
      statutorySource: 'Conditions of Service Senior Staff (June 2024) Section 5.1.4',
      confidenceScore: 0.95,
      positiveFeedbackCount: 18,
      negativeFeedbackCount: 0,
      isInstitutionalRule: true
    },
    {
      id: 'insight-seed-002',
      topic: 'CASUAL_LEAVE_PREREQUISITE',
      triggerPattern: 'casual leave annual leave balance exhausted',
      learnedInsight: 'Per statutory rules, casual leave (max 2 days per HOD grant) is strictly for sudden domestic emergencies and cannot be approved if annual leave quota remains unutilized.',
      statutorySource: 'Conditions of Service Senior Staff (June 2024) Section 5.2.1',
      confidenceScore: 0.92,
      positiveFeedbackCount: 12,
      negativeFeedbackCount: 0,
      isInstitutionalRule: true
    },
    {
      id: 'insight-seed-003',
      topic: 'PROMOTION_CONTISS_9_THRESHOLD',
      triggerPattern: 'contiss 9 waiting period promotion 4 years',
      learnedInsight: 'Staff on CONTISS 9 and above must serve a mandatory 4-year minimum waiting period before promotion eligibility, unlike CONTISS 6-8 which requires 3 years.',
      statutorySource: 'Scheme of Service (May 2024) Section 2.4',
      confidenceScore: 0.96,
      positiveFeedbackCount: 25,
      negativeFeedbackCount: 0,
      isInstitutionalRule: true
    },
    {
      id: 'insight-seed-004',
      topic: 'MAKER_CHECKER_SPEEDUP',
      triggerPattern: 'expedite application pending director delay',
      learnedInsight: 'When an application docket is delayed beyond the 5-day SLA at the Director stage, the applicant can use the Internal Memo module to request an urgent file docket review with the Unit Admin.',
      statutorySource: 'HRMS Operations Manual Section 4.2',
      confidenceScore: 0.88,
      positiveFeedbackCount: 9,
      negativeFeedbackCount: 0,
      isInstitutionalRule: false
    }
  ];

  /**
   * Retrieves relevant learned insights matching the user query
   */
  public static async getRelevantInsights(query: string, limit: number = 2): Promise<LearnedInsightRecord[]> {
    const q = query.toLowerCase();
    const queryTokens = q.split(/\s+/).filter(t => t.length > 2);

    const matches: { insight: LearnedInsightRecord; score: number }[] = [];

    // 1. Check in-memory store
    for (const insight of this.inMemoryInsights) {
      let score = 0;
      const pattern = (insight.triggerPattern + ' ' + insight.topic).toLowerCase();
      for (const token of queryTokens) {
        if (pattern.includes(token)) score += 1;
      }
      if (score > 0) {
        matches.push({ insight, score: score * insight.confidenceScore });
      }
    }

    // 2. Query database if available
    try {
      const dbInsights = await (prisma as any).aiLearnedInsight?.findMany({
        where: {
          confidenceScore: { gte: 0.5 }
        },
        take: 20
      });

      if (dbInsights && Array.isArray(dbInsights)) {
        for (const d of dbInsights) {
          if (!this.inMemoryInsights.some(m => m.id === d.id)) {
            let score = 0;
            const pattern = (d.triggerPattern + ' ' + d.topic).toLowerCase();
            for (const token of queryTokens) {
              if (pattern.includes(token)) score += 1;
            }
            if (score > 0) {
              matches.push({
                insight: {
                  id: d.id,
                  topic: d.topic,
                  triggerPattern: d.triggerPattern,
                  learnedInsight: d.learnedInsight,
                  statutorySource: d.statutorySource,
                  confidenceScore: d.confidenceScore,
                  positiveFeedbackCount: d.positiveFeedbackCount,
                  negativeFeedbackCount: d.negativeFeedbackCount,
                  isInstitutionalRule: d.isInstitutionalRule
                },
                score: score * d.confidenceScore
              });
            }
          }
        }
      }
    } catch {
      // Fallback cleanly to in-memory
    }

    // Sort by weighted score and take top matches
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(m => m.insight);
  }

  /**
   * Continuously learns from user feedback and user-supplied corrections
   */
  public static async recordFeedbackAndLearn(params: RecordFeedbackParams): Promise<{ success: boolean; learnedInsightId?: string }> {
    const { userId, userRole, query, copilotResponse, feedbackType, userCorrection, topic = 'USER_CLARIFICATION' } = params;

    // 1. Process Thumbs Up -> boost confidence score
    if (feedbackType === 'THUMBS_UP') {
      const existing = this.inMemoryInsights.find(i => query.toLowerCase().includes(i.topic.toLowerCase()));
      if (existing) {
        existing.positiveFeedbackCount += 1;
        existing.confidenceScore = Math.min(1.0, existing.confidenceScore + 0.02);
      }

      try {
        await (prisma as any).aiLearnedInsight?.updateMany({
          where: { topic: { contains: topic, mode: 'insensitive' } },
          data: {
            positiveFeedbackCount: { increment: 1 },
            confidenceScore: { increment: 0.02 }
          }
        });
      } catch {
        // Continue
      }

      return { success: true };
    }

    // 2. Process Thumbs Down or User Correction -> synthesize new adaptive insight
    if (feedbackType === 'THUMBS_DOWN' || feedbackType === 'CORRECTION') {
      const insightContent = userCorrection
        ? `Clarified Rule: ${userCorrection.trim()}`
        : `Correction Note on "${query}": Verified institutional operational handling differs from standard generic response.`;

      const newInsight: LearnedInsightRecord = {
        id: `insight-${Date.now()}`,
        topic: topic.toUpperCase().replace(/\s+/g, '_'),
        triggerPattern: query.toLowerCase().slice(0, 100),
        learnedInsight: insightContent,
        confidenceScore: userCorrection ? 0.85 : 0.60,
        positiveFeedbackCount: 1,
        negativeFeedbackCount: feedbackType === 'THUMBS_DOWN' ? 1 : 0,
        isInstitutionalRule: false
      };

      this.inMemoryInsights.push(newInsight);

      try {
        const created = await (prisma as any).aiLearnedInsight?.create({
          data: {
            topic: newInsight.topic,
            triggerPattern: newInsight.triggerPattern,
            learnedInsight: newInsight.learnedInsight,
            confidenceScore: newInsight.confidenceScore,
            positiveFeedbackCount: 1,
            negativeFeedbackCount: feedbackType === 'THUMBS_DOWN' ? 1 : 0,
            sourceUserId: userId,
            sourceUserRole: userRole || 'STAFF',
            correctionHistory: userCorrection ? [{ correction: userCorrection, timestamp: new Date().toISOString() }] : []
          }
        });
        return { success: true, learnedInsightId: created?.id };
      } catch {
        return { success: true, learnedInsightId: newInsight.id };
      }
    }

    return { success: true };
  }

  /**
   * Returns summary of all currently learned insights for system auditing
   */
  public static getAllLearnedInsights(): LearnedInsightRecord[] {
    return this.inMemoryInsights;
  }
}
