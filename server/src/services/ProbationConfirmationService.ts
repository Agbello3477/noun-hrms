import prisma from '../prisma';
import { ConfirmationStatus, LeaveType, Role } from '@prisma/client';

export interface ProbationEvaluationResult {
    totalEvaluated: number;
    dueForAppraisal: number;
    hardDropFlagged: number;
    details: Array<{
        staffProfileId: string;
        staffId: string | null;
        name: string;
        monthsOnProbation: number;
        status: ConfirmationStatus;
        actionTaken: string;
    }>;
}

export class ProbationConfirmationService {
    /**
     * Daily Cron Worker Evaluator:
     * - Identifies staff where confirmationStatus === 'ON_PROBATION' and probationStartDate <= now() - 2 years.
     *   Alerts the immediate HOD: "Action Required: Staff member [Name] has completed 2 years statutory probation. Initiate Confirmation Appraisal."
     * - Identifies staff where probationStartDate <= now() - 3 years and confirmationStatus !== 'CONFIRMED'.
     *   Automatically stages on Registrar Executive Docket / flags as TERMINATION_RECOMMENDED (3-Year Hard Drop Rule).
     */
    static async evaluateProbationStatus(currentDate: Date = new Date()): Promise<ProbationEvaluationResult> {
        const staffList = await prisma.staffProfile.findMany({
            where: {
                isDeleted: false,
                confirmationStatus: {
                    in: [ConfirmationStatus.ON_PROBATION, ConfirmationStatus.PROBATION_EXTENDED]
                }
            },
            include: {
                user: true,
                unit: true,
                studyCenter: true
            }
        });

        const now = currentDate.getTime();
        const twoYearsMs = 2 * 365.25 * 24 * 60 * 60 * 1000;
        const threeYearsMs = 3 * 365.25 * 24 * 60 * 60 * 1000;

        let dueForAppraisal = 0;
        let hardDropFlagged = 0;
        const details: ProbationEvaluationResult['details'] = [];

        // Find Registrar users for notifications
        const registrars = await prisma.user.findMany({
            where: {
                role: { in: [Role.REGISTRAR, Role.SUPER_USER, Role.VICE_CHANCELLOR] },
                isActive: true
            },
            select: { id: true }
        });

        for (const staff of staffList) {
            const startDate = staff.probationStartDate ? new Date(staff.probationStartDate).getTime() : (staff.dateOfFirstAppointment ? new Date(staff.dateOfFirstAppointment).getTime() : now);
            const elapsedMs = now - startDate;
            const monthsOnProbation = Math.floor(elapsedMs / (30.4375 * 24 * 60 * 60 * 1000));
            const staffName = `${staff.title ? staff.title + ' ' : ''}${staff.surname || ''} ${staff.otherNames || ''}`.trim() || staff.user.name || 'Staff Member';

            // 3-Year Hard Drop Threshold Check
            if (elapsedMs >= threeYearsMs && staff.confirmationStatus !== ConfirmationStatus.CONFIRMED) {
                hardDropFlagged++;
                await prisma.staffProfile.update({
                    where: { id: staff.id },
                    data: {
                        confirmationStatus: ConfirmationStatus.TERMINATION_RECOMMENDED
                    }
                });

                // Stage on Registrar Executive Docket
                for (const reg of registrars) {
                    await prisma.notification.create({
                        data: {
                            userId: reg.id,
                            title: '🚨 MANDATORY_PROBATION_EXPIRATION_REVIEW (3-Year Rule)',
                            message: `Action Required: Staff member ${staffName} (${staff.staffId || 'N/A'}) has served ${monthsOnProbation} months without confirmation, exceeding the 3-Year statutory maximum. Staged for mandatory termination review.`,
                            type: 'CRITICAL',
                            link: '/registrar-cockpit'
                        }
                    }).catch(() => {});
                }

                details.push({
                    staffProfileId: staff.id,
                    staffId: staff.staffId,
                    name: staffName,
                    monthsOnProbation,
                    status: ConfirmationStatus.TERMINATION_RECOMMENDED,
                    actionTaken: 'Flagged for Mandatory 3-Year Termination Review on Registrar Docket'
                });
                continue;
            }

            // 2-Year Statutory Probation Completion Check
            if (elapsedMs >= twoYearsMs && staff.confirmationStatus === ConfirmationStatus.ON_PROBATION) {
                dueForAppraisal++;

                // Alert Unit HOD / Dean if unit exists
                let hodUserId: string | null = null;
                if (staff.unitId) {
                    const unit = await prisma.unit.findUnique({
                        where: { id: staff.unitId }
                    });
                    if (unit?.headId) {
                        hodUserId = unit.headId;
                    }
                }

                if (hodUserId) {
                    await prisma.notification.create({
                        data: {
                            userId: hodUserId,
                            title: '📋 Statutory Probation Appraisal Due',
                            message: `Action Required: Staff member ${staffName} (${staff.staffId || 'N/A'}) has completed 2 years statutory probation. Initiate Confirmation Appraisal.`,
                            type: 'WARNING',
                            link: '/academic-management'
                        }
                    }).catch(() => {});
                }

                details.push({
                    staffProfileId: staff.id,
                    staffId: staff.staffId,
                    name: staffName,
                    monthsOnProbation,
                    status: staff.confirmationStatus,
                    actionTaken: 'Sent Confirmation Appraisal Prompt to Immediate Unit Supervisor'
                });
            }
        }

        return {
            totalEvaluated: staffList.length,
            dueForAppraisal,
            hardDropFlagged,
            details
        };
    }

    /**
     * Hard Prerequisites Guard: Promotion Application
     * Rejects if staffProfile.confirmationStatus !== 'CONFIRMED'
     */
    static validatePromotionPrerequisites(staffProfile: { confirmationStatus?: ConfirmationStatus | string | null }): { valid: boolean; error?: string; message?: string } {
        if (staffProfile.confirmationStatus !== ConfirmationStatus.CONFIRMED && staffProfile.confirmationStatus !== 'CONFIRMED') {
            return {
                valid: false,
                error: 'PROMOTION_REQUIRES_CONFIRMED_APPOINTMENT',
                message: 'Promotion requires confirmed appointment'
            };
        }
        return { valid: true };
    }

    /**
     * Hard Prerequisites Guard: Study / Training Leave
     * Rejects if staffProfile.confirmationStatus !== 'CONFIRMED'
     */
    static validateLeavePrerequisites(
        staffProfile: { confirmationStatus?: ConfirmationStatus | string | null },
        leaveType: LeaveType | string
    ): { valid: boolean; error?: string; message?: string } {
        const isTrainingOrStudy = leaveType === LeaveType.STUDY || 
                                  leaveType === LeaveType.TRAINING || 
                                  leaveType === 'STUDY' || 
                                  leaveType === 'TRAINING';

        if (isTrainingOrStudy && staffProfile.confirmationStatus !== ConfirmationStatus.CONFIRMED && staffProfile.confirmationStatus !== 'CONFIRMED') {
            return {
                valid: false,
                error: 'STUDY_LEAVE_REQUIRES_CONFIRMED_APPOINTMENT',
                message: 'Study and Training leave requires confirmed appointment'
            };
        }
        return { valid: true };
    }

    /**
     * Registrar Executive Ratification:
     * - CONFIRMED: Sets confirmedAt, status = CONFIRMED
     * - PROBATION_EXTENDED: Sets probationExtendedAt, status = PROBATION_EXTENDED
     * - TERMINATION_RECOMMENDED: Sets status = TERMINATION_RECOMMENDED
     */
    static async ratifyConfirmation(
        staffProfileId: string,
        authorizerId: string,
        decision: ConfirmationStatus | 'CONFIRMED' | 'PROBATION_EXTENDED' | 'TERMINATION_RECOMMENDED',
        remarks?: string
    ) {
        const profile = await prisma.staffProfile.findFirst({
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

        if (!profile) {
            throw new Error('Staff profile not found');
        }

        const now = new Date();
        let updateData: any = {
            confirmationStatus: decision as ConfirmationStatus
        };

        const resolvedDecision = String(decision);
        if (resolvedDecision === ConfirmationStatus.CONFIRMED) {
            updateData.confirmedAt = now;
        } else if (resolvedDecision === ConfirmationStatus.PROBATION_EXTENDED) {
            updateData.probationExtendedAt = now;
        }

        const updated = await prisma.staffProfile.update({
            where: { id: staffProfileId },
            data: updateData
        });

        // Notify Staff Member
        await prisma.notification.create({
            data: {
                userId: profile.userId,
                title: decision === 'CONFIRMED' ? '🎉 Appointment Confirmed' : '⚠️ Probation Status Update',
                message: decision === 'CONFIRMED' 
                    ? 'Your appointment with the National Open University of Nigeria has been formally ratified and confirmed.'
                    : `Your probation status has been updated to ${decision}. Remarks: ${remarks || 'None'}`,
                type: decision === 'CONFIRMED' ? 'SUCCESS' : 'INFO',
                link: '/portal/profile'
            }
        }).catch(() => {});

        return updated;
    }
}
