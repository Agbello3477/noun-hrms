/**
 * Retirement Calculation Utility — NOUN (National Open University of Nigeria)
 *
 * Rules based on the Federal Government of Nigeria Public Service Rules (FGN PSR):
 *  - Non-Academic Staff : Retirement at 60 years of age OR 35 years of service (whichever comes first)
 *  - Academic Staff      : Retirement at 65 years of age OR 40 years of service (whichever comes first)
 *
 * Reference: FGN Public Service Rules 2008 (Revised 2021), Rule 160401–160406
 */

export type RetirementReason = 'AGE_LIMIT' | 'SERVICE_YEARS';

export interface RetirementResult {
    retirementDate: Date;
    reason: RetirementReason;
    isAcademic: boolean;
    ageLimit: number;       // 60 or 65
    serviceLimit: number;   // 35 or 40
    ageRetirementDate: Date;
    serviceRetirementDate: Date | null;
}

const ACADEMIC_CADRES = ['ACADEMIC'];

/**
 * Calculate the official retirement date for a staff member.
 *
 * @param dateOfBirth               - Staff date of birth
 * @param dateOfFirstAppointment    - Staff first appointment date (start of service)
 * @param cadre                     - Staff cadre from database (e.g. 'ACADEMIC', 'ADMINISTRATIVE')
 * @returns RetirementResult with the earlier of age/service dates and the reason
 */
export function calculateRetirementDate(
    dateOfBirth: Date,
    dateOfFirstAppointment: Date | null,
    cadre: string | null | undefined
): RetirementResult {
    const isAcademic = ACADEMIC_CADRES.includes((cadre || '').toUpperCase());

    const ageLimit = isAcademic ? 65 : 60;
    const serviceLimit = isAcademic ? 40 : 35;

    // Age-based retirement: birthday in retirement year
    const ageRetirementDate = new Date(dateOfBirth);
    ageRetirementDate.setFullYear(ageRetirementDate.getFullYear() + ageLimit);

    // Service-based retirement (only if appointment date is known)
    let serviceRetirementDate: Date | null = null;
    if (dateOfFirstAppointment) {
        serviceRetirementDate = new Date(dateOfFirstAppointment);
        serviceRetirementDate.setFullYear(serviceRetirementDate.getFullYear() + serviceLimit);
    }

    // Pick the earlier of the two
    let retirementDate: Date;
    let reason: RetirementReason;

    if (serviceRetirementDate && serviceRetirementDate < ageRetirementDate) {
        retirementDate = serviceRetirementDate;
        reason = 'SERVICE_YEARS';
    } else {
        retirementDate = ageRetirementDate;
        reason = 'AGE_LIMIT';
    }

    return {
        retirementDate,
        reason,
        isAcademic,
        ageLimit,
        serviceLimit,
        ageRetirementDate,
        serviceRetirementDate,
    };
}

/**
 * Calculate months between two dates (rounded down)
 */
export function monthsBetween(from: Date, to: Date): number {
    const years = to.getFullYear() - from.getFullYear();
    const months = to.getMonth() - from.getMonth();
    return years * 12 + months;
}

/**
 * Format retirement date as "Month YYYY" (e.g. "July 2026")
 */
export function formatRetirementDate(date: Date): string {
    return date.toLocaleString('en-NG', { month: 'long', year: 'numeric' });
}

/**
 * Get a human-readable label for the retirement reason
 */
export function getRetirementReasonLabel(reason: RetirementReason): string {
    return reason === 'AGE_LIMIT' ? 'Age Limit Reached' : 'Maximum Service Years Reached';
}
