/**
 * APER Deadline Reminder Cron Job — NOUN HRMS
 *
 * Automated deadline notices:
 *  - 7 Days Prior to Closing: Notice to all staff with unsubmitted forms
 *  - Closing Day (≤ 24 Hours): Urgent final notice
 *  - 2 Hours Prior to Portal Lock: Critical warning notice
 */

import cron from 'node-cron';
import prisma from '../prisma';

export const runAperReminderJob = async (): Promise<void> => {
    const now = new Date();

    try {
        // Find active APER sessions that haven't ended yet
        const activeSessions = await prisma.aperSession.findMany({
            where: {
                isActive: true,
                endDate: { gt: now }
            }
        });

        for (const session of activeSessions) {
            const msRemaining = session.endDate.getTime() - now.getTime();
            const hoursRemaining = msRemaining / (1000 * 60 * 60);
            const daysRemaining = hoursRemaining / 24;

            const formattedEndDate = session.endDate.toLocaleString('en-NG', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Africa/Lagos'
            });

            // 1. Check 7-day reminder (<= 7 days and > 24 hours)
            if (daysRemaining <= 7 && daysRemaining > 1 && !session.reminder7DaysSentAt) {
                await dispatchAperNotifications(
                    session.id,
                    '⚠️ APER Submission Reminder (7 Days Remaining)',
                    `The Annual Performance Evaluation Report (${session.title}) portal closes in 7 days on ${formattedEndDate}. Please finalize and submit your evaluation.`,
                    'WARNING'
                );

                await prisma.aperSession.update({
                    where: { id: session.id },
                    data: { reminder7DaysSentAt: now }
                });
                console.log(`[APER_REMINDER] 7-day reminder dispatched for session: ${session.title}`);
            }

            // 2. Check closing day reminder (<= 24 hours and > 2 hours)
            if (hoursRemaining <= 24 && hoursRemaining > 2 && !session.reminderClosingDaySentAt) {
                await dispatchAperNotifications(
                    session.id,
                    '🚨 URGENT: APER Portal Closing Today!',
                    `The APER portal for "${session.title}" will close in less than 24 hours at ${formattedEndDate}. Unsubmitted evaluations will not be accepted.`,
                    'ERROR'
                );

                await prisma.aperSession.update({
                    where: { id: session.id },
                    data: { reminderClosingDaySentAt: now }
                });
                console.log(`[APER_REMINDER] Closing day reminder dispatched for session: ${session.title}`);
            }

            // 3. Check 2-hour reminder (<= 2 hours and > 0 hours)
            if (hoursRemaining <= 2 && hoursRemaining > 0 && !session.reminder2HoursSentAt) {
                await dispatchAperNotifications(
                    session.id,
                    '⛔ FINAL 2-HOUR WARNING: APER Portal Closing!',
                    `The APER portal for "${session.title}" closes in less than 2 hours (${formattedEndDate}). Submit your form immediately before locking.`,
                    'ERROR'
                );

                await prisma.aperSession.update({
                    where: { id: session.id },
                    data: { reminder2HoursSentAt: now }
                });
                console.log(`[APER_REMINDER] Final 2-hour warning dispatched for session: ${session.title}`);
            }
        }
    } catch (error: any) {
        console.error('[APER_REMINDER] Error in APER reminder job:', error.message);
    }
};

/**
 * Dispatch notifications to all active staff who haven't completed or submitted their APER form
 */
async function dispatchAperNotifications(
    sessionId: string,
    title: string,
    message: string,
    type: string
): Promise<void> {
    // Get all submitted/completed forms for this session
    const submittedForms = await prisma.aperForm.findMany({
        where: {
            sessionId,
            status: { in: ['SUBMITTED', 'REVIEWED', 'COMPLETED'] }
        },
        select: { staffId: true }
    });

    const submittedStaffIds = new Set(submittedForms.map(f => f.staffId));

    // Get all active staff profiles with their user IDs
    const activeStaff = await prisma.staffProfile.findMany({
        where: {
            isDeleted: false,
            status: 'ACTIVE'
        },
        select: { id: true, userId: true }
    });

    // Filter staff who haven't submitted
    const pendingStaff = activeStaff.filter(s => !submittedStaffIds.has(s.id));

    // Batch create in-app notifications
    const notificationsData = pendingStaff.map(staff => ({
        userId: staff.userId,
        title,
        message,
        type,
        link: '/dashboard/staff/aper'
    }));

    if (notificationsData.length > 0) {
        // Chunk inserts to avoid Postgres parameter limits
        const chunkSize = 100;
        for (let i = 0; i < notificationsData.length; i += chunkSize) {
            const chunk = notificationsData.slice(i, i + chunkSize);
            await prisma.notification.createMany({
                data: chunk
            });
        }
    }
}

export const scheduleAperReminderCron = () => {
    // Run every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
        await runAperReminderJob();
    });

    console.log('[APER_REMINDER] ✅ APER deadline reminder cron scheduled (every 15 min).');
};
