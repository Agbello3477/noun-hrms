export type WafMode = 'BLOCK' | 'MONITOR';

export type SecuritySeverity = 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ActionTaken = 'BLOCKED' | 'FLAGGED' | 'JAILED';

export interface SecurityAlertEvent {
  systemId?: string;
  timestamp: string; // WAT format: YYYY-MM-DDTHH:mm:ss+01:00
  rule: string;
  severity: SecuritySeverity;
  clientIp: string;
  userAgent?: string;
  method: string;
  uri: string;
  payloadSnippet?: string; // Truncated to 256 chars with passwords masked
  actionTaken: ActionTaken;
}

export interface WafViolation {
  rule: string;
  severity: SecuritySeverity;
  description: string;
  matchedPattern?: string;
  field?: string;
  rawSample?: string;
}

export interface WafInspectionResult {
  isBlocked: boolean;
  violations: WafViolation[];
  latencyMs: number;
}

// Security Rule Codes
export const WAF_RULES = {
  // SQL Injection
  SQLI_UNION_SELECT: 'RULE_SQLI_UNION_SELECT',
  SQLI_BOOLEAN_INJECTION: 'RULE_SQLI_BOOLEAN_INJECTION',
  SQLI_STACKED_WAITFOR: 'RULE_SQLI_STACKED_WAITFOR',
  SQLI_TIME_BASED: 'RULE_SQLI_TIME_BASED',
  SQLI_COMMENT_TAMPERING: 'RULE_SQLI_COMMENT_TAMPERING',
  SQLI_VERSION_PROBE: 'RULE_SQLI_VERSION_PROBE',
  SQLI_STACKED_COMMAND: 'RULE_SQLI_STACKED_COMMAND',

  // Cross-Site Scripting
  XSS_SCRIPT_TAG: 'RULE_XSS_SCRIPT_TAG',
  XSS_EVENT_HANDLER: 'RULE_XSS_EVENT_HANDLER',
  XSS_PSEUDO_PROTOCOL: 'RULE_XSS_PSEUDO_PROTOCOL',
  XSS_EVAL_EXECUTION: 'RULE_XSS_EVAL_EXECUTION',

  // Path Traversal & LFI
  PATH_TRAVERSAL_DOTDOT: 'RULE_PATH_TRAVERSAL_DOTDOT',
  LFI_SYSTEM_FILE: 'RULE_LFI_SYSTEM_FILE',

  // NoSQL & Prototype Pollution
  PROTOTYPE_POLLUTION: 'RULE_PROTOTYPE_POLLUTION',
  NOSQL_OPERATOR_INJECTION: 'RULE_NOSQL_OPERATOR_INJECTION',

  // Command Injection
  CMD_SUBSTITUTION: 'RULE_CMD_SUBSTITUTION',
  CMD_BACKTICKS: 'RULE_CMD_BACKTICKS',
  CMD_CHAINING: 'RULE_CMD_CHAINING',
  CMD_PIPE_EXEC: 'RULE_CMD_PIPE_EXEC',

  // Protocol & Scanner
  SCANNER_DETECTED: 'RULE_SCANNER_DETECTED',
  INVALID_HOST_HEADER: 'RULE_INVALID_HOST_HEADER',
  PAYLOAD_TOO_LARGE: 'RULE_PAYLOAD_TOO_LARGE',

  // Rate Limiting & Jail
  GLOBAL_RATE_LIMIT_EXCEEDED: 'RULE_GLOBAL_RATE_LIMIT_EXCEEDED',
  SENSITIVE_RATE_LIMIT_EXCEEDED: 'RULE_SENSITIVE_RATE_LIMIT_EXCEEDED',
  AUTH_BRUTE_FORCE_EXCEEDED: 'RULE_BRUTE_FORCE_EXCEEDED',
  IP_JAILED: 'RULE_IP_JAILED',
} as const;
