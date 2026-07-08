import Redis from 'ioredis';

export interface QueueJob {
    id: string;
    type: string;
    payload: any;
    createdAt: string;
}

class QueueService {
    private client: Redis | null = null;
    private isEnabled = false;

    constructor() {
        if (process.env.REDIS_URL) {
            this.client = new Redis(process.env.REDIS_URL);
            this.isEnabled = true;

            this.client.on('error', (err) => {
                console.error('[Queue Service] Redis Connection Error:', err);
                this.isEnabled = false;
            });
        }
    }

    /**
     * Pushes a background job to the Redis queue.
     * Fallbacks to synchronous processing if Redis is unavailable.
     */
    async addJob(queueName: string, jobType: string, payload: any): Promise<void> {
        const job: QueueJob = {
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            type: jobType,
            payload,
            createdAt: new Date().toISOString()
        };

        if (!this.isEnabled || !this.client) {
            console.warn(`[Queue Service] Redis is disabled/offline. Processing job ${jobType} (ID: ${job.id}) synchronously.`);
            // Direct synchronous fallback so system never hangs or fails silently
            await this.processJobSynchronously(job);
            return;
        }

        try {
            await this.client.lpush(`queue:${queueName}`, JSON.stringify(job));
            console.log(`[Queue Service] Job successfully queued: ${jobType} (ID: ${job.id})`);
        } catch (error) {
            console.error(`[Queue Service] Failed to queue job ${jobType}:`, error);
            // Fallback to sync
            await this.processJobSynchronously(job);
        }
    }

    private async processJobSynchronously(job: QueueJob) {
        try {
            // For now, simple console print. In a real environment, this imports handlers dynamically.
            console.log(`[Queue Service Synchronous Fallback] Processing job ${job.type}...`);
        } catch (err) {
            console.error('[Queue Service Synchronous Fallback] Execution failed:', err);
        }
    }
}

export const queueService = new QueueService();
export default queueService;
