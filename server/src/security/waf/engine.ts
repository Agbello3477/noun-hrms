import { WAF_RULES, WafViolation } from './types';

// Pre-compiled regex patterns for sub-millisecond execution
const REGEX_SQLI_UNION = /\bUNION\s+(?:ALL\s+)?SELECT\b/i;
const REGEX_SQLI_BOOLEAN = /(?:\b(?:OR|AND)\b\s+(['"]?[\w\d]+['"]?)\s*=\s*\1|\b(?:OR|AND)\b\s+[\d'"]+\s*=\s*[\d'"]+)/i;
const REGEX_SQLI_WAITFOR = /\bWAITFOR\s+DELAY\b/i;
const REGEX_SQLI_TIME = /\b(?:pg_sleep|sleep|benchmark)\s*\(/i;
const REGEX_SQLI_BLOCK_COMMENT = /\/\*[\s\S]*?\*\//;
const REGEX_SQLI_INLINE_COMMENT = /--(?:\s+.*$|$|\r|\n)/;
const REGEX_SQLI_VERSION = /(?:@@version|\bversion\s*\(\s*\))/i;
const REGEX_SQLI_STACKED = /;\s*(?:DROP|ALTER|CREATE|DELETE|UPDATE|INSERT|SELECT|TRUNCATE|EXEC|EXECUTE)\b/i;

const REGEX_XSS_SCRIPT = /<\s*script\b[^>]*>/i;
const REGEX_XSS_EVENT = /\bon[a-z]{3,15}\s*=/i;
const REGEX_XSS_PSEUDO_PROTOCOL = /(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/i;
const REGEX_XSS_EVAL = /\b(?:eval|Function|execScript)\s*\(/i;

const REGEX_PATH_TRAVERSAL = /(?:\.\.[/\\]|\.\.%2f|\.\.%5c|%2e%2e[/\\%]|%252e%252e)/i;
const REGEX_LFI_FILES = /(?:\/(?:etc\/(?:passwd|shadow|hosts|group|issue|crontab)|proc\/self|var\/log)|boot\.ini|win\.ini|windows\/system32)/i;

const REGEX_CMD_SUBSTITUTION = /\$\([^\)]+\)/;
const REGEX_CMD_BACKTICKS = /`[^`\n]+`/;
const REGEX_CMD_CHAINING = /(?:;|&&|\|\||\|)\s*(?:cat|ls|rm|chmod|chown|wget|curl|nc|netcat|bash|sh|zsh|dash|python|perl|ruby|whoami|id|uname|kill|sudo|reboot|shutdown|cp|mv|mkdir|touch)\b/i;
const REGEX_CMD_PIPE = /\|\s*(?:bash|sh|zsh|dash|curl|wget)\b/i;

const REGEX_SCANNER_UA = /(?:sqlmap|nikto|acunetix|masscan|dirbuster|wpscan|nmap|zgrab|nessus|openvas|metasploit|gobuster|ffuf|hydra|burpcollaborator)/i;

/**
 * Strict recursive HTML entity and URL decoding up to maxDepth.
 * Detects obfuscated payloads such as &lt;script&gt; or %253Cscript%253E.
 */
export function recursiveHtmlDecode(input: string, maxDepth = 5): string {
  if (!input || typeof input !== 'string') return '';
  let current = input;
  let depth = 0;

  while (depth < maxDepth) {
    let changed = false;

    // 1. URL decoding
    try {
      const decodedUrl = decodeURIComponent(current);
      if (decodedUrl !== current) {
        current = decodedUrl;
        changed = true;
      }
    } catch {
      // Ignore URL decode errors for binary/malformed sequences
    }

    // 2. HTML Entity decoding
    const decodedHtml = current
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'")
      .replace(/&amp;/gi, '&')
      .replace(/&#x([0-9a-fA-F]+);?/gi, (_, hex) => {
        try {
          return String.fromCharCode(parseInt(hex, 16));
        } catch {
          return _;
        }
      })
      .replace(/&#([0-9]+);?/gi, (_, dec) => {
        try {
          return String.fromCharCode(parseInt(dec, 10));
        } catch {
          return _;
        }
      });

    if (decodedHtml !== current) {
      current = decodedHtml;
      changed = true;
    }

    if (!changed) break;
    depth++;
  }

  return current;
}

/**
 * Early-exit fast check for suspicious special characters.
 * If string is alphanumeric and common whitespace only, skip heavy regex checks.
 */
function containsSuspiciousChars(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // Suspicious if contains <, >, ', ", ;, |, $, `, \, /, -, *, %, (, ), :, =, [, ], {, }
    if (
      code === 60 || // <
      code === 62 || // >
      code === 39 || // '
      code === 34 || // "
      code === 59 || // ;
      code === 124 || // |
      code === 36 || // $
      code === 96 || // `
      code === 92 || // \
      code === 47 || // /
      code === 45 || // -
      code === 42 || // *
      code === 37 || // %
      code === 40 || // (
      code === 41 || // )
      code === 58 || // :
      code === 61 || // =
      code === 91 || // [
      code === 93 || // ]
      code === 123 || // {
      code === 125    // }
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Inspect a single text field across SQLi, XSS, Path Traversal, and Command Injection.
 */
export function inspectString(value: string, fieldName = 'input'): WafViolation[] {
  if (!value || typeof value !== 'string') return [];
  if (value.length > 50000) {
    // Truncate extreme length string for regex evaluation to avoid ReDoS
    value = value.substring(0, 50000);
  }

  // Early-exit fast path: clean alphanumeric text without special chars
  if (!containsSuspiciousChars(value)) {
    return [];
  }

  const violations: WafViolation[] = [];
  const decoded = recursiveHtmlDecode(value);

  // 1. SQL Injection Engine
  if (REGEX_SQLI_UNION.test(decoded)) {
    violations.push({
      rule: WAF_RULES.SQLI_UNION_SELECT,
      severity: 'CRITICAL',
      description: 'SQL Injection: Union-based select vector detected',
      field: fieldName,
      rawSample: value.substring(0, 100),
    });
  }

  if (REGEX_SQLI_BOOLEAN.test(decoded)) {
    violations.push({
      rule: WAF_RULES.SQLI_BOOLEAN_INJECTION,
      severity: 'CRITICAL',
      description: 'SQL Injection: Boolean stacked condition (OR/AND 1=1) detected',
      field: fieldName,
      rawSample: value.substring(0, 100),
    });
  }

  if (REGEX_SQLI_WAITFOR.test(decoded)) {
    violations.push({
      rule: WAF_RULES.SQLI_STACKED_WAITFOR,
      severity: 'CRITICAL',
      description: 'SQL Injection: WAITFOR DELAY vector detected',
      field: fieldName,
      rawSample: value.substring(0, 100),
    });
  }

  if (REGEX_SQLI_TIME.test(decoded)) {
    violations.push({
      rule: WAF_RULES.SQLI_TIME_BASED,
      severity: 'CRITICAL',
      description: 'SQL Injection: Database time delay function detected',
      field: fieldName,
      rawSample: value.substring(0, 100),
    });
  }

  if (REGEX_SQLI_BLOCK_COMMENT.test(decoded)) {
    violations.push({
      rule: WAF_RULES.SQLI_COMMENT_TAMPERING,
      severity: 'CRITICAL',
      description: 'SQL Injection: Block comment syntax (/*...*/) detected',
      field: fieldName,
      rawSample: value.substring(0, 100),
    });
  }

  if (REGEX_SQLI_STACKED.test(decoded)) {
    violations.push({
      rule: WAF_RULES.SQLI_STACKED_COMMAND,
      severity: 'CRITICAL',
      description: 'SQL Injection: Stacked command execution detected',
      field: fieldName,
      rawSample: value.substring(0, 100),
    });
  }

  if (REGEX_SQLI_VERSION.test(decoded)) {
    violations.push({
      rule: WAF_RULES.SQLI_VERSION_PROBE,
      severity: 'CRITICAL',
      description: 'SQL Injection: Database version probe detected',
      field: fieldName,
      rawSample: value.substring(0, 100),
    });
  }

  // 2. Cross-Site Scripting (XSS) Engine
  if (REGEX_XSS_SCRIPT.test(decoded)) {
    violations.push({
      rule: WAF_RULES.XSS_SCRIPT_TAG,
      severity: 'HIGH',
      description: 'XSS: Injected script tag detected',
      field: fieldName,
      rawSample: value.substring(0, 100),
    });
  }

  if (REGEX_XSS_EVENT.test(decoded)) {
    violations.push({
      rule: WAF_RULES.XSS_EVENT_HANDLER,
      severity: 'HIGH',
      description: 'XSS: Injected inline event handler detected',
      field: fieldName,
      rawSample: value.substring(0, 100),
    });
  }

  if (REGEX_XSS_PSEUDO_PROTOCOL.test(decoded)) {
    violations.push({
      rule: WAF_RULES.XSS_PSEUDO_PROTOCOL,
      severity: 'HIGH',
      description: 'XSS: Dangerous pseudo-protocol (javascript:/data:) detected',
      field: fieldName,
      rawSample: value.substring(0, 100),
    });
  }

  if (REGEX_XSS_EVAL.test(decoded)) {
    violations.push({
      rule: WAF_RULES.XSS_EVAL_EXECUTION,
      severity: 'HIGH',
      description: 'XSS: Dynamic execution primitive (eval/Function) detected',
      field: fieldName,
      rawSample: value.substring(0, 100),
    });
  }

  // 3. Path Traversal & LFI Engine
  if (REGEX_PATH_TRAVERSAL.test(decoded)) {
    violations.push({
      rule: WAF_RULES.PATH_TRAVERSAL_DOTDOT,
      severity: 'HIGH',
      description: 'Path Traversal: Directory traversal sequence (../) detected',
      field: fieldName,
      rawSample: value.substring(0, 100),
    });
  }

  if (REGEX_LFI_FILES.test(decoded)) {
    violations.push({
      rule: WAF_RULES.LFI_SYSTEM_FILE,
      severity: 'HIGH',
      description: 'LFI: Sensitive operating system file target detected',
      field: fieldName,
      rawSample: value.substring(0, 100),
    });
  }

  // 4. Command Injection Engine
  if (REGEX_CMD_SUBSTITUTION.test(decoded)) {
    violations.push({
      rule: WAF_RULES.CMD_SUBSTITUTION,
      severity: 'CRITICAL',
      description: 'Command Injection: Shell command substitution $(...) detected',
      field: fieldName,
      rawSample: value.substring(0, 100),
    });
  }

  if (REGEX_CMD_BACKTICKS.test(decoded)) {
    violations.push({
      rule: WAF_RULES.CMD_BACKTICKS,
      severity: 'CRITICAL',
      description: 'Command Injection: Backtick execution syntax detected',
      field: fieldName,
      rawSample: value.substring(0, 100),
    });
  }

  if (REGEX_CMD_CHAINING.test(decoded)) {
    violations.push({
      rule: WAF_RULES.CMD_CHAINING,
      severity: 'CRITICAL',
      description: 'Command Injection: Shell command chaining detected',
      field: fieldName,
      rawSample: value.substring(0, 100),
    });
  }

  if (REGEX_CMD_PIPE.test(decoded)) {
    violations.push({
      rule: WAF_RULES.CMD_PIPE_EXEC,
      severity: 'CRITICAL',
      description: 'Command Injection: Pipeline redirection to shell binary detected',
      field: fieldName,
      rawSample: value.substring(0, 100),
    });
  }

  return violations;
}

/**
 * Deep recursive inspection of objects and arrays for Prototype Pollution, NoSQL injection, and payload strings.
 */
export function inspectObject(data: any, path = '', depth = 0, maxDepth = 12): WafViolation[] {
  if (!data || depth > maxDepth) return [];
  const violations: WafViolation[] = [];

  if (typeof data === 'string') {
    return inspectString(data, path);
  }

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      violations.push(...inspectObject(data[i], `${path}[${i}]`, depth + 1, maxDepth));
      if (violations.length >= 5) break; // Early exit if multiple violations already detected
    }
    return violations;
  }

  if (typeof data === 'object') {
    // 1. Prototype Pollution & Object Injection Guard
    for (const key of Object.keys(data)) {
      if (key === '__proto__') {
        violations.push({
          rule: WAF_RULES.PROTOTYPE_POLLUTION,
          severity: 'CRITICAL',
          description: 'Prototype Pollution: Injected __proto__ key detected in JSON payload',
          field: `${path}.${key}`,
          rawSample: '__proto__',
        });
      }

      if (key === 'constructor' && data[key] && typeof data[key] === 'object' && 'prototype' in data[key]) {
        violations.push({
          rule: WAF_RULES.PROTOTYPE_POLLUTION,
          severity: 'CRITICAL',
          description: 'Prototype Pollution: Injected constructor.prototype detected',
          field: `${path}.${key}.prototype`,
          rawSample: 'constructor.prototype',
        });
      }

      // 2. NoSQL & MongoDB Operator Injection ($where, $gt, $regex, etc.)
      if (key.startsWith('$')) {
        violations.push({
          rule: WAF_RULES.NOSQL_OPERATOR_INJECTION,
          severity: 'CRITICAL',
          description: `NoSQL Injection: Injected database operator (${key}) detected`,
          field: `${path}.${key}`,
          rawSample: key,
        });
      }

      // Recursive scan on child value
      violations.push(...inspectObject(data[key], path ? `${path}.${key}` : key, depth + 1, maxDepth));
      if (violations.length >= 5) break;
    }
  }

  return violations;
}

/**
 * Verify User-Agent against automated vulnerability scanners.
 */
export function inspectUserAgent(userAgent?: string): WafViolation | null {
  if (!userAgent) return null;
  if (REGEX_SCANNER_UA.test(userAgent)) {
    return {
      rule: WAF_RULES.SCANNER_DETECTED,
      severity: 'CRITICAL',
      description: `Automated exploit scanner detected in User-Agent header: ${userAgent.substring(0, 50)}`,
      field: 'headers.user-agent',
      rawSample: userAgent.substring(0, 100),
    };
  }
  return null;
}

/**
 * Verify Host header to reject raw IP queries in production when domain routing is required.
 */
export function inspectHostHeader(host?: string, allowedDomains: string[] = []): WafViolation | null {
  if (!host) {
    return {
      rule: WAF_RULES.INVALID_HOST_HEADER,
      severity: 'MEDIUM',
      description: 'Missing Host header in HTTP request',
      field: 'headers.host',
    };
  }

  const hostname = host.split(':')[0].trim().toLowerCase();

  // Always allow localhost and loopback in development/test
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === 'test') {
    return null;
  }

  // Reject raw public IPv4 address direct access if allowedDomains are configured
  const isRawIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  if (isRawIp && allowedDomains.length > 0 && !allowedDomains.includes(hostname)) {
    return {
      rule: WAF_RULES.INVALID_HOST_HEADER,
      severity: 'MEDIUM',
      description: `Raw IP Host header (${hostname}) rejected. Direct IP access is prohibited.`,
      field: 'headers.host',
      rawSample: host,
    };
  }

  return null;
}
