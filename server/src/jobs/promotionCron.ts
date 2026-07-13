import cron from 'node-cron';
import prisma from '../prisma';
import { sendPromotionNotificationEmail } from '../services/email.service';

// ─────────────────────────────────────────────────────────────────────────────
//  Core promotion job — callable by cron OR manually from the API
// ─────────────────────────────────────────────────────────────────────────────
export const runPromotionJob = async (triggeredBy: 'CRON' | 'MANUAL' = 'CRON'): Promise<{
    processed: number;
    skipped: number;
    errors: string[];
    log: string[];
}> => {
    const log: string[] = [];
    const errors: string[] = [];
    const calendarYear = new Date().getFullYear();
    let processed = 0;
    let skipped = 0;

    const startTs = new Date().toISOString();
    log.push(`[${startTs}] 🚀 Promotion Cron Job STARTED (trigger=${triggeredBy}, year=${calendarYear})`);
    console.log(`[PROMOTION_CRON] Job started at ${startTs}. Trigger: ${triggeredBy}`);

    try {
        // 1 ─ Query all staff flagged as due for promotion (not yet logged for this year)
        const dueStaff = await prisma.staffProfile.findMany({
            where: {
                isDueForPromotion: true,
                isDeleted: false,
                status: 'ACTIVE',
            },
            include: {
                user: {
                    select: { id: true, email: true, name: true }
                },
                unit: { select: { name: true } },
                promotionLogs: {
                    where: { calendarYear },
                    select: { id: true }
                }
            }
        });

        log.push(`[PROMOTION_CRON] Found ${dueStaff.length} staff flagged as due for promotion.`);
        console.log(`[PROMOTION_CRON] Processing ${dueStaff.length} staff members...`);

        for (const profile of dueStaff) {
            // Skip if already logged for this calendar year (idempotency guard)
            if (profile.promotionLogs.length > 0) {
                skipped++;
                log.push(`[SKIP] Staff ${profile.staffId} already has a promotion log for ${calendarYear}.`);
                continue;
            }

            try {
                const staffName = `${profile.surname || ''} ${profile.otherNames || ''}`.trim() || profile.user?.name || 'Staff Member';
                const staffEmail = profile.user?.email;
                const staffId   = profile.staffId || 'N/A';
                const unitName  = profile.unit?.name || profile.department || 'Unknown Unit';

                // 2 ─ Create PromotionLog record
                await prisma.promotionLog.create({
                    data: {
                        staffProfileId: profile.id,
                        snapshotRank:   profile.rank || profile.currentRank || null,
                        snapshotLevel:  profile.level ? `${profile.level}${profile.step ? '/' + profile.step : ''}` : null,
                        snapshotUnit:   unitName,
                        status:         'DUE_FOR_PROMOTION',
                        calendarYear,
                        triggeredBy,
                        cronExecutedAt: new Date(),
                    }
                });

                // 3 ─ In-app notification
                if (profile.user?.id) {
                    await prisma.notification.create({
                        data: {
                            userId:  profile.user.id,
                            title:   '⭐ Promotion Eligibility Notice',
                            message: 'You are due for promotion this year. The Registry will communicate the official interview/review date to you in due course.',
                            type:    'SUCCESS',
                            link:    '/dashboard/profile',
                        }
                    });
                }

                // 4 ─ Email alert
                if (staffEmail) {
                    await sendPromotionNotificationEmail(staffEmail, staffName, staffId);
                }

                processed++;
                log.push(`[OK] Processed: ${staffName} (${staffId}) — rank: ${profile.rank || 'N/A'}, unit: ${unitName}`);
                console.log(`[PROMOTION_CRON] ✅ Notified: ${staffName} <${staffEmail}>`);

            } catch (innerErr: any) {
                const msg = `[ERROR] Failed for profile ${profile.id}: ${innerErr.message}`;
                errors.push(msg);
                log.push(msg);
                console.error(`[PROMOTION_CRON] ❌ ${msg}`);
            }
        }

    } catch (outerErr: any) {
        const msg = `[FATAL] Promotion job crashed: ${outerErr.message}`;
        errors.push(msg);
        log.push(msg);
        console.error(`[PROMOTION_CRON] ❌ ${msg}`);
    }

    const endTs = new Date().toISOString();
    const summary = `[${endTs}] ✅ Job COMPLETE — processed=${processed}, skipped=${skipped}, errors=${errors.length}`;
    log.push(summary);
    console.log(`[PROMOTION_CRON] ${summary}`);

    return { processed, skipped, errors, log };
};

// ─────────────────────────────────────────────────────────────────────────────
//  Schedule: 00:00 on January 1st every year  →  "0 0 1 1 *"
// ─────────────────────────────────────────────────────────────────────────────
export const schedulePromotionCron = () => {
    cron.schedule('0 0 1 1 *', async () => {
        console.log('[PROMOTION_CRON] 🕛 January 1st triggered — running annual promotion check...');
        await runPromotionJob('CRON');
    }, {
        timezone: 'Africa/Lagos'   // WAT — West Africa Time (UTC+1)
    });

    console.log('[PROMOTION_CRON] ✅ Annual promotion cron scheduled (Jan 1 00:00 WAT).');
};
