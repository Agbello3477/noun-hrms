import { Request, Response, NextFunction } from 'express';

export interface SentinelConfig {
  endpoint: string;           // SentinelOps ingest URL, e.g. "https://sentinel.yourdomain.com/api/v1/telemetry/ingest"
  apiKey: string;             // API_TELEMETRY_KEY
  systemId: string;           // e.g. "NOUN-HRMS"
  batchSize?: number;         // Max events to buffer before auto-flush (default: 50)
  flushIntervalMs?: number;   // Auto-flush timer interval (default: 5000ms)
  timeoutMs?: number;         // Network timeout to prevent hanging connections (default: 2500ms)
}

interface TelemetryEvent {
  systemId: string;
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  clientIp: string;
  userAgent?: string;
  errorMessage?: string;
  payloadSnippet?: string;
}

export class SentinelSDK {
  private config: Required<SentinelConfig>;
  private buffer: TelemetryEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  constructor(config: SentinelConfig) {
    this.config = {
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      systemId: config.systemId,
      batchSize: config.batchSize ?? 50,
      flushIntervalMs: config.flushIntervalMs ?? 5000,
      timeoutMs: config.timeoutMs ?? 2500,
    };

    // Periodically flush buffered logs
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {});
    }, this.config.flushIntervalMs);

    // Prevent this timer from holding open the Node process during shutdown
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }

  /**
   * Express Middleware handler
   */
  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Exclude static assets or internal health checks if desired
      if (req.path.startsWith('/_next') || req.path.startsWith('/static') || req.path === '/favicon.ico') {
        return next();
      }

      const start = process.hrtime();

      // Extract client IP address (respecting Cloudflare & reverse proxy headers)
      const clientIp = (
        (req.headers['cf-connecting-ip'] as string) ||
        (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
        req.socket.remoteAddress ||
        '0.0.0.0'
      );

      // Listen to response finish event (runs completely after response is sent to user)
      res.on('finish', () => {
        // Calculate high-resolution execution duration
        const diff = process.hrtime(start);
        const durationMs = Number(((diff[0] * 1e3) + (diff[1] * 1e-6)).toFixed(2));

        // Sanitize & capture query/body snippet if status indicates error or attack probe
        let payloadSnippet: string | undefined;
        if (res.statusCode >= 400) {
          try {
            const rawBody = req.body ? JSON.stringify(req.body) : '';
            const rawQuery = req.query ? JSON.stringify(req.query) : '';
            payloadSnippet = `${rawQuery} ${rawBody}`.slice(0, 500); // Truncate to 500 chars
          } catch {
            payloadSnippet = undefined;
          }
        }

        const event: TelemetryEvent = {
          systemId: this.config.systemId,
          timestamp: new Date().toISOString(),
          method: req.method,
          path: req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path,
          statusCode: res.statusCode,
          durationMs,
          clientIp,
          userAgent: req.headers['user-agent'],
          payloadSnippet,
        };

        this.enqueue(event);
      });

      next();
    };
  }

  /**
   * Enqueue telemetry event in memory
   */
  private enqueue(event: TelemetryEvent) {
    this.buffer.push(event);

    // Hard ceiling to prevent memory ballooning if Sentinel server is down for days
    if (this.buffer.length > 2000) {
      this.buffer.splice(0, 500); // Drop oldest 500 items
    }

    if (this.buffer.length >= this.config.batchSize) {
      // Fire-and-forget background flush without awaiting
      setImmediate(() => {
        this.flush().catch(() => {});
      });
    }
  }

  /**
   * Asynchronously dispatch buffered events to SentinelOps ingest API
   */
  public async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) return;

    this.isFlushing = true;
    const batch = this.buffer.splice(0, this.config.batchSize);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentinel-Key': this.config.apiKey,
          'X-System-ID': this.config.systemId,
        },
        body: JSON.stringify({ events: batch }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch {
      // Completely swallow errors so monitoring failures NEVER impact HRMS uptime.
      // Optionally put items back in front of buffer if desired:
      // this.buffer.unshift(...batch);
    } finally {
      this.isFlushing = false;
    }
  }
}
