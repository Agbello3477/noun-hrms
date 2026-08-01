/**
 * Leave Resumption Cron Job — NOUN HRMS
 *
 * Schedule: Runs daily at midnight WAT  →  "0 0 * * *"
 *
 * Logic:
 *  1. Scan all staff profiles with status "ON_LEAVE"
 *  2. Check if their most recent APPROVED leave request's endDate is strictly in the past (yesterday or earlier)
 *  3. If so, automatically update their status back to "ACTIVE"
 *  4. Log the auto-resumption and send in-app notification
 */

import cron from 'node-cron';
import prisma from '../prisma';
import { notifyUser } from '../controllers/notification.controller';

export const runLeaveResumptionJob = async (): Promise<{
    processed: number;
    errors: string[];
}> => {
    const errors: string[] = [];
    let processed = 0;
    const now = new Date();
    // Normalize time to start of today to compare date portion only
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    console.log(`[LEAVE_RESUMPTION_CRON] Job started at ${now.toISOString()}`);

    try {
        // Find all staff who are ON_LEAVE
        const staffOnLeave = await prisma.staffProfile.findMany({
            where: {
                isDeleted: false,
                status: 'ON_LEAVE'
            },
            include: {
                user: { select: { id: true, name: true } }
            }
        });

        console.log(`[LEAVE_RESUMPTION_CRON] Scanning ${staffOnLeave.length} staff currently marked ON_LEAVE...`);

        for (const staff of staffOnLeave) {
            try {
                // Find active APPROVED leave request that has ended
                const endedLeave = await prisma.leaveRequest.findFirst({
                    where: {
                        staffId: staff.id,
                        status: 'APPROVED',
                        endDate: { lt: startOfToday } // Ended before today
                    },
                    orderBy: { endDate: 'desc' }
                });

                if (endedLeave) {
                    // Update staff status to ACTIVE
                    await prisma.staffProfile.update({
                        where: { id: staff.id },
                        data: { status: 'ACTIVE' }
                    });

                    // Send in-app notification
                    const notificationTitle = 'Automated Leave Resumption';
                    const notificationMessage = `Your leave period ended on ${endedLeave.endDate.toLocaleDateString('en-GB')}. Your status has been automatically restored to ACTIVE.`;
                    await notifyUser(staff.userId, notificationTitle, notificationMessage, 'INFO', '/dashboard/leaves');

                    console.log(`[LEAVE_RESUMPTION_CRON] Auto-resumed staff: ${staff.user.name} (ID: ${staff.staffId})`);
                    processed++;
                }
            } catch (err: any) {
                console.error(`[LEAVE_RESUMPTION_CRON] Error processing staff ID ${staff.id}:`, err);
                errors.push(err.message || String(err));
            }
        }
    } catch (err: any) {
        console.error('[LEAVE_RESUMPTION_CRON] Master execution error:', err);
        errors.push(err.message || String(err));
    }

    console.log(`[LEAVE_RESUMPTION_CRON] Finished. Auto-resumed ${processed} staff members.`);
    return { processed, errors };
};

export const scheduleLeaveResumptionCron = () => {
    // Run every day at midnight WAT -> "0 0 * * *"
    cron.schedule('0 0 * * *', async () => {
        console.log('[LEAVE_RESUMPTION_CRON] Triggered — checking ended leaves...');
        await runLeaveResumptionJob();
    }, {
        timezone: 'Africa/Lagos'   // WAT — West Africa Time (UTC+1)
    });

    console.log('[LEAVE_RESUMPTION_CRON] ✅ Daily leave resumption checking cron scheduled (00:00 WAT).');
};
