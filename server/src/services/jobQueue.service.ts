import { redisService } from './redis.service';
import { sendEmail, sendAperSessionNotification } from './email.service';
import { logger } from './observability.service';

export interface JobPayload {
    jobType: string;
    payload: any;
}

class JobQueueService {
    private queueKey = 'bg-job-queue';
    private isRunning = false;

    async enqueue(jobType: string, payload: any): Promise<void> {
        const isOnline = redisService.isOnline();
        if (!isOnline) {
            // Fallback: execute immediately if Redis is offline to prevent loss of critical notifications
            logger.warn(`[Queue] Redis offline. Falling back to synchronous execution for job: ${jobType}`);
            this.processJob(jobType, payload).catch(err => {
                logger.error(`[Queue] Synchronous fallback execution failed for job ${jobType}`, { error: err.message });
            });
            return;
        }

        try {
            const jobStr = JSON.stringify({ jobType, payload });
            await redisService.lpush(this.queueKey, jobStr);
            logger.info(`[Queue] Job enqueued successfully: ${jobType}`);
        } catch (error: any) {
            logger.error(`[Queue] Failed to enqueue job: ${jobType}. Falling back to sync execution.`, { error: error.message });
            this.processJob(jobType, payload).catch(err => {
                logger.error(`[Queue] Synchronous fallback execution failed for job ${jobType}`, { error: err.message });
            });
        }
    }

    startWorker(): void {
        const isOnline = redisService.isOnline();
        if (!isOnline) {
            logger.warn('[Queue] Redis is offline. Background worker will not start.');
            return;
        }

        if (this.isRunning) return;
        this.isRunning = true;
        logger.info('[Queue] Background job worker started.');

        const workerLoop = async () => {
            while (this.isRunning) {
                try {
                    // Block for up to 5 seconds waiting for a new job in the list
                    const result = await redisService.brpop(this.queueKey, 5);
                    if (result) {
                        // result structure is [key, value]
                        const [_, jobDataStr] = result;
                        const { jobType, payload } = JSON.parse(jobDataStr);

                        logger.info(`[Queue] Worker picking up job: ${jobType}`);
                        await this.processJob(jobType, payload);
                    }
                } catch (error: any) {
                    logger.error('[Queue] Background worker encountered error in loop', { error: error.message });
                    // Sleep to prevent infinite hot loop crash
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
        };

        workerLoop().catch(err => {
            logger.error('[Queue] Background worker loop crashed fatally', { error: err.message });
            this.isRunning = false;
        });
    }

    stopWorker(): void {
        this.isRunning = false;
        logger.info('[Queue] Background job worker stopped.');
    }

    private async processJob(jobType: string, payload: any): Promise<void> {
        const start = Date.now();
        try {
            switch (jobType) {
                case 'SEND_EMAIL':
                    await sendEmail(payload.to, payload.subject, payload.html);
                    break;
                case 'SEND_APER_EMAIL':
                    await sendAperSessionNotification(
                        payload.email,
                        payload.name,
                        payload.sessionTitle,
                        payload.year,
                        new Date(payload.endDate)
                    );
                    break;
                default:
                    logger.warn(`[Queue] Unknown job type received: ${jobType}`);
            }
            const duration = Date.now() - start;
            logger.info(`[Queue] Job processed successfully: ${jobType} in ${duration}ms`);
        } catch (error: any) {
            logger.error(`[Queue] Job execution failed: ${jobType}`, {
                error: error.message,
                payload
            });
            // Critical warning: in production, we could implement a dead letter queue or retry limit here
        }
    }
}

export const jobQueueService = new JobQueueService();
