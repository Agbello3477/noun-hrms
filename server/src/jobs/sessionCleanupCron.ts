import cron from 'node-cron';
import prisma from '../prisma';

export const runSessionCleanupJob = async (): Promise<void> => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const deleted = await prisma.auditLog.deleteMany({
            where: {
                createdAt: {
                    lt: thirtyDaysAgo
                }
            }
        });

        console.log(`[CLEANUP_CRON] Purged ${deleted.count} stale audit log records older than 30 days.`);
    } catch (err: any) {
        console.error(`[CLEANUP_CRON] Cleanup failed: ${err.message}`);
    }
};

export const scheduleSessionCleanupCron = () => {
    // Run every day at midnight WAT -> "0 0 * * *"
    cron.schedule('0 0 * * *', async () => {
        console.log('[CLEANUP_CRON] Triggered — cleaning up stale audit logs...');
        await runSessionCleanupJob();
    }, {
        timezone: 'Africa/Lagos'   // WAT — West Africa Time (UTC+1)
    });

    console.log('[CLEANUP_CRON] ✅ Daily session and log cleanup cron scheduled (00:00 WAT).');
};
