import { AsyncLocalStorage } from 'async_hooks';

export interface LogEntry {
    timestamp: string;
    level: string;
    traceId?: string;
    message: string;
    metadata?: any;
}

// 1. Tracing context propagation using AsyncLocalStorage
export const traceLocalStorage = new AsyncLocalStorage<{ traceId: string }>();

// 2. Structured JSON Logger
export class CorrelatedLogger {
    private formatLog(level: string, message: string, metadata?: any): LogEntry {
        const store = traceLocalStorage.getStore();
        return {
            timestamp: new Date().toISOString(),
            level,
            traceId: store?.traceId,
            message,
            metadata
        };
    }

    info(message: string, metadata?: any) {
        console.log(JSON.stringify(this.formatLog('INFO', message, metadata)));
    }

    warn(message: string, metadata?: any) {
        console.warn(JSON.stringify(this.formatLog('WARN', message, metadata)));
    }

    error(message: string, metadata?: any) {
        console.error(JSON.stringify(this.formatLog('ERROR', message, metadata)));
    }

    debug(message: string, metadata?: any) {
        if (process.env.NODE_ENV !== 'production') {
            console.log(JSON.stringify(this.formatLog('DEBUG', message, metadata)));
        }
    }
}

export const logger = new CorrelatedLogger();

// 3. SLO Metrics Tracker (In-memory rolling metrics store)
class SloMetricsTracker {
    // Availability SLO: >= 99.9% (Non-5xx responses)
    // Latency SLO: >= 95.0% (Response time < 500ms)
    private maxHistory = 10000;
    private requestHistory: { statusCode: number; latencyMs: number; timestamp: number }[] = [];

    recordRequest(statusCode: number, latencyMs: number) {
        this.requestHistory.push({
            statusCode,
            latencyMs,
            timestamp: Date.now()
        });

        // Maintain rolling window size limit
        if (this.requestHistory.length > this.maxHistory) {
            this.requestHistory.shift();
        }
    }

    getSloStatus() {
        const total = this.requestHistory.length;
        if (total === 0) {
            return {
                totalRequests: 0,
                availabilitySli: 100, // default healthy
                latencySli: 100,
                availabilityStatus: 'HEALTHY (No Traffic)',
                latencyStatus: 'HEALTHY (No Traffic)',
                errorBudgetAvailability: 100,
                errorBudgetLatency: 100
            };
        }

        const successful = this.requestHistory.filter(r => r.statusCode < 500).length;
        const fast = this.requestHistory.filter(r => r.latencyMs < 500).length;

        const availabilitySli = (successful / total) * 100;
        const latencySli = (fast / total) * 100;

        const availabilityTarget = 99.9;
        const latencyTarget = 95.0;

        const availabilityStatus = availabilitySli >= availabilityTarget ? 'HEALTHY' : 'BREACHED';
        const latencyStatus = latencySli >= latencyTarget ? 'HEALTHY' : 'BREACHED';

        // Error budget: (actual SLI - target) / (100 - target) * 100
        const errorBudgetAvailability = Math.max(0, ((availabilitySli - availabilityTarget) / (100 - availabilityTarget)) * 100);
        const errorBudgetLatency = Math.max(0, ((latencySli - latencyTarget) / (100 - latencyTarget)) * 100);

        return {
            totalRequests: total,
            availabilitySli: Number(availabilitySli.toFixed(3)),
            latencySli: Number(latencySli.toFixed(3)),
            availabilityTarget,
            latencyTarget,
            availabilityStatus,
            latencyStatus,
            errorBudgetAvailability: Number(errorBudgetAvailability.toFixed(2)),
            errorBudgetLatency: Number(errorBudgetLatency.toFixed(2)),
            historyCount: this.requestHistory.length
        };
    }
}

export const sloTracker = new SloMetricsTracker();
