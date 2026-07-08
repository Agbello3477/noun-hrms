import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(REDIS_URL);
const QUEUE_KEY = 'queue:default';

async function processJob(job: { id: string; type: string; payload: any }) {
    console.log(`\n[Worker] 🚀 Starting job: ${job.type} (ID: ${job.id})`);
    const startTime = Date.now();

    try {
        switch (job.type) {
            case 'BULK_PAYROLL':
                console.log(`[Worker] 📊 Calculating allowances, deductions, and tax profiles for ${job.payload.staffCount || 0} employees...`);
                // Simulate heavy mathematical computations & database write operations
                await new Promise(resolve => setTimeout(resolve, 4000));
                break;
                
            case 'PAYSILP_PDF_GENERATION':
                console.log(`[Worker] 📄 Rendering payslip PDF layout for user: ${job.payload.userId}`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                break;

            case 'BULK_EMAIL_BROADCAST':
                console.log(`[Worker] ✉️ Broadcasting HR memo notifications to ${job.payload.recipientCount || 0} university workers...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
                break;

            default:
                console.warn(`[Worker] ⚠️ Unknown job type encountered: ${job.type}`);
        }

        const duration = Date.now() - startTime;
        console.log(`[Worker] ✅ Successfully completed job: ${job.type} in ${duration}ms`);
    } catch (error) {
        console.error(`[Worker] ❌ Failed job execution: ${job.type} (ID: ${job.id})`, error);
    }
}

async function startWorker() {
    console.log(`\n======================================================`);
    console.log(`[Worker Daemon] Booting background worker...`);
    console.log(`[Worker Daemon] Connected to Redis at: ${REDIS_URL}`);
    console.log(`[Worker Daemon] Listening for jobs on: ${QUEUE_KEY}`);
    console.log(`======================================================\n`);

    redis.on('error', (err) => {
        console.error('[Worker Daemon] Redis connection error:', err);
    });

    while (true) {
        try {
            // Block pop is ideal: blocks connection until a job becomes available, consuming 0% CPU idle time
            const result = await redis.brpop(QUEUE_KEY, 0);
            if (result && result.length === 2) {
                const jobData = JSON.parse(result[1]);
                await processJob(jobData);
            }
        } catch (error) {
            console.error('[Worker Daemon] Error during job retrieval loop:', error);
            // Backoff delay before retry to prevent infinite looping crash
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

startWorker();
export default startWorker;
