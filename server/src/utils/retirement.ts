/**
 * Statutory Retirement Calculation Utility — NOUN (National Open University of Nigeria)
 *
 * Rules based on Federal Government of Nigeria Public Service Rules & Universities (Miscellaneous Provisions) Act:
 *  - Academic Cadre with substantive rank of PROFESSOR or READER (Associate Professor):
 *      Statutory retirement age is exactly 75 years from date of birth.
 *  - All other staff categories (Lecturer cadres, Senior Administrative, Executive, Secretarial, Technical, Medical, Security, Junior staff):
 *      Statutory retirement age is 65 years of age OR 35 years of pensionable service (whichever comes first).
 */

export type RetirementReason = 'AGE_LIMIT' | 'SERVICE_YEARS';

export interface StatutoryRetirementResult {
    retirementDate: Date;
    reason: RetirementReason;
    isProfessorOrReader: boolean;
    isAcademic: boolean;
    ageLimit: number;           // 75 for Prof/Reader, 65 for others
    serviceLimit: number | null; // 35 for others, null for Prof/Reader (or 75 age cap)
    ageRetirementDate: Date;
    serviceRetirementDate: Date | null;
}

export interface RetirementResult extends StatutoryRetirementResult {}

const PROF_READER_KEYWORDS = [
    'PROFESSOR',
    'READER',
    'ASSOCIATE PROFESSOR',
    'ASSOC PROFESSOR',
    'ASSOC. PROFESSOR',
    'ASSOC. PROF',
    'CHAIR PROFESSOR',
    'DISTINGUISHED PROFESSOR'
];

/**
 * Check if a staff member qualifies as Professor / Reader
 */
export function isProfessorOrReaderRank(rank?: string | null, cadre?: string | null): boolean {
    const normalizedRank = (rank || '').toUpperCase().trim();
    const normalizedCadre = (cadre || '').toUpperCase().trim();

    const isAcademicCadre = normalizedCadre === 'ACADEMIC';
    const matchesProfKeyword = PROF_READER_KEYWORDS.some(keyword => 
        normalizedRank === keyword || normalizedRank.includes(keyword)
    );

    return isAcademicCadre && matchesProfKeyword;
}

/**
 * Calculate statutory retirement date according to statutory university rules.
 *
 * @param dateOfBirth            - Staff date of birth
 * @param dateOfFirstAppointment - Staff first appointment date (start of pensionable service)
 * @param rank                   - Staff substantive rank (e.g. "Professor", "Reader", "Lecturer I", "Principal Admin Officer")
 * @param cadre                  - Staff cadre (e.g. "ACADEMIC", "ADMINISTRATIVE", "TECHNICAL", etc.)
 */
export function calculateStatutoryRetirementDate(
    dateOfBirth: Date,
    dateOfFirstAppointment: Date | null | undefined,
    rank?: string | null,
    cadre?: string | null
): StatutoryRetirementResult {
    const isAcademic = (cadre || '').toUpperCase().trim() === 'ACADEMIC';
    const isProfOrReader = isProfessorOrReaderRank(rank, cadre);

    // Rule 1: Professor or Reader -> Exactly 75 years of age
    if (isProfOrReader) {
        const ageRetirementDate = new Date(dateOfBirth);
        ageRetirementDate.setFullYear(ageRetirementDate.getFullYear() + 75);

        return {
            retirementDate: ageRetirementDate,
            reason: 'AGE_LIMIT',
            isProfessorOrReader: true,
            isAcademic: true,
            ageLimit: 75,
            serviceLimit: null,
            ageRetirementDate,
            serviceRetirementDate: null
        };
    }

    // Rule 2: All other staff (Lecturers, Admin, Tech, Security, Junior, etc.) -> 65 years age OR 35 years service
    const ageLimit = 65;
    const serviceLimit = 35;

    const ageRetirementDate = new Date(dateOfBirth);
    ageRetirementDate.setFullYear(ageRetirementDate.getFullYear() + ageLimit);

    let serviceRetirementDate: Date | null = null;
    if (dateOfFirstAppointment) {
        serviceRetirementDate = new Date(dateOfFirstAppointment);
        serviceRetirementDate.setFullYear(serviceRetirementDate.getFullYear() + serviceLimit);
    }

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
        isProfessorOrReader: false,
        isAcademic,
        ageLimit,
        serviceLimit,
        ageRetirementDate,
        serviceRetirementDate
    };
}

/**
 * Backward compatibility wrapper for calculateRetirementDate
 */
export function calculateRetirementDate(
    dateOfBirth: Date,
    dateOfFirstAppointment: Date | null,
    cadre?: string | null,
    rank?: string | null
): RetirementResult {
    return calculateStatutoryRetirementDate(dateOfBirth, dateOfFirstAppointment, rank, cadre);
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
    return reason === 'AGE_LIMIT' ? 'Age Limit Reached' : '35 Years Pensionable Service Reached';
}
