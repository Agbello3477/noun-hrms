import prisma from '../prisma';
import { Cadre, ConfirmationStatus } from '@prisma/client';
import { extractGradeLevelNumber } from '../utils/promotionCalculator';

export interface AcademicPromotionEvaluationResult {
    isEligible: boolean;
    waitingYears: number;
    statutoryRequirementYears: number;
    confirmationStatusMet: boolean;
    reasons: string[];
}

export class AcademicEligibilityEvaluator {
    /**
     * Evaluates academic promotion eligibility:
     * - Statutory 3-year waiting period on current rank (CONUASS 1-7).
     * - Confirmation prerequisite: appointment must be CONFIRMED.
     */
    static evaluate(profile: {
        cadre?: Cadre | string | null;
        rank?: string | null;
        level?: string | null;
        confirmationStatus?: ConfirmationStatus | string | null;
        lastPromotionDate?: Date | string | null;
        dateOfFirstAppointment?: Date | string | null;
    }, evaluationYear: number = new Date().getFullYear()): AcademicPromotionEvaluationResult {
        const reasons: string[] = [];
        const statutoryRequirementYears = 3; // 3 statutory waiting years for Academic Cadre

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

        if (waitingYears < statutoryRequirementYears) {
            reasons.push(`Academic cadre requires minimum ${statutoryRequirementYears} years waiting period on existing rank (Current: ${waitingYears} years)`);
        }

        const isEligible = isConfirmed && waitingYears >= statutoryRequirementYears;

        return {
            isEligible,
            waitingYears,
            statutoryRequirementYears,
            confirmationStatusMet: isConfirmed,
            reasons
        };
    }
}
