import { Cadre, CadreType } from '@prisma/client';

/**
 * Universal Cadre & CadreType resolver for NOUN-HRMS
 * Seamlessly maps scheme of service designations, form strings, and legacy inputs
 * to valid Prisma Cadre and CadreType enums.
 */
export function resolveCadre(cadreInput?: any): Cadre {
    if (!cadreInput) return Cadre.ADMINISTRATIVE;
    const str = String(cadreInput).trim().toUpperCase();

    if (str.includes('ACADEMIC') || str.includes('LECTURER') || str.includes('PROFESSOR') || str.includes('READER')) {
        return Cadre.ACADEMIC;
    }
    if (str.includes('MEDICAL') || str.includes('NURSE') || str.includes('NURSING') || str.includes('DOCTOR') || str.includes('PHARMAC') || str.includes('LABORATORY') || str.includes('CLINICAL')) {
        return Cadre.MEDICAL;
    }
    if (str.includes('SECURITY') || str.includes('PATROL') || str.includes('GUARD') || str.includes('CHIEF SECURITY')) {
        return Cadre.SECURITY;
    }
    if (str.includes('ENGINEER') || str.includes('TECHNOLOGIST') || str.includes('TECHNICAL') || str.includes('WORKS') || str.includes('SYSTEMS ANALYST') || str.includes('PROGRAMMER') || str.includes('HARDWARE') || str.includes('NETWORK') || str.includes('ESTATE') || str.includes('ARCHITECT') || str.includes('QUANTITY SURVEYOR')) {
        return Cadre.TECHNICAL;
    }
    if (str.includes('JUNIOR') || str.includes('DRIVER') || str.includes('CRAFTSMAN') || str.includes('ATTENDANT') || str.includes('CLEANER') || str.includes('MESSENGER') || str.includes('GARDENER') || str.includes('CARETAKER') || str.includes('PORTER') || str.includes('ARTISAN') || str.includes('TYPIST') || str.includes('CLERICAL')) {
        return Cadre.JUNIOR;
    }
    return Cadre.ADMINISTRATIVE;
}

export function resolveCadreType(cadreInput?: any, cadreTypeInput?: any): CadreType {
    const raw = String(cadreTypeInput || cadreInput || '').trim().toUpperCase();

    if (raw.includes('ACADEMIC') || raw.includes('LECTURER') || raw.includes('PROFESSOR') || raw.includes('READER')) {
        return CadreType.ACADEMIC;
    }
    if (raw.includes('MEDICAL') || raw.includes('NURSE') || raw.includes('NURSING') || raw.includes('DOCTOR') || raw.includes('PHARMAC') || raw.includes('LABORATORY') || raw.includes('CLINICAL')) {
        return CadreType.MEDICAL;
    }
    if (raw.includes('SECURITY') || raw.includes('PATROL') || raw.includes('GUARD') || raw.includes('CHIEF SECURITY')) {
        return CadreType.SECURITY;
    }
    if (raw.includes('ENGINEER') || raw.includes('TECHNOLOGIST') || raw.includes('TECHNICAL') || raw.includes('WORKS') || raw.includes('SYSTEMS ANALYST') || raw.includes('PROGRAMMER') || raw.includes('HARDWARE') || raw.includes('NETWORK') || raw.includes('ESTATE') || raw.includes('ARCHITECT') || raw.includes('QUANTITY SURVEYOR')) {
        return CadreType.TECHNICAL;
    }
    if (raw.includes('JUNIOR') || raw.includes('DRIVER') || raw.includes('CRAFTSMAN') || raw.includes('ATTENDANT') || raw.includes('CLEANER') || raw.includes('MESSENGER') || raw.includes('GARDENER') || raw.includes('CARETAKER') || raw.includes('PORTER') || raw.includes('ARTISAN') || raw.includes('TYPIST') || raw.includes('CLERICAL')) {
        return CadreType.JUNIOR_STAFF;
    }
    return CadreType.SENIOR_ADMIN;
}
