import { SecurityAlertEvent, SecuritySeverity, ActionTaken } from './types';
import { SentinelSDK } from '../../sentinel-sdk';

/**
 * Format timestamp in West Africa Time (WAT: UTC+1).
 * Example: 2026-10-02T16:25:50+01:00
 */
export function formatWatTimestamp(date: Date = new Date()): string {
  // WAT is UTC + 1 hour (3600000 ms)
  const watTime = new Date(date.getTime() + 60 * 60 * 1000);
  const iso = watTime.toISOString(); // e.g. 2026-10-02T16:25:50.123Z
  const datePart = iso.slice(0, 19); // 2026-10-02T16:25:50
  return `${datePart}+01:00`;
}

/**
 * Mask sensitive credentials and truncate snippet to max 256 characters.
 */
export function maskPayloadSnippet(data: any): string {
  if (!data) return '';
  let str = '';

  try {
    if (typeof data === 'string') {
      str = data;
    } else {
      // Clone and mask keys
      const masked = maskSensitiveKeys(JSON.parse(JSON.stringify(data)));
      str = JSON.stringify(masked);
    }
  } catch {
    str = String(data);
  }

  // Generic string replacement for common credential patterns
  str = str.replace(/(["']?(?:password|token|secret|pin|cvv|authorization|jwt)["']?\s*[:=]\s*["']?)([^"',\s\}]+)(["']?)/gi, '$1***MASKED***$3');

  // Truncate to strictly 256 characters
  if (str.length > 256) {
    str = str.substring(0, 253) + '...';
  }

  return str;
}

function maskSensitiveKeys(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(maskSensitiveKeys);

  const SENSITIVE_REGEX = /(?:password|passwd|secret|token|pin|cvv|credit_card|authorization|jwt)/i;
  const result: any = {};

  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_REGEX.test(key)) {
      result[key] = '***MASKED***';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = maskSensitiveKeys(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

// In-Memory event buffer for test inspection & Sentinel telemetry fallback
export const recentSecurityAlerts: SecurityAlertEvent[] = [];

/**
 * Asynchronously emit security alert to SentinelOps telemetry link.
 * Non-blocking: never blocks or slows down request execution.
 */
export function dispatchSecurityAlert(alert: SecurityAlertEvent, sentinelInstance?: SentinelSDK | null): void {
  // Store in local buffer (capped at 500 items)
  recentSecurityAlerts.push(alert);
  if (recentSecurityAlerts.length > 500) {
    recentSecurityAlerts.shift();
  }

  // Non-blocking asynchronous dispatch
  setImmediate(() => {
    try {
      if (sentinelInstance && typeof (sentinelInstance as any).recordSecurityAlert === 'function') {
        (sentinelInstance as any).recordSecurityAlert(alert);
      } else {
        // Output to structured security log
        console.warn(`🛡️ [SentinelOps] [${alert.severity}] ${alert.rule} from ${alert.clientIp} on ${alert.method} ${alert.uri} - Action: ${alert.actionTaken}`);
      }
    } catch (err) {
      // Telemetry must never crash or bubble up
    }
  });
}
