import prisma from '../prisma';
import cron from 'node-cron';
import { LeaveType } from '@prisma/client';

export interface LeaveLapsingResult {
    year: number;
    totalBalancesEvaluated: number;
    lapsedBalancesCount: number;
    deferredProtectedCount: number;
    totalDaysLapsed: number;
    totalDaysDeferredProtected: number;
    details: Array<{
        staffProfileId: string;
        leaveType: LeaveType;
        initialRemaining: number;
        daysDeferredProtected: number;
        daysLapsed: number;
    }>;
}

export class LeaveCarryoverWorker {
    /**
     * Executes the Year-End Annual Leave Lapsing & Deferment Quota Enforcer:
     * - Protects days covered by approved DeferredLeaveRecords for that year.
     * - Regular staff can defer a maximum of 2 annual leaves toward retirement.
     * - All non-deferred remaining days lapse to 0 on December 31.
     */
    static async executeYearEndLapsing(closingYear: number = new Date().getFullYear()): Promise<LeaveLapsingResult> {
        console.log(`[LeaveCarryoverWorker] Initiating statutory year-end leave lapsing for ${closingYear}...`);

        const balances = await prisma.leaveBalance.findMany({
            where: {
                year: closingYear,
                leaveType: LeaveType.ANNUAL,
                daysRemaining: { gt: 0 }
            },
            include: {
                staff: {
                    include: {
                        deferredLeaves: {
                            where: {
                                calendarYear: closingYear,
                                isUtilized: false
                            }
                        }
                    }
                }
            }
        });

        let lapsedBalancesCount = 0;
        let deferredProtectedCount = 0;
        let totalDaysLapsed = 0;
        let totalDaysDeferredProtected = 0;
        const details: LeaveLapsingResult['details'] = [];

        for (const bal of balances) {
            const initialRemaining = bal.daysRemaining;
            const approvedDeferred = bal.staff.deferredLeaves[0]; // Active deferred leave for this year

            let protectedDays = 0;
            if (approvedDeferred) {
                // Verify max 2 deferred leaves limit for non-principal officers
                const totalDeferredRecords = await prisma.deferredLeaveRecord.count({
                    where: {
                        staffProfileId: bal.staffId,
                        isUtilized: false
                    }
                });

                const isPrincipalOfficer = bal.staff.isPrincipalOfficer;
                if (isPrincipalOfficer || totalDeferredRecords <= 2) {
                    protectedDays = Math.min(initialRemaining, approvedDeferred.deferredDaysCount);
                    deferredProtectedCount++;
                    totalDaysDeferredProtected += protectedDays;
                }
            }

            const daysToLapse = Math.max(0, initialRemaining - protectedDays);

            if (daysToLapse > 0) {
                lapsedBalancesCount++;
                totalDaysLapsed += daysToLapse;

                await prisma.leaveBalance.update({
                    where: { id: bal.id },
                    data: {
                        daysRemaining: protectedDays
                    }
                });
            }

            details.push({
                staffProfileId: bal.staffId,
                leaveType: bal.leaveType,
                initialRemaining,
                daysDeferredProtected: protectedDays,
                daysLapsed: daysToLapse
            });
        }

        console.log(`[LeaveCarryoverWorker] Lapsing complete for ${closingYear}: ${totalDaysLapsed} days lapsed across ${lapsedBalancesCount} staff.`);

        return {
            year: closingYear,
            totalBalancesEvaluated: balances.length,
            lapsedBalancesCount,
            deferredProtectedCount,
            totalDaysLapsed,
            totalDaysDeferredProtected,
            details
        };
    }

    /**
     * Initializes the cron job to run at 23:59 WAT on December 31
     */
    static scheduleCron() {
        // Run on December 31 at 23:59 WAT (West Africa Time is UTC+1)
        cron.schedule('59 23 31 12 *', async () => {
            try {
                const currentYear = new Date().getFullYear();
                await LeaveCarryoverWorker.executeYearEndLapsing(currentYear);
            } catch (error) {
                console.error('[LeaveCarryoverWorker] Cron Execution Error:', error);
            }
        });
    }
}
