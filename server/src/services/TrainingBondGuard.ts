import prisma from '../prisma';
import { TrainingType, LeaveType, Prisma } from '@prisma/client';

export class TrainingBondGuard {
    /**
     * Calculates statutory bond duration years:
     * - FULL_TIME_SPONSORED: 2x training duration, max 5 years.
     * - PART_TIME_SPONSORED / ODL_SPONSORED: 1x training duration, max 3-5 years.
     * - UNSPONSORED_WITH_PAY: 1x training duration, max 3 years.
     */
    static calculateBondDuration(trainingType: TrainingType, studyDurationYears: number): number {
        const roundedYears = Math.max(1, Math.round(studyDurationYears));
        if (trainingType === TrainingType.FULL_TIME_SPONSORED) {
            return Math.min(5, roundedYears * 2);
        } else if (trainingType === TrainingType.PART_TIME_SPONSORED || trainingType === TrainingType.ODL_SPONSORED) {
            return Math.min(5, Math.max(1, roundedYears));
        } else {
            return Math.min(3, Math.max(1, roundedYears));
        }
    }

    /**
     * Ingestion helper to generate a binding TrainingBondRecord upon study leave approval
     */
    static async createBondRecord(params: {
        staffProfileId: string;
        studyLeaveId?: string;
        trainingType: TrainingType;
        studyDurationYears: number;
        bondStartDate?: Date;
        totalFinancialIndemnity?: number;
    }) {
        const {
            staffProfileId,
            studyLeaveId,
            trainingType,
            studyDurationYears,
            bondStartDate = new Date(),
            totalFinancialIndemnity = 0.00
        } = params;

        const bondDurationYears = this.calculateBondDuration(trainingType, studyDurationYears);
        const start = new Date(bondStartDate);
        const bondEndDate = new Date(start);
        bondEndDate.setFullYear(bondEndDate.getFullYear() + bondDurationYears);

        return prisma.trainingBondRecord.create({
            data: {
                staffProfileId,
                studyLeaveId,
                trainingType,
                bondDurationYears,
                bondStartDate: start,
                bondEndDate,
                totalFinancialIndemnity: new Prisma.Decimal(totalFinancialIndemnity),
                isBondDischarged: false
            }
        });
    }

    /**
     * Interlocking Exit & Leave Guard:
     * Checks if staff member has an active, undischarged training bond.
     * If active, returns validation error details blocking exit/leave.
     */
    static async checkActiveBond(
        staffProfileId: string,
        actionType: 'RESIGN' | 'WITHDRAW' | 'LEAVE_OF_ABSENCE' | 'STUDY_LEAVE' | string
    ): Promise<{ hasActiveBond: boolean; error?: string; message?: string; bond?: any }> {
        const now = new Date();
        const activeBond = await prisma.trainingBondRecord.findFirst({
            where: {
                staffProfileId,
                isBondDischarged: false,
                bondEndDate: { gt: now }
            },
            orderBy: { bondEndDate: 'desc' }
        });

        if (activeBond) {
            const formattedDate = activeBond.bondEndDate.toISOString().split('T')[0];
            return {
                hasActiveBond: true,
                error: 'ACTIVE_TRAINING_BOND_RESTRICTION',
                message: `Staff member is currently under a binding training service bond expiring on ${formattedDate}. Discharge or financial indemnity refund required before exit/leave.`,
                bond: activeBond
            };
        }

        return { hasActiveBond: false };
    }

    /**
     * Registrar discharges an active bond after statutory service period or financial refund
     */
    static async dischargeBond(
        bondId: string,
        dischargedById: string,
        remarks?: string
    ) {
        const bond = await prisma.trainingBondRecord.findUnique({
            where: { id: bondId },
            include: { staffProfile: true }
        });

        if (!bond) {
            throw new Error('Training bond record not found');
        }

        const updated = await prisma.trainingBondRecord.update({
            where: { id: bondId },
            data: {
                isBondDischarged: true,
                dischargedAt: new Date(),
                dischargedById,
                dischargeRemarks: remarks || 'Bond discharged by Registrar'
            }
        });

        if (bond.staffProfile?.userId) {
            await prisma.notification.create({
                data: {
                    userId: bond.staffProfile.userId,
                    title: '🛡️ Training Bond Discharged',
                    message: 'Your institutional training service bond has been formally discharged and released by the Registrar.',
                    type: 'SUCCESS',
                    link: '/portal/profile'
                }
            }).catch(() => {});
        }

        return updated;
    }
}
