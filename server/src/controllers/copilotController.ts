import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import prisma from '../prisma';
import { SENTINEL_AI_TOOLS } from '../services/ai/tools';
import { ToolExecutors, ActionCardData } from '../services/ai/toolExecutors';
import { SecurityGuardService } from '../services/ai/securityGuard.service';
import { KnowledgeIngestionService } from '../services/ai/knowledgeIngestion.service';
import { AiPersonalityService } from '../services/ai/aiPersonality.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: any;
    assignedUnitId?: string | null;
    stationLocation?: string | null;
    department?: string | null;
    name?: string | null;
    rank?: string | null;
    cadre?: string | null;
    level?: string | null;
  };
}

export class CopilotController {
  private static aiClient: GoogleGenAI | null = null;

  private static getAiClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey && !this.aiClient) {
      this.aiClient = new GoogleGenAI({ apiKey });
    }
    return this.aiClient;
  }

  /**
   * Main chat endpoint handler: POST /api/v1/ai/chat
   */
  public static async chat(req: AuthenticatedRequest, res: Response) {
    const startTime = Date.now();
    const user = req.user;

    if (!user || !user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Missing verified session token.'
      });
    }

    const prompt = (req.body.prompt || req.body.message || '').trim();
    const conversationHistory = req.body.conversationHistory;
    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Query prompt is required.'
      });
    }

    const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';

    // ─── 1. Security & Guardrail Checks ──────────────────────────────────
    const sanitized = SecurityGuardService.sanitizeAndValidateInput(prompt);

    if (!sanitized.isSafe || sanitized.securityFlags.includes('CRITICAL_SECURITY_PROBE')) {
      const latencyMs = Date.now() - startTime;
      console.log(JSON.stringify({
        event: 'AI_COPILOT_QUERY',
        userId: user.id,
        toolsUsed: [],
        latencyMs,
        status: 'FORBIDDEN_PROBE_BLOCKED'
      }));

      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN_CROSS_TENANT_ACCESS',
        message: 'Forbidden: Access denied. Target records belong to another user, or inquiry involves confidential salary vouchers / disciplinary records outside your session authorization.'
      });
    }

    // Block write/mutation attempts
    const lowerPrompt = prompt.toLowerCase();
    if (
      lowerPrompt.includes('update ') ||
      lowerPrompt.includes('delete ') ||
      lowerPrompt.includes('change my salary') ||
      lowerPrompt.includes('approve my promotion') ||
      lowerPrompt.includes('insert into') ||
      lowerPrompt.includes('grant me role')
    ) {
      return res.status(403).json({
        success: false,
        code: 'MUTATION_DISALLOWED',
        message: 'Forbidden: NOUN-Sentinel AI operates strictly in advisory and inquiry mode. State modifications must be submitted through verified human UI workflows.'
      });
    }

    const toolsUsed: string[] = [];
    let actionCard: ActionCardData | undefined;
    let finalAnswer = '';
    let citations: string[] = [];

    // ─── 2. Fetch Enriched User Context ──────────────────────────────────
    let userContext = {
      id: user.id,
      role: String(user.role),
      stationLocation: user.stationLocation || 'National Headquarters, Abuja',
      department: user.department || 'Registry',
      name: user.name || 'Staff Member',
      rank: user.rank || 'Lecturer I',
      cadre: user.cadre || 'ACADEMIC',
      level: user.level || 'CONUASS 04'
    };

    try {
      const profile: any = await Promise.race([
        prisma.staffProfile.findUnique({
          where: { userId: user.id },
          include: { unit: true, studyCenter: true }
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 150))
      ]).catch(() => null);

      if (profile) {
        userContext = {
          id: user.id,
          role: String(user.role),
          stationLocation: profile.studyCenter?.name || 'National Headquarters, Abuja',
          department: profile.unit?.name || String(profile.department || 'Registry'),
          name: `${profile.surname || ''} ${profile.otherNames || ''}`.trim() || userContext.name,
          rank: profile.rank || userContext.rank,
          cadre: profile.cadre || userContext.cadre,
          level: profile.level || userContext.level
        };
      }
    } catch {
      // Keep defaults
    }

    // ─── 3. Ingress Vector Search & Statutory Retrieval ──────────────────
    const ai = this.getAiClient();
    let retrievedChunks: Array<{ sourceDoc?: string; sectionTitle?: string; citationRef?: string; content: string }> = [];

    // Attempt Vector Embedding Search (text-embedding-004 + <=> cosine distance)
    if (ai) {
      try {
        const embedResponse = await ai.models.embedContent({
          model: 'text-embedding-004',
          contents: prompt
        });

        const embeddingValues = (embedResponse as any).embedding?.values || (embedResponse as any).embeddings?.[0]?.values;
        if (embeddingValues && Array.isArray(embeddingValues)) {
          const vectorString = `[${embeddingValues.join(',')}]`;
          const rawVectorResults: any = await prisma.$queryRawUnsafe(
            `SELECT "id", "sourceDoc", "sectionTitle", "sourceDocument", "citationRef", "content",
                    ("embedding" <=> $1::vector) AS distance
             FROM "hrms_knowledge_chunks"
             WHERE "embedding" IS NOT NULL
             ORDER BY distance ASC
             LIMIT 3;`,
            vectorString
          ).catch(() => null);

          if (rawVectorResults && Array.isArray(rawVectorResults) && rawVectorResults.length > 0) {
            retrievedChunks = rawVectorResults.map((r: any) => ({
              sourceDoc: r.sourceDoc || r.sourceDocument || 'Conditions of Service June 2024',
              sectionTitle: r.sectionTitle || r.citationRef || 'Statutory Regulation',
              citationRef: r.citationRef,
              content: r.content
            }));
          }
        }
      } catch (err: any) {
        // Fallback to keyword ingestion service
      }
    }

    // Fallback if vector table is not populated yet or DB lacks pgvector
    if (retrievedChunks.length === 0) {
      const keywordResults = await KnowledgeIngestionService.queryKnowledgeBase({
        query: prompt,
        limit: 3
      });
      retrievedChunks = keywordResults.map(k => ({
        sourceDoc: k.sourceDocument,
        sectionTitle: `${k.citationRef || ''}: ${k.title || ''}`,
        citationRef: k.citationRef || undefined,
        content: k.content
      }));
    }

    citations = Array.from(new Set(retrievedChunks.map(c => `${c.sourceDoc} (${c.sectionTitle})`)));

    // ─── 4. Construct Grounded System Instruction ───────────────────────
    const systemInstructionText = `You are "NOUN-Sentinel AI", the official intelligent co-pilot and regulatory expert embedded within the National Open University of Nigeria Human Resource Management System (NOUN-HRMS).

USER SESSION CONTEXT (Verified):
- User ID: ${userContext.id}
- Institutional Role: ${userContext.role}
- Station Location: ${userContext.stationLocation}
- Department / Unit: ${userContext.department}
- Verified Name: ${userContext.name}
- Current Rank & Level: ${userContext.rank} (${userContext.level})

BEHAVIORAL INSTRUCTIONS:
1. Grounding: Answer statutory policy inquiries strictly grounded in the official university statutes.
2. Precision First: Avoid generic fluff ("Certainly!", "I'd be happy to help"). Provide the direct bottom-line factual answer in Sentence 1.
3. Citations: Cite specific statutory sections, schedules, and tables (e.g. "Conditions of Service for Senior Staff (June 2024) Section 5.1.1", "Approved Scheme of Service (May 2024) Schedule Two, Table 3").
4. Step-by-Step Reasoning: Reason step-by-step before answering.
5. Zero-Trust Isolation: Never leak cross-tenant records, confidential disciplinary files, or other users' salaries.
6. Tools: Call deterministic tools when the user asks about their personal dossier, leave balance, applications, or manual instructions.

RETRIEVED STATUTORY CONTEXT:
${retrievedChunks.map((c, i) => `[Source ${i + 1}: ${c.sourceDoc} | ${c.sectionTitle}]\n${c.content}`).join('\n\n')}`;

    // ─── 5. Model Execution or Deterministic Reasoner ────────────────────
    const salutation = AiPersonalityService.resolveSalutation(userContext);

    // Check for explicit personal deterministic queries
    const isAppTrackQuery = (
      lowerPrompt.includes('where is my application') ||
      lowerPrompt.includes('track my application') ||
      lowerPrompt.includes('status of my application') ||
      (lowerPrompt.includes('my application') && lowerPrompt.includes('status'))
    );

    const isLeaveQuery = (
      lowerPrompt.includes('my leave balance') ||
      lowerPrompt.includes('how many leave days') ||
      (lowerPrompt.includes('leave') && lowerPrompt.includes('i have'))
    );

    const isPromotionQuery = (
      lowerPrompt.includes('promotion readiness') ||
      lowerPrompt.includes('check my promotion') ||
      lowerPrompt.includes('am i due for promotion') ||
      lowerPrompt.includes('evaluate candidate')
    );

    const isManualQuery = (
      lowerPrompt.includes('maker-checker') ||
      lowerPrompt.includes('maker checker') ||
      lowerPrompt.includes('how to lodge') ||
      lowerPrompt.includes('file requisition')
    );

    let executedToolCall: { name: string; args: any } | null = null;

    if (isAppTrackQuery) {
      executedToolCall = { name: 'getMyApplicationStatus', args: {} };
    } else if (isLeaveQuery) {
      executedToolCall = { name: 'getMyLeaveBalance', args: { year: 2026 } };
    } else if (isPromotionQuery) {
      let targetRank = 'SENIOR_LECTURER';
      if (lowerPrompt.includes('lecturer ii')) targetRank = 'LECTURER_II';
      else if (lowerPrompt.includes('lecturer i')) targetRank = 'LECTURER_I';
      else if (lowerPrompt.includes('reader') || lowerPrompt.includes('associate professor')) targetRank = 'READER';
      else if (lowerPrompt.includes('professor')) targetRank = 'PROFESSOR';
      else if (lowerPrompt.includes('deputy registrar')) targetRank = 'DEPUTY_REGISTRAR';
      else if (lowerPrompt.includes('contiss 11') || lowerPrompt.includes('principal admin')) targetRank = 'PRINCIPAL_ADMIN_OFFICER';
      executedToolCall = { name: 'checkPromotionReadiness', args: { targetRank } };
    } else if (isManualQuery) {
      const mod = lowerPrompt.includes('maker') ? 'Maker-Checker' : 'File Requisition';
      executedToolCall = { name: 'searchSystemManual', args: { module: mod, query: prompt } };
    }

    // Execute Tool if identified
    let toolResult: any = null;
    if (executedToolCall) {
      toolsUsed.push(executedToolCall.name);
      toolResult = await ToolExecutors.executeTool(executedToolCall.name, executedToolCall.args, userContext);
      actionCard = toolResult.actionCard;
    }

    // If Gemini client is active, synthesize via Gemini 2.5 Flash
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            systemInstruction: systemInstructionText,
            temperature: 0.2,
            tools: [{ functionDeclarations: SENTINEL_AI_TOOLS }]
          }
        });

        // Handle tool calls triggered by Gemini
        if (response.functionCalls && response.functionCalls.length > 0) {
          for (const call of response.functionCalls) {
            const toolName = call.name || '';
            if (toolName && !toolsUsed.includes(toolName)) {
              toolsUsed.push(toolName);
              toolResult = await ToolExecutors.executeTool(toolName, call.args || {}, userContext);
              actionCard = toolResult.actionCard;
            }

            // Synthesize explanation with functionResponse
            const followUp = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [
                { role: 'user', parts: [{ text: prompt }] },
                { role: 'model', parts: [{ functionCall: call }] },
                {
                  role: 'user',
                  parts: [{
                    functionResponse: {
                      name: call.name,
                      response: { result: toolResult.message, data: toolResult.data }
                    }
                  }]
                }
              ],
              config: {
                systemInstruction: systemInstructionText,
                temperature: 0.2
              }
            });

            if (followUp.text) {
              finalAnswer = followUp.text;
            }
          }
        } else if (response.text) {
          finalAnswer = response.text;
        }
      } catch (err: any) {
        // Fallback gracefully to deterministic synthesizer
      }
    }

    // Deterministic High-Precision Fallback (guarantees offline/test resilience)
    if (!finalAnswer) {
      if (toolResult) {
        finalAnswer = `${salutation.greeting}\n\n${toolResult.message}`;
      } else if (retrievedChunks.length > 0) {
        const primary = retrievedChunks[0];
        finalAnswer = `${salutation.greeting}\n\nPer **${primary.sourceDoc} (${primary.sectionTitle})**:\n${primary.content}`;
      } else {
        finalAnswer = `${salutation.greeting}\n\nPer the **Conditions of Service (June 2024)** and **Approved Scheme of Service (May 2024)**:\nCould you please specify whether your inquiry concerns appointments, promotion waiting periods, publication points, leave entitlements, or system manual guidance?`;
      }
    }

    const latencyMs = Date.now() - startTime;

    // ─── 6. Emit Telemetry to SentinelOps Link ───────────────────────────
    console.log(JSON.stringify({
      event: 'AI_COPILOT_QUERY',
      userId: user.id,
      toolsUsed,
      latencyMs,
      status: 'SUCCESS'
    }));

    return res.status(200).json({
      success: true,
      message: finalAnswer,
      actionCard,
      citations,
      toolsUsed,
      latencyMs,
      salutation
    });
  }
}
