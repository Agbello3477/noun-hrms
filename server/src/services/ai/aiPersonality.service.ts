import { Role, Cadre } from '@prisma/client';
import prisma from '../../prisma';

export interface UserContext {
  id: string;
  role: Role | string;
  assignedUnitId?: string | null;
  name?: string | null;
  rank?: string | null;
  cadre?: Cadre | string | null;
  level?: string | null;
  isPrincipalOfficer?: boolean;
}

export interface ResolvedSalutation {
  title: string;
  fullName: string;
  salutation: string;
  greeting: string;
}

export interface FormattedAiResponse {
  formattedText: string;
  isDetailed: boolean;
  proactiveTip?: string;
}

export class AiPersonalityService {
  /**
   * Intelligently resolves the user's institutional honorific, rank title, and respectful greeting
   */
  public static resolveSalutation(user: UserContext): ResolvedSalutation {
    const rawName = (user.name || 'Colleague').trim();
    const nameParts = rawName.split(' ');
    const surname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : rawName;
    const firstName = nameParts[0];

    const roleStr = String(user.role || '').toUpperCase();
    const rankStr = String(user.rank || '').toLowerCase();
    const cadreStr = String(user.cadre || '').toUpperCase();

    let title = 'Colleague';

    // 1. Executive Roles
    if (roleStr === 'VICE_CHANCELLOR') {
      title = 'Vice-Chancellor';
    } else if (roleStr === 'REGISTRAR') {
      title = 'Registrar';
    } else if (roleStr === 'BURSAR') {
      title = 'Bursar';
    } else if (roleStr === 'UNIVERSITY_LIBRARIAN') {
      title = 'University Librarian';
    } else if (roleStr === 'DEAN') {
      title = 'Dean';
    } else if (roleStr === 'HOD') {
      title = 'HOD';
    } else if (roleStr === 'DIRECTOR' || roleStr === 'DIRECTOR_ACADEMIC_PLANNING') {
      title = 'Director';
    }
    // 2. Academic Honorifics from Rank
    else if (rankStr.includes('professor') || rankStr.includes('prof')) {
      title = 'Prof.';
    } else if (rankStr.includes('reader') || rankStr.includes('associate professor')) {
      title = 'Assoc. Prof.';
    } else if (rankStr.includes('doctor') || rankStr.includes('dr.') || rankStr.includes('senior lecturer') || rankStr.includes('lecturer i')) {
      title = 'Dr.';
    } else if (rankStr.includes('engineer') || rankStr.includes('engr')) {
      title = 'Engr.';
    }
    // 3. Administrative Cadres
    else if (cadreStr === 'ADMINISTRATIVE' || cadreStr === 'SENIOR_ADMIN') {
      title = 'Mr./Ms.';
    } else if (cadreStr === 'ACADEMIC') {
      title = 'Dr./Lecturer';
    }

    // Determine respectful combined salutation
    let salutation = '';
    if (title === 'Vice-Chancellor' || title === 'Registrar' || title === 'Bursar' || title === 'University Librarian' || title === 'Dean' || title === 'HOD' || title === 'Director') {
      salutation = `${title} ${surname}`;
    } else if (title === 'Prof.' || title === 'Dr.' || title === 'Engr.' || title === 'Assoc. Prof.') {
      salutation = `${title} ${surname}`;
    } else {
      salutation = `${rawName}`;
    }

    // Contextual time-of-day greeting
    const hour = new Date().getHours();
    let timeGreeting = 'Good day';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 17) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';

    const greeting = `${timeGreeting}, ${salutation}.`;

    return {
      title,
      fullName: rawName,
      salutation,
      greeting
    };
  }

  /**
   * Determines if the user is explicitly requesting a detailed, step-by-step, or expanded explanation
   */
  public static isDetailedRequest(prompt: string): boolean {
    const p = prompt.toLowerCase();
    return (
      p.includes('in detail') ||
      p.includes('in-depth') ||
      p.includes('detailed') ||
      p.includes('step by step') ||
      p.includes('step-by-step') ||
      p.includes('elaborate') ||
      p.includes('explain fully') ||
      p.includes('break down completely') ||
      p.includes('comprehensive breakdown') ||
      p.includes('all steps') ||
      p.includes('full manual')
    );
  }

  /**
   * Formats raw policy or operational answers:
   * - By default: Crisp, laser-specific, high-impact bulleted summary with immediate bottom-line verdict.
   * - If requested: Full expanded comprehensive institutional breakdown.
   * - Injects out-of-the-box smart advisory tips.
   */
  public static formatResponse(params: {
    salutation: ResolvedSalutation;
    directAnswer: string;
    detailsText?: string;
    isDetailed: boolean;
    outOfTheBoxTip?: string;
    actionCardDeepLinkText?: string;
  }): string {
    const { salutation, directAnswer, detailsText, isDetailed, outOfTheBoxTip } = params;

    let response = `${salutation.greeting}\n\n${directAnswer.trim()}`;

    if (isDetailed && detailsText) {
      response += `\n\n---\n### 📖 Comprehensive Institutional Breakdown:\n${detailsText.trim()}`;
    } else if (!isDetailed && detailsText) {
      response += `\n\n> 💡 *Need the full step-by-step statutory details? Simply ask for a "detailed breakdown".*`;
    }

    if (outOfTheBoxTip) {
      response += `\n\n🎯 **Proactive Strategic Recommendation:**\n${outOfTheBoxTip.trim()}`;
    }

    return response;
  }

  /**
   * Generates out-of-the-box strategic advice based on domain context
   */
  public static generateOutOfTheBoxAdvisory(topic: string, context: any): string | undefined {
    switch (topic) {
      case 'PROMOTION_GAP':
        if (context.pointsGap > 0 || context.yearsGap > 0) {
          return `To close your gap before the next Oct review:
• **Publications**: Prioritize submitting to Scopus/WoS-indexed journals (earning up to 5 pts each vs 2 pts for local chapters).
• **Course Materials**: If short on points, volunteer with the Directorate of Learning Resources for course material revision (grants up to 2-3 statutory credit units).
• **Administrative Clearance**: Confirm with Registry that your APER scores for the past 3 consecutive sessions are endorsed (>50%).`;
        }
        return `You meet all statutory maturity criteria! Ensure your HOD tabulates your docket before the annual June appraisal cutoff for SSDC staging.`;

      case 'APPLICATION_DELAY':
        return `If docket movement SLA is critical:
• Direct submission to the Registrar desk can be expedited by attaching an approved internal Memo reference from your Dean/Director.
• Check your portal notifications for any "Vetting Query" or incomplete attachment tags that pause the SLA clock.`;

      case 'LEAVE_OPTIMIZATION':
        return `Strategic Scheduling Tip:
• NOUN statutory leave calculates **working days only** (public holidays and weekends are free).
• Pairing your annual leave with official national holidays (e.g. October 1st or December breaks) maximizes your uninterrupted rest without depleting your allocated quota.`;

      case 'WORKLOAD_REBALANCING':
        return `Workload Optimization Tactics:
• Senior academics exceeding credit unit limits can co-allocate tutorial sessions to Graduate Assistants / Assistant Lecturers under their supervision.
• Administrative course coordination roles qualify for institutional rebates (HOD: 6 CU rebate; Dean: 8 CU rebate).`;

      default:
        return undefined;
    }
  }

  /**
   * Retrieves or updates persistent user memory (last active dossier, preferences, interactions)
   */
  public static async getOrUpdateUserMemory(userId: string, updateData?: {
    salutation?: string;
    lastTopic?: string;
    dossierSnapshot?: any;
  }) {
    try {
      let memory = await (prisma as any).aiUserMemory?.findUnique({
        where: { userId }
      });

      if (!memory) {
        memory = await (prisma as any).aiUserMemory?.create({
          data: {
            userId,
            resolvedSalutation: updateData?.salutation || null,
            lastTopic: updateData?.lastTopic || null,
            dossierContext: updateData?.dossierSnapshot || {},
            interactionCount: 1,
            lastInteractionAt: new Date()
          }
        });
      } else if (updateData) {
        memory = await (prisma as any).aiUserMemory?.update({
          where: { userId },
          data: {
            resolvedSalutation: updateData.salutation || memory.resolvedSalutation,
            lastTopic: updateData.lastTopic || memory.lastTopic,
            dossierContext: updateData.dossierSnapshot ? { ...(memory.dossierContext as any || {}), ...updateData.dossierSnapshot } : memory.dossierContext,
            interactionCount: { increment: 1 },
            lastInteractionAt: new Date()
          }
        });
      }

      return memory;
    } catch {
      return null;
    }
  }
}
