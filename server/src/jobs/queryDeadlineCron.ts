/**
 * Automated Disciplinary Query Deadline Breach Monitor — NOUN HRMS
 *
 * Runs every 10 minutes to scan for queries where status = 'OPEN' and responseDeadline < now.
 * Automatically marks them as DEFAULTED_UNANSWERED, logs SLA breach, flags staff record,
 * and alerts HR Admins, Registrar, and issuing officers.
 */

import cron from 'node-cron';
import prisma from '../prisma';
import { Role } from '@prisma/client';

export const runQueryDeadlineJob = async (): Promise<void> => {
    const now = new Date();

    try {
        // Find all open queries whose response deadline has expired
        const defaultedQueries = await prisma.staffQuery.findMany({
            where: {
                status: 'OPEN',
                actionType: 'QUERY',
                responseDeadline: { lt: now }
            },
            include: {
                staff: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                        unit: { select: { name: true } }
                    }
                },
                issuedBy: { select: { id: true, name: true, email: true } }
            }
        });

        if (defaultedQueries.length === 0) {
            return;
        }

        console.log(`[QUERY_BREACH_CRON] Found ${defaultedQueries.length} defaulted disciplinary queries.`);

        for (const query of defaultedQueries) {
            try {
                // 1. Update query status to DEFAULTED_UNANSWERED & record breach
                await prisma.staffQuery.update({
                    where: { id: query.id },
                    data: {
                        status: 'DEFAULTED_UNANSWERED',
                        slaBreached: true,
                        slaBreachedAt: now,
                        breachLoggedToFolio: true,
                        resolutionStatus: 'UNSATISFACTORY'
                    }
                });

                const staffProfile = query.staff;
                const staffUser = staffProfile?.user;
                const staffName = staffUser?.name || `${staffProfile?.surname || ''} ${staffProfile?.otherNames || ''}`.trim() || 'Staff';
                const staffId = staffProfile?.staffId || 'N/A';

                // 2. Disciplinary Integrity Block on Staff Profile for promotion / clearance
                if (staffProfile) {
                    await prisma.staffProfile.update({
                        where: { id: staffProfile.id },
                        data: {
                            hasActiveDisciplinaryBlock: true,
                            disciplinaryBlockReason: `Defaulted Query: "${query.title}" (${query.stipulatedHours}h window breached)`,
                            promotionEligibilityStatus: 'DISQUALIFIED_DISCIPLINARY'
                        }
                    });
                }

                // 3. Notify Staff Member
                if (staffUser?.id) {
                    await prisma.notification.create({
                        data: {
                            userId: staffUser.id,
                            title: '🚨 Disciplinary Query Defaulted (Deadline Breached)',
                            message: `You failed to submit a defense for query "${query.title}" within the stipulated ${query.stipulatedHours} hours. This breach has been recorded in your official personnel folio.`,
                            type: 'ERROR',
                            link: '/dashboard/queries'
                        }
                    });
                }

                // 4. Notify Issuing Officer
                if (query.issuedBy?.id && query.issuedBy.id !== staffUser?.id) {
                    await prisma.notification.create({
                        data: {
                            userId: query.issuedBy.id,
                            title: '⚠️ Query Defense Defaulted',
                            message: `${staffName} (${staffId}) did not respond to query "${query.title}" within the stipulated deadline. Query status has been set to DEFAULTED_UNANSWERED.`,
                            type: 'WARNING',
                            link: '/dashboard/queries'
                        }
                    });
                }

                // 5. Notify HR Admins & Registrar
                const hrOfficers = await prisma.user.findMany({
                    where: {
                        role: { in: [Role.HR_ADMIN, Role.REGISTRAR, Role.SUPER_USER] },
                        isActive: true
                    },
                    select: { id: true }
                });

                for (const officer of hrOfficers) {
                    await prisma.notification.create({
                        data: {
                            userId: officer.id,
                            title: '⚖️ Disciplinary Query Default Notice',
                            message: `${staffName} (${staffId}) defaulted on disciplinary query "${query.title}". Promotion eligibility suspended.`,
                            type: 'WARNING',
                            link: '/dashboard/hr/queries'
                        }
                    });
                }

                console.log(`[QUERY_BREACH_CRON] ✅ Processed query breach for ${staffName} (Query: ${query.title})`);
            } catch (queryErr: any) {
                console.error(`[QUERY_BREACH_CRON] ❌ Error processing query ${query.id}:`, queryErr.message);
            }
        }
    } catch (err: any) {
        console.error('[QUERY_BREACH_CRON] Fatal error in query breach cron:', err.message);
    }
};

export const scheduleQueryDeadlineCron = () => {
    // Run every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
        await runQueryDeadlineJob();
    });

    console.log('[QUERY_BREACH_CRON] ✅ Disciplinary query deadline breach monitor cron scheduled (every 10 min).');
};
