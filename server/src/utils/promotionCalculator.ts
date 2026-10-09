import { CadreType, PromotionEligibilityStatus } from '@prisma/client';
import { getNextGradeProgression, getPostDefinition } from '../constants/schemeOfService';

export interface PromotionMaturityResult {
    intervalYears: number;
    nextDueYear: number;
    nextDueDate: Date;
    cadreRuleApplied: string;
    standardInterval: number;
    nextGrade?: string | null;
    nextSalaryScale?: string | null;
    qualifications?: string | null;
}

/**
 * Normalizes grade level strings and extracts numerical CONTISS/CONUASS grade level.
 * Example: "CONTISS 13/2" -> 13, "CONUASS 05" -> 5, "Level 12" -> 12
 */
export const extractGradeLevelNumber = (levelStr?: string | null): number | null => {
    if (!levelStr) return null;
    const match = levelStr.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
};

/**
 * Cadre-based promotion maturity calculator adhering to statutory guidelines:
 * - ACADEMIC: 3-year statutory interval (October 1st annual academic cycle maturity).
 * - SENIOR_ADMIN: 3 years (CONTISS 06–11) or 4 years (CONTISS 12–15) (January 1st maturity).
 * - JUNIOR_STAFF: 3 years (CONTISS 01–05) (January 1st maturity).
 * - TECHNICAL / MEDICAL / SECURITY: 3-year interval (January 1st maturity).
 * - Dynamic Scheme of Service progression integration.
 */
export const calculatePromotionMaturity = (
    lastPromotionDate: Date | string | null | undefined,
    cadre?: CadreType | string | null,
    gradeLevel?: string | null,
    rankOrPost?: string | null
): PromotionMaturityResult => {
    // Default fallback date if lastPromotionDate is unset (current year)
    const baseDate = lastPromotionDate ? new Date(lastPromotionDate) : new Date();
    const validDate = isNaN(baseDate.getTime()) ? new Date() : baseDate;
    const baseYear = validDate.getFullYear();

    const normalizedCadre = (cadre || '').toUpperCase().trim();
    const gradeNum = extractGradeLevelNumber(gradeLevel);

    // Scheme of Service Statutory Lookup
    const schemeProgression = getNextGradeProgression(cadre || '', rankOrPost || gradeLevel || '');

    let intervalYears = 3;
    let cadreRuleApplied = 'Standard Institutional 3-Year Interval';
    let isOctoberMaturity = false;

    if (normalizedCadre.includes('ACADEMIC')) {
        intervalYears = schemeProgression.minYearsWaiting > 0 ? schemeProgression.minYearsWaiting : 3;
        isOctoberMaturity = true;
        cadreRuleApplied = `Academic Cadre: ${intervalYears}-Year Statutory Waiting Period (October 1st Review Cycle)`;
    } else if (normalizedCadre === 'SENIOR_ADMIN' || normalizedCadre === 'ADMINISTRATIVE' || normalizedCadre.includes('ADMIN')) {
        if (gradeNum && gradeNum >= 10) {
            intervalYears = 4;
            cadreRuleApplied = `Senior Administrative & Professional (CONTISS ${gradeNum}): 4-Year Statutory Waiting Period (January 1st)`;
        } else if (schemeProgression.minYearsWaiting > 0) {
            intervalYears = schemeProgression.minYearsWaiting;
            cadreRuleApplied = `Senior Administrative (${rankOrPost || 'Scheme of Service'}): ${intervalYears}-Year Waiting Period (January 1st)`;
        } else {
            intervalYears = 3;
            cadreRuleApplied = `Senior Administrative & Technical (CONTISS ${gradeNum || '06-09'}): 3-Year Standard Waiting Period (January 1st)`;
        }
    } else if (normalizedCadre === 'JUNIOR_STAFF' || normalizedCadre === 'JUNIOR' || normalizedCadre.includes('JUNIOR')) {
        intervalYears = schemeProgression.minYearsWaiting > 0 ? schemeProgression.minYearsWaiting : 3;
        cadreRuleApplied = 'Junior Staff Cadre: 3-Year Waiting Period (January 1st)';
    } else if (normalizedCadre === 'TECHNICAL' || normalizedCadre.includes('TECHN') || normalizedCadre.includes('ENGINEER')) {
        intervalYears = schemeProgression.minYearsWaiting > 0 ? schemeProgression.minYearsWaiting : 3;
        cadreRuleApplied = 'Technical Cadre: 3-Year Waiting Period (January 1st)';
    } else if (normalizedCadre === 'MEDICAL' || normalizedCadre.includes('HEALTH') || normalizedCadre.includes('MEDIC')) {
        intervalYears = schemeProgression.minYearsWaiting > 0 ? schemeProgression.minYearsWaiting : 3;
        cadreRuleApplied = 'Medical/Health Services Cadre: 3-Year Waiting Period (January 1st)';
    } else if (normalizedCadre === 'SECURITY' || normalizedCadre.includes('SECUR')) {
        intervalYears = schemeProgression.minYearsWaiting > 0 ? schemeProgression.minYearsWaiting : 3;
        cadreRuleApplied = 'Security Services Cadre: 3-Year Waiting Period (January 1st)';
    }

    const nextDueYear = baseYear + intervalYears;

    // Construct nextDueDate
    // Month is 0-indexed: 9 = October, 0 = January
    const nextDueDate = isOctoberMaturity
        ? new Date(Date.UTC(nextDueYear, 9, 1, 0, 0, 0))
        : new Date(Date.UTC(nextDueYear, 0, 1, 0, 0, 0));

    return {
        intervalYears,
        nextDueYear,
        nextDueDate,
        cadreRuleApplied,
        standardInterval: intervalYears,
        nextGrade: schemeProgression.nextGrade,
        nextSalaryScale: schemeProgression.nextSalaryScale,
        qualifications: schemeProgression.qualifications
    };
};

export interface PromotionMaturityInput {
    cadre?: CadreType | string | null;
    rank?: string | null;
    level?: string | number | null;
    gradeLevel?: string | null;
    dateOfFirstAppointment?: Date | string | null;
    lastPromotionDate?: Date | string | null;
    overrideDueYear?: number | null;
    overrideDueDate?: Date | string | null;
    overrideReason?: string | null;
    isDueImmediately?: boolean;
}

export interface DetailedPromotionMaturity {
    lastPromotionDate: Date | null;
    nextDueYear: number;
    dueYear: number;
    nextDueDate: Date;
    dueDate: Date;
    intervalYears: number;
    cadreRuleApplied: string;
    eligibilityStatus: PromotionEligibilityStatus;
    isOverridden: boolean;
    overrideReason?: string | null;
    nextGrade?: string | null;
    nextSalaryScale?: string | null;
    qualifications?: string | null;
}

/**
 * Cadre Computation Helper adhering to institutional specifications.
 * Supports both options object and positional arguments:
 * calculateNextPromotionMaturity(options)
 * calculateNextPromotionMaturity(lastDate, cadre, gradeLevel, rank)
 */
export function calculateNextPromotionMaturity(
    inputOrLastDate: PromotionMaturityInput | Date | string | null | undefined,
    cadreParam?: CadreType | string | null,
    gradeLevelParam?: string | null,
    rankParam?: string | null
): DetailedPromotionMaturity {
    let cadre: CadreType | string | null | undefined;
    let rank: string | null | undefined;
    let gradeLevel: string | null | undefined;
    let baseDate: Date | null = null;
    let overrideDueYear: number | null | undefined;
    let overrideDueDate: Date | string | null | undefined;
    let overrideReason: string | null | undefined;
    let isDueImmediately = false;

    if (inputOrLastDate && typeof inputOrLastDate === 'object' && !(inputOrLastDate instanceof Date)) {
        // Object input
        const input = inputOrLastDate as PromotionMaturityInput;
        cadre = input.cadre;
        rank = input.rank;
        gradeLevel = input.gradeLevel || (input.level ? String(input.level) : null);
        
        if (input.lastPromotionDate) {
            const p = new Date(input.lastPromotionDate);
            if (!isNaN(p.getTime())) baseDate = p;
        } else if (input.dateOfFirstAppointment) {
            const a = new Date(input.dateOfFirstAppointment);
            if (!isNaN(a.getTime())) baseDate = a;
        }
        
        overrideDueYear = input.overrideDueYear;
        overrideDueDate = input.overrideDueDate;
        overrideReason = input.overrideReason;
        isDueImmediately = Boolean(input.isDueImmediately);
    } else {
        // Positional args
        if (inputOrLastDate) {
            const d = new Date(inputOrLastDate as Date | string);
            if (!isNaN(d.getTime())) baseDate = d;
        }
        cadre = cadreParam;
        gradeLevel = gradeLevelParam;
    }

    if (!baseDate) {
        baseDate = new Date();
    }

    const calculated = calculatePromotionMaturity(baseDate, cadre, gradeLevel, rank);
    const autoDueYear = calculated.nextDueYear;
    const autoDueDate = calculated.nextDueDate;

    const finalDueYear = overrideDueYear ? Number(overrideDueYear) : autoDueYear;
    let finalDueDate = autoDueDate;
    if (overrideDueDate) {
        const od = new Date(overrideDueDate);
        if (!isNaN(od.getTime())) finalDueDate = od;
    }

    const currentYear = new Date().getFullYear();
    let eligibilityStatus: PromotionEligibilityStatus = PromotionEligibilityStatus.PENDING_MATURITY;
    if (isDueImmediately || finalDueYear <= currentYear) {
        eligibilityStatus = PromotionEligibilityStatus.DUE_FOR_REVIEW;
    }

    const isOverridden = Boolean(overrideDueYear && overrideDueYear !== autoDueYear);

    return {
        lastPromotionDate: baseDate,
        nextDueYear: finalDueYear,
        dueYear: finalDueYear,
        nextDueDate: finalDueDate,
        dueDate: finalDueDate,
        intervalYears: calculated.intervalYears,
        cadreRuleApplied: calculated.cadreRuleApplied,
        eligibilityStatus,
        isOverridden,
        overrideReason: isOverridden ? (overrideReason || null) : null,
        nextGrade: calculated.nextGrade,
        nextSalaryScale: calculated.nextSalaryScale,
        qualifications: calculated.qualifications
    };
}

