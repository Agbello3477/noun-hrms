import { Role, Cadre } from '@prisma/client';
import { KnowledgeIngestionService, RetrievedChunk } from './knowledgeIngestion.service';
import { AiToolsService, ActionCardData } from './aiTools.service';
import { SecurityGuardService, SecurityScopeException } from './securityGuard.service';
import { AiPersonalityService, UserContext, ResolvedSalutation } from './aiPersonality.service';
import { AiLearningEngineService } from './aiLearningEngine.service';
import { SentinelSDK } from '../../sentinel-sdk';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  actionCard?: ActionCardData;
  citations?: string[];
  suggestedFollowUps?: string[];
  learnedInsightApplied?: boolean;
}

export interface CopilotResponse {
  message: string;
  actionCard?: ActionCardData;
  citations?: string[];
  suggestedFollowUps?: string[];
  toolsInvoked?: string[];
  durationMs: number;
  salutation?: ResolvedSalutation;
  learnedInsightApplied?: boolean;
}

export class AiCopilotService {
  /**
   * Main chat completion processor with deterministic tool dispatch, statutory RAG,
   * continuous self-learning memory, and respectful persona intelligence.
   */
  public static async processChat(params: {
    user: {
      id: string;
      role: Role | string;
      assignedUnitId?: string | null;
      name?: string | null;
      rank?: string | null;
      cadre?: Cadre | string | null;
      level?: string | null;
      isPrincipalOfficer?: boolean;
    };
    prompt: string;
    conversationHistory?: ChatMessage[];
    clientIp?: string;
    sentinel?: SentinelSDK | null;
  }): Promise<CopilotResponse> {
    const startTime = Date.now();
    const { user, prompt, clientIp = '127.0.0.1', sentinel = null } = params;

    // 1. Security & Input Sanitization
    const sanitized = SecurityGuardService.sanitizeAndValidateInput(prompt);
    if (!sanitized.isSafe && sanitized.securityFlags.includes('CRITICAL_SECURITY_PROBE')) {
      const durationMs = Date.now() - startTime;
      await SecurityGuardService.logCopilotAudit(sentinel, {
        userId: user.id,
        userRole: String(user.role),
        promptSnippet: prompt,
        toolsInvoked: [],
        durationMs,
        clientIp,
        securityFlags: sanitized.securityFlags,
        status: 'BLOCKED'
      });

      return {
        message: '⚠️ Security Alert: This inquiry touches on confidential personnel records or protected salary dockets outside your authorization scope. This event has been logged to SentinelOps security audit.',
        durationMs,
        toolsInvoked: []
      };
    }

    const cleanPrompt = sanitized.sanitizedPrompt;
    const lower = cleanPrompt.toLowerCase();
    const toolsInvoked: string[] = [];

    // 2. Personality & Salutation Engine
    const salutation = AiPersonalityService.resolveSalutation(user);
    const isDetailed = AiPersonalityService.isDetailedRequest(cleanPrompt);

    // 3. Continuous Self-Learning Engine (Retrieve Adaptive Insights)
    const learnedInsights = await AiLearningEngineService.getRelevantInsights(cleanPrompt, 1);
    const learnedInsightApplied = learnedInsights.length > 0;

    let directAnswer = '';
    let detailsText: string | undefined;
    let outOfTheBoxTip: string | undefined;
    let actionCard: ActionCardData | undefined;
    let citations: string[] | undefined;
    let suggestedFollowUps: string[] = [];
    let currentTopic = 'GENERAL_POLICY';

    try {
      // 4. Intent Routing & Deterministic Function Calling
      const isPolicyQuery = (
        lower.includes('what are the rules') ||
        lower.includes('what is the policy') ||
        lower.includes('what is the statutory') ||
        lower.includes('explain ') ||
        lower.includes('conditions of service') ||
        lower.includes('scheme of service') ||
        lower.includes('guidelines') ||
        lower.includes('statutory retirement') ||
        lower.includes('nursing mothers')
      );

      // Intent A: Track Applications (Personal Dossier)
      if (
        !isPolicyQuery && (
          lower.includes('track') ||
          (lower.includes('application') && (lower.includes('my') || lower.includes('status') || lower.includes('where'))) ||
          lower.includes('docket movement') ||
          lower.includes('pending request')
        )
      ) {
        currentTopic = 'APPLICATION_TRACKING';
        toolsInvoked.push('trackMyApplications');
        const toolRes = await AiToolsService.trackMyApplications(user);
        actionCard = toolRes.actionCard;

        if (toolRes.applicationsCount > 0) {
          directAnswer = `Here is your active application status:\n• ${toolRes.message.split('\n\n')[0] || toolRes.message}`;
          detailsText = toolRes.message;
          outOfTheBoxTip = AiPersonalityService.generateOutOfTheBoxAdvisory('APPLICATION_DELAY', { apps: toolRes.actionCard?.data?.items });
        } else {
          directAnswer = toolRes.message;
          outOfTheBoxTip = `You can submit a new statutory application anytime through the Portal Applications desk.`;
        }

        suggestedFollowUps = [
          'What is my current leave balance?',
          'Check my promotion eligibility',
          'How do institutional applications get approved in NOUN?'
        ];
      }

      // Intent B: Leave Balance & Entitlements (Personal)
      else if (
        !isPolicyQuery && (
          lower.includes('leave balance') ||
          lower.includes('my leave') ||
          lower.includes('my annual leave') ||
          lower.includes('my casual leave') ||
          (lower.includes('how many') && lower.includes('leave') && lower.includes('i have'))
        )
      ) {
        currentTopic = 'LEAVE_MANAGEMENT';
        toolsInvoked.push('getMyLeaveBalance');
        const toolRes = await AiToolsService.getMyLeaveBalance(user);
        actionCard = toolRes.actionCard;

        directAnswer = toolRes.message.split('\n\n')[0] || toolRes.message;
        detailsText = toolRes.message;
        outOfTheBoxTip = AiPersonalityService.generateOutOfTheBoxAdvisory('LEAVE_OPTIMIZATION', null);

        // Augment with statutory citation
        const leaveRag = await KnowledgeIngestionService.queryKnowledgeBase({
          query: 'annual leave entitlement casual maternity paternity',
          sectionFilter: 'LEAVE',
          limit: 1
        });
        if (leaveRag.length > 0) {
          citations = [`${leaveRag[0].sourceDocument} (${leaveRag[0].citationRef || 'Section 5.1.1'})`];
        }

        suggestedFollowUps = [
          'What are the casual leave rules in NOUN?',
          'Explain maternity leave duration and nursing breaks',
          'How do I apply for annual leave on HRMS?'
        ];
      }

      // Intent C: Promotion Eligibility & Maturity (Personal or Candidate)
      else if (
        !isPolicyQuery && (
          lower.includes('am i due') ||
          lower.includes('check my promotion') ||
          lower.includes('my next due year') ||
          lower.includes('my promotion eligibility') ||
          lower.includes('evaluate candidate')
        )
      ) {
        currentTopic = 'PROMOTIONS';
        toolsInvoked.push('checkPromotionEligibility');
        const toolRes = await AiToolsService.checkPromotionEligibility(user);
        actionCard = toolRes.actionCard;

        const isEligible = toolRes.message.includes('ELIGIBLE');
        const scoreMatch = toolRes.message.match(/Points:\s*(\d+)/i);
        const points = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;

        directAnswer = toolRes.message.split('\n\n')[0] || toolRes.message;
        detailsText = toolRes.message;
        outOfTheBoxTip = AiPersonalityService.generateOutOfTheBoxAdvisory('PROMOTION_GAP', {
          isEligible,
          pointsGap: isEligible ? 0 : Math.max(0, 34 - points),
          yearsGap: isEligible ? 0 : 1
        });

        const promoRag = await KnowledgeIngestionService.queryKnowledgeBase({
          query: cleanPrompt,
          sectionFilter: 'PROMOTIONS',
          limit: 1
        });
        if (promoRag.length > 0) {
          citations = promoRag.map(r => `${r.sourceDocument} (${r.citationRef || 'Scheme of Service'})`);
        }

        suggestedFollowUps = [
          'What publication points are needed for Senior Lecturer?',
          'What happens if I have an unresolved disciplinary query?',
          'Show Scheme of Service waiting periods for CONTISS 9+'
        ];
      }

      // Intent D: Departmental Workload Caps & Rebates
      else if (
        lower.includes('workload') ||
        lower.includes('credit unit') ||
        lower.includes('overload') ||
        lower.includes('underload') ||
        lower.includes('teaching allocation')
      ) {
        currentTopic = 'WORKLOAD';
        toolsInvoked.push('getDepartmentalWorkloadSummary');
        const deptId = user.assignedUnitId || 'COMPUTER_SCIENCE';
        const toolRes = await AiToolsService.getDepartmentalWorkloadSummary(user, deptId);
        actionCard = toolRes.actionCard;

        directAnswer = toolRes.message.split('\n\n')[0] || toolRes.message;
        detailsText = toolRes.message;
        outOfTheBoxTip = AiPersonalityService.generateOutOfTheBoxAdvisory('WORKLOAD_REBALANCING', null);

        const workloadRag = await KnowledgeIngestionService.queryKnowledgeBase({
          query: 'teaching workload caps credit unit rebate',
          sectionFilter: 'WORKLOAD',
          limit: 1
        });
        if (workloadRag.length > 0) {
          citations = [`${workloadRag[0].sourceDocument} (${workloadRag[0].citationRef})`];
        }

        suggestedFollowUps = [
          'What is the credit unit cap for Professors?',
          'How much teaching rebate does an HOD receive?',
          'How do I reallocate an overloaded lecturer?'
        ];
      }

      // Intent E: HRMS Manual & System Mechanics
      else if (
        lower.includes('how to') ||
        lower.includes('how do i') ||
        lower.includes('file requisition') ||
        lower.includes('maker-checker') ||
        lower.includes('maker checker') ||
        lower.includes('cascade memo') ||
        lower.includes('manual') ||
        lower.includes('workflow')
      ) {
        currentTopic = 'SYSTEM_MANUAL';
        toolsInvoked.push('searchSystemManual');
        const moduleName = lower.includes('file') ? 'File Requisition'
          : lower.includes('memo') ? 'Internal Memos'
          : lower.includes('leave') ? 'Leave Management'
          : lower.includes('maker') ? 'Maker-Checker Dual Control'
          : 'HRMS Workflow';

        const toolRes = await AiToolsService.searchSystemManual(moduleName, cleanPrompt);
        actionCard = toolRes.actionCard;

        directAnswer = toolRes.message.split('\n\n')[0] || toolRes.message;
        detailsText = toolRes.message;

        suggestedFollowUps = [
          'Explain Maker-Checker dual control authorization',
          'How do I track an application docket?',
          'What are the file requisition custody steps?'
        ];
      }

      // Intent F: Grounded Statutory Policy RAG (Conditions of Service, Discipline, Retirement)
      else {
        currentTopic = 'STATUTORY_POLICY';
        toolsInvoked.push('queryKnowledgeBase');
        const ragResults = await KnowledgeIngestionService.queryKnowledgeBase({
          query: cleanPrompt,
          limit: isDetailed ? 3 : 1
        });

        if (ragResults.length > 0) {
          citations = ragResults.map(r => `${r.sourceDocument} (${r.citationRef || 'Section ' + r.pageNumber})`);

          const primary = ragResults[0];
          directAnswer = `Per **${primary.sourceDocument} (${primary.citationRef})**:\n${primary.content.split('\n\n')[0] || primary.content}`;

          if (ragResults.length > 1 || isDetailed) {
            detailsText = ragResults.map(r => `### ${r.title} (${r.citationRef})\n${r.content}`).join('\n\n---\n\n') + KnowledgeIngestionService.buildGroundedCitationText(ragResults);
          }
        } else {
          directAnswer = `Per the National Open University of Nigeria (NOUN) Statutory Guidelines and Conditions of Service:

Could you please specify your inquiry further? You can ask about:
• **Leave Provisions** (Annual, Casual, Maternity, Paternity, Deferred Leave)
• **Scheme of Service** (Academic & Administrative Progression, Waiting Periods, Publication Points)
• **Disciplinary Procedures** (Mandatory 24-Hour Query Response, 3rd Query Rules, SSDC Gates)
• **Statutory Retirement** (Professorial at 75 years; Non-Professorial / Admin at 65 years or 35 years service)
• **System Operations** (File Requisitions, Maker-Checker Authorizations, Docket Stepper)`;
        }

        suggestedFollowUps = [
          'What is the statutory retirement age for Professors vs Administrative staff?',
          'What is the deadline for responding to a written query?',
          'Explain the 13 statutory leave types in NOUN'
        ];
      }

      // 5. If Continuous Learned Insight exists, append as dynamic institutional intelligence
      if (learnedInsights.length > 0) {
        const li = learnedInsights[0];
        directAnswer += `\n\n🧠 **Learned Institutional Note:**\n${li.learnedInsight}`;
        if (li.statutorySource && !citations?.includes(li.statutorySource)) {
          citations = citations ? [...citations, li.statutorySource] : [li.statutorySource];
        }
      }

      // 6. Format Response with Salutation, Specific Conciseness by Default, and Strategic Tip
      const formattedMessage = AiPersonalityService.formatResponse({
        salutation,
        directAnswer,
        detailsText,
        isDetailed,
        outOfTheBoxTip
      });

      // 7. Update User Persistent Memory asynchronously
      await AiPersonalityService.getOrUpdateUserMemory(user.id, {
        salutation: salutation.salutation,
        lastTopic: currentTopic,
        dossierSnapshot: actionCard?.data ? { [currentTopic]: actionCard.data } : undefined
      });

      const durationMs = Date.now() - startTime;

      // 8. Log to SentinelOps Telemetry
      await SecurityGuardService.logCopilotAudit(sentinel, {
        userId: user.id,
        userRole: String(user.role),
        promptSnippet: prompt,
        toolsInvoked,
        durationMs,
        clientIp,
        securityFlags: sanitized.securityFlags,
        status: 'SUCCESS'
      });

      return {
        message: formattedMessage,
        actionCard,
        citations,
        suggestedFollowUps,
        toolsInvoked,
        durationMs,
        salutation,
        learnedInsightApplied
      };

    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      let errorResponse = '';
      if (err instanceof SecurityScopeException) {
        errorResponse = `⛔ **Scope Enforcement**: ${err.message}`;
      } else {
        errorResponse = `An operational error occurred while evaluating your inquiry: ${err.message}`;
      }

      return {
        message: errorResponse,
        durationMs,
        toolsInvoked
      };
    }
  }

  /**
   * Generates tailored role-based suggestion chips for UI initialization
   */
  public static getRoleBasedSuggestions(role: Role | string): string[] {
    const r = String(role).toUpperCase();

    if (r === 'REGISTRY_ADMIN' || r === 'HR_ADMIN') {
      return [
        'Show candidates due for 2026 promotion review',
        'Draft disciplinary query template',
        'Explain file release authorization steps',
        'What is the 3-query rule for SSDC referral?'
      ];
    }

    if (r === 'HOD' || r === 'DEAN' || r === 'UNIT_HEAD' || r === 'DIRECTOR_ACADEMIC_PLANNING') {
      return [
        "Check my department's teaching workload distribution",
        'Who has pending leave applications in my unit?',
        'What is the credit unit cap for Professors?',
        'How to cascade a confidential unit memo'
      ];
    }

    if (r === 'REGISTRAR' || r === 'VICE_CHANCELLOR' || r === 'SUPER_USER') {
      return [
        'Audit active Maker-Checker authorization queues',
        'Overview of institutional file custody releases',
        'Review retirement log for current academic cycle',
        'Check promotion docket maturity bottlenecks'
      ];
    }

    // Default: STAFF
    return [
      'Track my pending application',
      'Check my leave balance',
      'What is my next promotion due year?',
      'How to lodge a personnel file requisition'
    ];
  }
}
