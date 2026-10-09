import prisma from '../prisma';
import { ResettlementBursaryStatus, Prisma } from '@prisma/client';
import { PayrollService } from './payroll.service';

export interface ResettlementCalculationResult {
    isManagementInitiated: boolean;
    annualBasicEmolument: number;
    resettlementAllowanceAmount: number;
    resettlementBursaryStatus: ResettlementBursaryStatus;
    requisitionReference?: string;
}

export class PostingAllowanceEngine {
    /**
     * Computes Management Resettlement Allowance:
     * - If isManagementInitiated === true: 2% of annual basic emolument (0.02 * Annual Basic).
     * - If isManagementInitiated === false: 0.00 and NOT_APPLICABLE.
     */
    static async calculateAllowance(
        staffProfileId: string,
        isManagementInitiated: boolean
    ): Promise<ResettlementCalculationResult> {
        if (!isManagementInitiated) {
            return {
                isManagementInitiated: false,
                annualBasicEmolument: 0,
                resettlementAllowanceAmount: 0.00,
                resettlementBursaryStatus: ResettlementBursaryStatus.NOT_APPLICABLE
            };
        }

        const profile = await prisma.staffProfile.findUnique({
            where: { id: staffProfileId }
        });

        if (!profile) {
            throw new Error('Staff profile not found');
        }

        let annualBasic = Number(profile.annualBasicEmolument || 0);

        // If annualBasicEmolument is not explicitly set on profile, compute from salary scale
        if (annualBasic <= 0) {
            try {
                const salaryDetails = await PayrollService.calculateSalary(profile.id);
                if (salaryDetails?.basicSalary) {
                    annualBasic = Number(salaryDetails.basicSalary) * 12;
                }
            } catch (err) {
                // Fallback default if salary scale is unconfigured
                annualBasic = 1200000; // Standard nominal fallback
            }
        }

        // 2% statutory calculation
        const allowance = Math.round((annualBasic * 0.02) * 100) / 100;

        return {
            isManagementInitiated: true,
            annualBasicEmolument: annualBasic,
            resettlementAllowanceAmount: allowance,
            resettlementBursaryStatus: ResettlementBursaryStatus.PENDING_BURSARY_DISBURSEMENT,
            requisitionReference: `BURSARY-RESETTLE-${Date.now()}`
        };
    }

    /**
     * Applies the calculated allowance to a StaffPosting or TransferLog on Registrar authorization
     */
    static async applyToPosting(params: {
        transferLogId?: string;
        staffPostingId?: string;
        staffProfileId: string;
        isManagementInitiated: boolean;
        authorizerId: string;
    }) {
        const { transferLogId, staffPostingId, staffProfileId, isManagementInitiated, authorizerId } = params;
        const calc = await this.calculateAllowance(staffProfileId, isManagementInitiated);

        if (transferLogId) {
            await prisma.transferLog.update({
                where: { id: transferLogId },
                data: {
                    isManagementInitiated,
                    resettlementAllowanceAmount: new Prisma.Decimal(calc.resettlementAllowanceAmount),
                    resettlementBursaryStatus: calc.resettlementBursaryStatus
                }
            });
        }

        if (staffPostingId) {
            await prisma.staffPosting.update({
                where: { id: staffPostingId },
                data: {
                    isManagementInitiated,
                    resettlementAllowanceAmount: new Prisma.Decimal(calc.resettlementAllowanceAmount),
                    resettlementBursaryStatus: calc.resettlementBursaryStatus
                }
            });
        }

        return calc;
    }
}
