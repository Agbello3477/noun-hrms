/**
 * Retirement Cron Job — NOUN HRMS
 *
 * Schedule: 06:00 WAT on the 1st of every month  →  "0 6 1 * *"
 *
 * Logic:
 *  1. Scan all ACTIVE staff with dateOfBirth or dateOfFirstAppointment set
 *  2. Calculate their retirement date using FGN PSR rules
 *  3. If retirement is ≤ 6 months away AND we haven't alerted this month:
 *     a. Create a RetirementLog record
 *     b. Update retirementAlertSentAt on the StaffProfile
 *     c. Send in-app Notification to all HR_ADMIN users
 *     d. Send batch email alert to HR department
 */

import cron from 'node-cron';
import prisma from '../prisma';
import {
    calculateRetirementDate,
    monthsBetween,
    formatRetirementDate,
    getRetirementReasonLabel
} from '../utils/retirement';
import {
    sendRetirementAlertEmail,
    type RetirementAlertPayload
} from '../services/email.service';
import { Role } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
//  Core retirement scan — callable by cron OR manually from the API
// ─────────────────────────────────────────────────────────────────────────────
export const runRetirementJob = async (triggeredBy: 'CRON' | 'MANUAL' = 'CRON'): Promise<{
    processed: number;
    skipped: number;
    errors: string[];
    log: string[];
}> => {
    const log: string[] = [];
    const errors: string[] = [];
    const now = new Date();
    const ALERT_WINDOW_MONTHS = 6;
    let processed = 0;
    let skipped = 0;

    const startTs = now.toISOString();
    log.push(`[${startTs}] 🚀 Retirement Cron STARTED (trigger=${triggeredBy})`);
    console.log(`[RETIREMENT_CRON] Job started at ${startTs}. Trigger: ${triggeredBy}`);

    try {
        // 1 ─ Fetch all ACTIVE staff who have DOB or appointment date
        const candidates = await prisma.staffProfile.findMany({
            where: {
                isDeleted: false,
                status: 'ACTIVE',
                OR: [
                    { dateOfBirth: { not: null } },
                    { dateOfFirstAppointment: { not: null } }
                ]
            },
            include: {
                user: { select: { id: true, email: true, name: true } },
                unit: { select: { name: true } },
                studyCenter: { select: { name: true } }
            }
        });

        log.push(`[RETIREMENT_CRON] Found ${candidates.length} candidates with retirement data.`);

        // 2 ─ Collect alerts for this run
        const alertPayloads: RetirementAlertPayload[] = [];

        for (const profile of candidates) {
            try {
                if (!profile.dateOfBirth && !profile.dateOfFirstAppointment) {
                    skipped++;
                    continue;
                }

                // Calculate retirement date (need at least DOB)
                if (!profile.dateOfBirth) {
                    skipped++;
                    log.push(`[SKIP] ${profile.staffId || profile.id} — no date of birth`);
                    continue;
                }

                const result = calculateRetirementDate(
                    profile.dateOfBirth,
                    profile.dateOfFirstAppointment,
                    profile.cadre
                );

                const months = monthsBetween(now, result.retirementDate);

                // Only alert if within 6 months AND retirement hasn't passed
                if (months < 0 || months > ALERT_WINDOW_MONTHS) {
                    skipped++;
                    continue;
                }

                // Idempotency: skip if we've already alerted this month
                if (profile.retirementAlertSentAt) {
                    const lastAlertMonth = profile.retirementAlertSentAt.getMonth();
                    const lastAlertYear = profile.retirementAlertSentAt.getFullYear();
                    if (lastAlertMonth === now.getMonth() && lastAlertYear === now.getFullYear()) {
                        skipped++;
                        log.push(`[SKIP] ${profile.staffId} — already alerted this month`);
                        continue;
                    }
                }

                const staffName = `${profile.surname || ''} ${profile.otherNames || ''}`.trim()
                    || profile.user?.name
                    || 'Unknown Staff';
                const staffId = profile.staffId || 'N/A';
                const department = profile.unit?.name
                    || profile.studyCenter?.name
                    || (profile.department as string | undefined)
                    || 'Not Assigned';
                const retirementMonthYear = formatRetirementDate(result.retirementDate);
                const reason = getRetirementReasonLabel(result.reason);

                // 3a ─ Create RetirementLog
                await prisma.retirementLog.create({
                    data: {
                        staffProfileId: profile.id,
                        retirementDate: result.retirementDate,
                        reason: result.reason,
                        monthsAway: months,
                        alertSentAt: now,
                        snapshotName: staffName,
                        snapshotStaffId: staffId,
                        snapshotUnit: department
                    }
                });

                // 3b ─ Update retirementAlertSentAt
                await prisma.staffProfile.update({
                    where: { id: profile.id },
                    data: { retirementAlertSentAt: now }
                });

                // 3c ─ In-app notification to HR Admins
                const hrAdmins = await prisma.user.findMany({
                    where: { role: Role.HR_ADMIN, isActive: true },
                    select: { id: true }
                });

                for (const admin of hrAdmins) {
                    await prisma.notification.create({
                        data: {
                            userId: admin.id,
                            title: '⚠️ Staff Retirement Alert',
                            message: `${staffName} (${staffId}) is due to retire in ${months} month${months !== 1 ? 's' : ''} — ${retirementMonthYear}. Reason: ${reason}. Department: ${department}.`,
                            type: 'WARNING',
                            link: '/dashboard/hr/archive'
                        }
                    });
                }

                // Collect for batch email
                alertPayloads.push({ staffName, staffId, retirementMonthYear, department, reason, monthsAway: months });

                processed++;
                log.push(`[OK] ${staffName} (${staffId}) — retires ${retirementMonthYear} (${months}mo), reason: ${reason}`);
                console.log(`[RETIREMENT_CRON] ✅ Alerted: ${staffName} <${profile.user?.email}>`);

            } catch (innerErr: any) {
                const msg = `[ERROR] Failed for profile ${profile.id}: ${innerErr.message}`;
                errors.push(msg);
                log.push(msg);
                console.error(`[RETIREMENT_CRON] ❌ ${msg}`);
            }
        }

        // 4 ─ Send batch email to all HR Admins
        if (alertPayloads.length > 0) {
            try {
                const hrAdminEmails = await prisma.user.findMany({
                    where: { role: Role.HR_ADMIN, isActive: true },
                    select: { email: true }
                });

                for (const admin of hrAdminEmails) {
                    await sendRetirementAlertEmail(admin.email, alertPayloads);
                }
                log.push(`[EMAIL] Retirement alert batch email sent to ${hrAdminEmails.length} HR Admin(s)`);
            } catch (emailErr: any) {
                const msg = `[EMAIL_ERROR] Failed to send batch email: ${emailErr.message}`;
                errors.push(msg);
                log.push(msg);
                console.error(`[RETIREMENT_CRON] ❌ ${msg}`);
            }
        } else {
            log.push('[INFO] No alerts generated — no emails sent.');
        }

    } catch (outerErr: any) {
        const msg = `[FATAL] Retirement job crashed: ${outerErr.message}`;
        errors.push(msg);
        log.push(msg);
        console.error(`[RETIREMENT_CRON] ❌ ${msg}`);
    }

    const endTs = new Date().toISOString();
    const summary = `[${endTs}] ✅ Job COMPLETE — processed=${processed}, skipped=${skipped}, errors=${errors.length}`;
    log.push(summary);
    console.log(`[RETIREMENT_CRON] ${summary}`);

    return { processed, skipped, errors, log };
};

// ─────────────────────────────────────────────────────────────────────────────
//  Schedule: 06:00 WAT on the 1st of every month
// ─────────────────────────────────────────────────────────────────────────────
export const scheduleRetirementCron = () => {
    cron.schedule('0 6 1 * *', async () => {
        console.log('[RETIREMENT_CRON] 🕖 1st-of-month trigger — running retirement scan...');
        await runRetirementJob('CRON');
    }, {
        timezone: 'Africa/Lagos'   // WAT — West Africa Time (UTC+1)
    });

    console.log('[RETIREMENT_CRON] ✅ Monthly retirement scan cron scheduled (1st 06:00 WAT).');
};
