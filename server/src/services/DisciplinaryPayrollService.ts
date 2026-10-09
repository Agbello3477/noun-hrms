import prisma from '../prisma';
import { Prisma } from '@prisma/client';

export type DisciplinarySanctionType = 'SUSPENDED' | 'INTERDICTED';
export type DisciplinaryVerdictType = 'EXONERATED' | 'DISMISSED' | 'CONVICTED' | 'COMPASSIONATE_GROUNDS';

export class DisciplinaryPayrollService {
    /**
     * Applies Disciplinary Sanction (Suspension or Interdiction)
     */
    static async applySanction(
        staffProfileId: string,
        sanctionType: DisciplinarySanctionType,
        authorizerId: string,
        remarks?: string
    ) {
        const staff = await prisma.staffProfile.findFirst({
            where: {
                OR: [
                    { id: staffProfileId },
                    { staffId: staffProfileId },
                    { userId: staffProfileId },
                    { user: { email: staffProfileId } }
                ],
                isDeleted: false
            },
            include: { user: true }
        });

        if (!staff) {
            throw new Error('Staff profile not found');
        }

        const isSuspended = sanctionType === 'SUSPENDED';
        const isInterdicted = sanctionType === 'INTERDICTED';

        const updated = await prisma.staffProfile.update({
            where: { id: staff.id },
            data: {
                isDisciplinarySuspended: isSuspended,
                isDisciplinaryInterdicted: isInterdicted,
                hasActiveDisciplinaryBlock: true,
                disciplinaryBlockReason: remarks || `Placed under disciplinary ${sanctionType.toLowerCase()}`
            }
        });

        // Notify staff
        await prisma.notification.create({
            data: {
                userId: staff.userId,
                title: `⚖️ Disciplinary ${sanctionType} Executed`,
                message: `You have been placed under official ${sanctionType.toLowerCase()}. Statutory 50% emolument withholding is scheduled per NOUN Conditions of Service.`,
                type: 'WARNING',
                link: '/portal/profile'
            }
        }).catch(() => {});

        return updated;
    }

    /**
     * Records withheld emoluments into HeldEmolumentsLedger during monthly payroll calculation
     */
    static async recordHeldEmolument(params: {
        staffProfileId: string;
        month: string;
        year: number;
        grossSalary: number;
        sanctionType: 'SUSPENSION' | 'INTERDICTION';
    }) {
        const { staffProfileId, month, year, grossSalary, sanctionType } = params;
        const heldAmount = Math.round((grossSalary * 0.5) * 100) / 100;
        const disbursedAmount = Math.round((grossSalary * 0.5) * 100) / 100;

        // Check if ledger record already exists for this period
        const existing = await prisma.heldEmolumentsLedger.findFirst({
            where: {
                staffProfileId,
                month: String(month),
                year,
                status: 'HELD'
            }
        });

        if (existing) {
            return existing;
        }

        return prisma.heldEmolumentsLedger.create({
            data: {
                staffProfileId,
                month: String(month),
                year,
                grossSalary: new Prisma.Decimal(grossSalary),
                heldAmount: new Prisma.Decimal(heldAmount),
                disbursedAmount: new Prisma.Decimal(disbursedAmount),
                sanctionType,
                status: 'HELD'
            }
        });
    }

    /**
     * Resolves Disciplinary Case with Verdict:
     * - EXONERATED: Resets flags, restores 100% pay, generates Arrears Payout Batch for all accumulated 50% deductions.
     * - DISMISSED / CONVICTED: Permanently forfeits held salary to University Treasury.
     * - COMPASSIONATE_GROUNDS: Resets flags to 100% forward pay, forfeits held balance without refund.
     */
    static async resolveVerdict(
        staffProfileId: string,
        verdict: DisciplinaryVerdictType,
        authorizerId: string,
        reference?: string
    ) {
        const staff = await prisma.staffProfile.findFirst({
            where: {
                OR: [
                    { id: staffProfileId },
                    { staffId: staffProfileId },
                    { userId: staffProfileId },
                    { user: { email: staffProfileId } }
                ],
                isDeleted: false
            },
            include: { user: true }
        });

        if (!staff) {
            throw new Error('Staff profile not found');
        }

        const now = new Date();
        const heldRecords = await prisma.heldEmolumentsLedger.findMany({
            where: {
                staffProfileId: staff.id,
                status: 'HELD'
            }
        });

        let totalHeldAmount = 0;
        for (const rec of heldRecords) {
            totalHeldAmount += Number(rec.heldAmount);
        }

        let arrearsBatch: any = null;

        if (verdict === 'EXONERATED') {
            // 1. Reset disciplinary flags
            await prisma.staffProfile.update({
                where: { id: staff.id },
                data: {
                    isDisciplinarySuspended: false,
                    isDisciplinaryInterdicted: false,
                    hasActiveDisciplinaryBlock: false,
                    disciplinaryBlockReason: null
                }
            });

            // 2. Mark all held records as REFUNDED_ARREARS
            if (heldRecords.length > 0) {
                await prisma.heldEmolumentsLedger.updateMany({
                    where: {
                        staffProfileId,
                        status: 'HELD'
                    },
                    data: {
                        status: 'REFUNDED_ARREARS',
                        settledAt: now,
                        settlementReference: reference || `EXONERATION_ARREARS_${now.getTime()}`
                    }
                });
            }

            arrearsBatch = {
                staffProfileId,
                totalRefundAmount: totalHeldAmount,
                recordsCount: heldRecords.length,
                status: 'BURSARY_ARREARS_PAYOUT_BATCH_GENERATED',
                settlementReference: reference || `EXONERATION_ARREARS_${now.getTime()}`
            };

            // Notify staff
            await prisma.notification.create({
                data: {
                    userId: staff.userId,
                    title: '✅ Full Exoneration & Arrears Restored',
                    message: `You have been fully exonerated. Your full salary is restored, and an arrears payout of ₦${totalHeldAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })} has been scheduled for Bursary disbursement.`,
                    type: 'SUCCESS',
                    link: '/portal/profile'
                }
            }).catch(() => {});

        } else if (verdict === 'DISMISSED' || verdict === 'CONVICTED') {
            // Permanently forfeit to University Treasury
            if (heldRecords.length > 0) {
                await prisma.heldEmolumentsLedger.updateMany({
                    where: {
                        staffProfileId,
                        status: 'HELD'
                    },
                    data: {
                        status: 'FORFEITED_TREASURY',
                        settledAt: now,
                        settlementReference: reference || `VERDICT_${verdict}_FORFEITURE_${now.getTime()}`
                    }
                });
            }

            arrearsBatch = {
                staffProfileId,
                totalForfeitedAmount: totalHeldAmount,
                recordsCount: heldRecords.length,
                status: 'FORFEITED_TO_UNIVERSITY_TREASURY',
                settlementReference: reference || `VERDICT_${verdict}_FORFEITURE_${now.getTime()}`
            };

        } else if (verdict === 'COMPASSIONATE_GROUNDS') {
            // Recall on compassionate grounds: Reset flags moving forward, but suppress refund
            await prisma.staffProfile.update({
                where: { id: staffProfileId },
                data: {
                    isDisciplinarySuspended: false,
                    isDisciplinaryInterdicted: false,
                    hasActiveDisciplinaryBlock: false,
                    disciplinaryBlockReason: 'Recalled on compassionate grounds (withheld balance forfeited per Sec 3.3.1.iv)'
                }
            });

            if (heldRecords.length > 0) {
                await prisma.heldEmolumentsLedger.updateMany({
                    where: {
                        staffProfileId,
                        status: 'HELD'
                    },
                    data: {
                        status: 'FORFEITED_TREASURY',
                        settledAt: now,
                        settlementReference: reference || `COMPASSIONATE_RECALL_FORFEITURE_${now.getTime()}`
                    }
                });
            }

            arrearsBatch = {
                staffProfileId,
                totalForfeitedAmount: totalHeldAmount,
                recordsCount: heldRecords.length,
                status: 'COMPASSIONATE_RECALL_PAYROLL_RESTORED_WITHOUT_ARREARS',
                settlementReference: reference || `COMPASSIONATE_RECALL_FORFEITURE_${now.getTime()}`
            };

            await prisma.notification.create({
                data: {
                    userId: staff.userId,
                    title: '🕊️ Recalled on Compassionate Grounds',
                    message: 'You have been recalled from suspension on compassionate grounds. Standard 100% payroll resumes moving forward.',
                    type: 'INFO',
                    link: '/portal/profile'
                }
            }).catch(() => {});
        }

        return {
            verdict,
            staffProfileId,
            arrearsBatch
        };
    }
}
