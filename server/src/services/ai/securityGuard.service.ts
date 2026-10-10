import { Role } from '@prisma/client';
import { SentinelSDK } from '../../sentinel-sdk';

export class SecurityScopeException extends Error {
  public statusCode = 403;
  public code = 'ZERO_TRUST_SCOPE_VIOLATION';

  constructor(message: string = 'Access denied: Target resource belongs to another unit/jurisdiction without institutional clearance.') {
    super(message);
    this.name = 'SecurityScopeException';
  }
}

export interface SanitizedQueryInput {
  sanitizedPrompt: string;
  isSafe: boolean;
  securityFlags: string[];
}

export class SecurityGuardService {
  private static promptInjectionPatterns: RegExp[] = [
    /ignore\s+(all\s+)?(previous|prior)\s+(instructions|directives|prompts)/i,
    /disregard\s+(all\s+)?(previous|prior)\s+instructions/i,
    /system\s*prompt\s*exfiltration/i,
    /reveal\s+(your\s+)?(system|internal|hidden)\s+prompt/i,
    /repeat\s+(all\s+)?(words|text)\s+above/i,
    /dan\s+mode\s+enabled/i,
    /jailbreak/i,
    /union\s+select\s+/i,
    /;\s*drop\s+table\s+/i,
    /--\s*exec\s*(\(|master)/i,
    /'\s+or\s+'1'\s*=\s*'1/i
  ];

  private static sensitiveProbeKeywords: string[] = [
    'salary docket of',
    'salary of',
    'bank account numbers of',
    'bank account of',
    'confidential disciplinary file of',
    'disciplinary file of',
    'unreleased salary voucher',
    'ssdc private report for',
    'extract all passwords',
    'bypass maker checker',
    'another user',
    'other user',
    'another colleague',
    'colleague\'s file',
    'colleague\'s records',
    'colleague records',
    'someone else\'s',
    'another staff member\'s',
    'another staff member',
    'personnel file',
    'salary breakdown for',
    'salary breakdown of',
    'salary for',
    'dossier of',
    'dossier for',
    'records of',
    'records for'
  ];

  /**
   * Sanitizes input prompt and checks for prompt injection or malicious payloads
   */
  public static sanitizeAndValidateInput(prompt: string): SanitizedQueryInput {
    const flags: string[] = [];
    let cleanPrompt = prompt.trim();

    // Check for prompt injection / jailbreak patterns
    for (const pattern of this.promptInjectionPatterns) {
      if (pattern.test(cleanPrompt)) {
        flags.push('PROMPT_INJECTION_ATTEMPT');
        // Neutralize the injection phrase
        cleanPrompt = cleanPrompt.replace(pattern, '[REDACTED_SECURITY_PROBE]');
      }
    }

    // Check for cross-tenant / colleague dossier, salary, or file probing
    if (
      /(personnel file|dossier|salary|payroll|bank account|disciplinary file|record)\s+.*(of|for)\s+/i.test(cleanPrompt) ||
      /show me .* (file|dossier|salary|records) (for|of)/i.test(cleanPrompt)
    ) {
      flags.push('CRITICAL_SECURITY_PROBE');
    }

    // Check for unauthorized sensitive probes
    const lower = cleanPrompt.toLowerCase();
    for (const kw of this.sensitiveProbeKeywords) {
      if (lower.includes(kw)) {
        flags.push('CRITICAL_SECURITY_PROBE');
      }
    }

    return {
      sanitizedPrompt: cleanPrompt,
      isSafe: !flags.includes('PROMPT_INJECTION_ATTEMPT') && !flags.includes('CRITICAL_SECURITY_PROBE'),
      securityFlags: flags
    };
  }

  /**
   * Strict context sanitization to prevent cross-tenant/cross-unit leaks
   */
  public static assertUnitScope(
    targetResource: { unitId?: string | null; centerId?: string | null; staffId?: string | null; userId?: string | null },
    user: { id: string; role: Role | string; assignedUnitId?: string | null; assignedCenterId?: string | null }
  ): void {
    const isGlobalAdmin = [
      Role.SUPER_USER,
      Role.VICE_CHANCELLOR,
      Role.REGISTRAR,
      Role.HR_ADMIN,
      'SUPER_ADMIN'
    ].includes(user.role as any);

    if (isGlobalAdmin) {
      return; // Global admins hold institutional scope
    }

    // Check self-access
    if (targetResource.userId && targetResource.userId === user.id) {
      return; // Permitted self-access
    }

    // Unit-scoped validation
    if (targetResource.unitId && targetResource.unitId !== user.assignedUnitId) {
      throw new SecurityScopeException(
        `Cross-unit access rejected: Target unit ${targetResource.unitId} is outside your assigned unit ${user.assignedUnitId || 'NONE'}.`
      );
    }
  }

  /**
   * Log AI copilot queries and tool invocations to SentinelOps Telemetry
   */
  public static async logCopilotAudit(
    sentinel: SentinelSDK | null,
    eventData: {
      userId: string;
      userRole: string;
      promptSnippet: string;
      toolsInvoked: string[];
      durationMs: number;
      clientIp: string;
      securityFlags?: string[];
      status?: 'SUCCESS' | 'BLOCKED' | 'ERROR';
    }
  ): Promise<void> {
    const isCritical = eventData.securityFlags?.includes('CRITICAL_SECURITY_PROBE') ||
                       eventData.securityFlags?.includes('PROMPT_INJECTION_ATTEMPT');

    const logEntry = {
      event: isCritical ? 'AI_COPILOT_CRITICAL_SECURITY_PROBE' : 'AI_COPILOT_QUERY',
      timestamp: new Date().toISOString(),
      userId: eventData.userId,
      userRole: eventData.userRole,
      promptSnippet: eventData.promptSnippet.slice(0, 300),
      toolsInvoked: eventData.toolsInvoked,
      durationMs: eventData.durationMs,
      clientIp: eventData.clientIp,
      securityFlags: eventData.securityFlags || [],
      status: eventData.status || 'SUCCESS'
    };

    console.log(`[SentinelOps Telemetry] ${JSON.stringify(logEntry)}`);
  }
}
