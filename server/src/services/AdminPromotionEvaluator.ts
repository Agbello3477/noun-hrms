import prisma from '../prisma';
import { ConfirmationStatus } from '@prisma/client';
import { extractGradeLevelNumber } from '../utils/promotionCalculator';

export interface AdminPromotionEvaluationResult {
    isEligible: boolean;
    waitingYears: number;
    statutoryRequirementYears: number;
    requiresInstitutionalVacancy: boolean;
    hasDeclaredVacancy: boolean;
    confirmationStatusMet: boolean;
    reasons: string[];
}

export class AdminPromotionEvaluator {
    /**
     * Evaluates administrative and technical staff promotion eligibility:
     * - Junior Staff (CONTISS 1-5): 3 statutory waiting years.
     * - Senior Administrative & Technical (CONTISS 6-9): 3 statutory waiting years.
     * - Senior Administrative & Professional (CONTISS 09+ / 10-13, e.g. CONTISS 11 Senior Assistant Registrar): 4 statutory waiting years.
     * - Directorate Grades (CONTISS 14 & 15: Deputy Registrar, Deputy Bursar, Deputy Director):
     *   Blocked from automatic promotion staging; requires explicit InstitutionalVacancy declaration.
     * - Prerequisite: Confirmed appointment.
     */
    static async evaluate(profile: {
        id?: string;
        cadre?: string | null;
        rank?: string | null;
        level?: string | null;
        currentGradeLevel?: string | null;
        confirmationStatus?: ConfirmationStatus | string | null;
        lastPromotionDate?: Date | string | null;
        dateOfFirstAppointment?: Date | string | null;
    }, evaluationYear: number = new Date().getFullYear()): Promise<AdminPromotionEvaluationResult> {
        const reasons: string[] = [];
        const gradeLevelStr = profile.currentGradeLevel || profile.level || '';
        const gradeNum = extractGradeLevelNumber(gradeLevelStr);
        const rankUpper = (profile.rank || '').toUpperCase();

        // 1. Confirmation gate
        const isConfirmed = profile.confirmationStatus === ConfirmationStatus.CONFIRMED || profile.confirmationStatus === 'CONFIRMED';
        if (!isConfirmed) {
            reasons.push('Promotion requires confirmed appointment (Section 2.1 Senior Staff Conditions of Service)');
        }

        // 2. Waiting period calculation
        const baseDate = profile.lastPromotionDate 
            ? new Date(profile.lastPromotionDate) 
            : (profile.dateOfFirstAppointment ? new Date(profile.dateOfFirstAppointment) : new Date());
        
        const baseYear = isNaN(baseDate.getTime()) ? evaluationYear : baseDate.getFullYear();
        const waitingYears = Math.max(0, evaluationYear - baseYear);

        let statutoryRequirementYears = 3;
        if (gradeNum && gradeNum >= 10 && gradeNum <= 13) {
            statutoryRequirementYears = 4; // CONTISS 10, 11, 12, 13 require 4 years
        } else if (gradeNum && gradeNum >= 14) {
            statutoryRequirementYears = 4;
        } else {
            statutoryRequirementYears = 3; // CONTISS 1-9 require 3 years
        }

        if (waitingYears < statutoryRequirementYears) {
            reasons.push(`Cadre (Grade CONTISS ${gradeNum || 'N/A'}) requires minimum ${statutoryRequirementYears} years statutory waiting period (Current: ${waitingYears} years)`);
        }

        // 3. Directorate Level (CONTISS 14 & 15) Institutional Vacancy Lock
        const isDirectorateLevel = (gradeNum !== null && (gradeNum === 14 || gradeNum === 15)) ||
                                   rankUpper.includes('DEPUTY REGISTRAR') || 
                                   rankUpper.includes('DEPUTY BURSAR') || 
                                   rankUpper.includes('DEPUTY DIRECTOR');

        let hasDeclaredVacancy = false;

        if (isDirectorateLevel) {
            // Check if there is an active declared InstitutionalVacancy
            const vacancy = await prisma.institutionalVacancy.findFirst({
                where: {
                    isDeclared: true,
                    gradeLevel: { contains: String(gradeNum || '14') }
                }
            });

            if (!vacancy) {
                reasons.push('Promotion to Directorate level (CONTISS 14/15) is locked: Requires an explicit Institutional Vacancy declared and approved by the Registrar/VC.');
            } else {
                hasDeclaredVacancy = true;
            }
        }

        const vacancyGatePassed = !isDirectorateLevel || hasDeclaredVacancy;
        const isEligible = isConfirmed && waitingYears >= statutoryRequirementYears && vacancyGatePassed;

        return {
            isEligible,
            waitingYears,
            statutoryRequirementYears,
            requiresInstitutionalVacancy: isDirectorateLevel,
            hasDeclaredVacancy,
            confirmationStatusMet: isConfirmed,
            reasons
        };
    }
}
