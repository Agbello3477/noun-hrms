import { PublicationType } from '@prisma/client';

export enum AcademicRank {
    ASSISTANT_LECTURER = 'ASSISTANT_LECTURER',
    LECTURER_II = 'LECTURER_II',
    LECTURER_I = 'LECTURER_I',
    SENIOR_LECTURER = 'SENIOR_LECTURER',
    ASSOCIATE_PROFESSOR = 'ASSOCIATE_PROFESSOR',
    PROFESSOR = 'PROFESSOR'
}

export enum HighestQualification {
    BACHELORS = 'BACHELORS',
    MASTERS = 'MASTERS',
    PHD = 'PHD'
}

export interface CategoryConstraint {
    maxUnits?: number;
    excluded?: boolean;
}

export interface AcademicPromotionCriteria {
    currentRank: AcademicRank;
    targetRank: AcademicRank;
    targetRankLabel: string;
    minQualification: HighestQualification;
    allowBachelorsWithPhdRegistration: boolean;
    minPublicationPoints: number;
    eligibleOutputCategories: PublicationType[];
    categoryConstraints: Partial<Record<PublicationType, CategoryConstraint>>;
    requiresExternalAssessment: boolean;
    governanceGateDescription: string;
}

export const PUBLICATION_DEFAULT_POINTS: Record<PublicationType, number> = {
    JOURNAL_ARTICLE: 5.0,
    ACADEMIC_BOOK: 10.0,
    BOOK_CHAPTER: 4.0,
    CONFERENCE_PROCEEDING: 3.0,
    COURSE_MATERIAL: 3.0
};

export const ACADEMIC_RANK_ORDER: AcademicRank[] = [
    AcademicRank.ASSISTANT_LECTURER,
    AcademicRank.LECTURER_II,
    AcademicRank.LECTURER_I,
    AcademicRank.SENIOR_LECTURER,
    AcademicRank.ASSOCIATE_PROFESSOR,
    AcademicRank.PROFESSOR
];

export const ACADEMIC_RANK_LABELS: Record<AcademicRank, string> = {
    ASSISTANT_LECTURER: 'Assistant Lecturer',
    LECTURER_II: 'Lecturer II',
    LECTURER_I: 'Lecturer I',
    SENIOR_LECTURER: 'Senior Lecturer',
    ASSOCIATE_PROFESSOR: 'Associate Professor (Reader)',
    PROFESSOR: 'Professor (Chair)'
};

export const ACADEMIC_PROMOTION_RULES: Record<AcademicRank, AcademicPromotionCriteria> = {
    [AcademicRank.ASSISTANT_LECTURER]: {
        currentRank: AcademicRank.ASSISTANT_LECTURER,
        targetRank: AcademicRank.LECTURER_II,
        targetRankLabel: 'Lecturer II',
        minQualification: HighestQualification.MASTERS,
        allowBachelorsWithPhdRegistration: true,
        minPublicationPoints: 6.0,
        eligibleOutputCategories: [
            PublicationType.JOURNAL_ARTICLE,
            PublicationType.CONFERENCE_PROCEEDING,
            PublicationType.COURSE_MATERIAL
        ],
        categoryConstraints: {
            [PublicationType.COURSE_MATERIAL]: { maxUnits: 2 }
        },
        requiresExternalAssessment: false,
        governanceGateDescription: "Internal Faculty & A&PC vetting. Master's or Bachelor's with evidence of Ph.D. registration."
    },
    [AcademicRank.LECTURER_II]: {
        currentRank: AcademicRank.LECTURER_II,
        targetRank: AcademicRank.LECTURER_I,
        targetRankLabel: 'Lecturer I',
        minQualification: HighestQualification.MASTERS,
        allowBachelorsWithPhdRegistration: true,
        minPublicationPoints: 12.0,
        eligibleOutputCategories: [
            PublicationType.JOURNAL_ARTICLE,
            PublicationType.CONFERENCE_PROCEEDING,
            PublicationType.COURSE_MATERIAL
        ],
        categoryConstraints: {
            [PublicationType.COURSE_MATERIAL]: { maxUnits: 2 }
        },
        requiresExternalAssessment: false,
        governanceGateDescription: "Internal Faculty & A&PC vetting. Master's or Bachelor's with evidence of Ph.D. registration."
    },
    [AcademicRank.LECTURER_I]: {
        currentRank: AcademicRank.LECTURER_I,
        targetRank: AcademicRank.SENIOR_LECTURER,
        targetRankLabel: 'Senior Lecturer',
        minQualification: HighestQualification.PHD,
        allowBachelorsWithPhdRegistration: false,
        minPublicationPoints: 24.0,
        eligibleOutputCategories: [
            PublicationType.JOURNAL_ARTICLE,
            PublicationType.CONFERENCE_PROCEEDING
        ],
        categoryConstraints: {
            [PublicationType.COURSE_MATERIAL]: { excluded: true, maxUnits: 0 }
        },
        requiresExternalAssessment: false,
        governanceGateDescription: 'Ph.D. mandatory. Course materials excluded from minimum eligibility scoring.'
    },
    [AcademicRank.SENIOR_LECTURER]: {
        currentRank: AcademicRank.SENIOR_LECTURER,
        targetRank: AcademicRank.ASSOCIATE_PROFESSOR,
        targetRankLabel: 'Associate Professor (Reader)',
        minQualification: HighestQualification.PHD,
        allowBachelorsWithPhdRegistration: false,
        minPublicationPoints: 42.0,
        eligibleOutputCategories: [
            PublicationType.JOURNAL_ARTICLE,
            PublicationType.CONFERENCE_PROCEEDING,
            PublicationType.ACADEMIC_BOOK,
            PublicationType.BOOK_CHAPTER
        ],
        categoryConstraints: {
            [PublicationType.COURSE_MATERIAL]: { excluded: true, maxUnits: 0 }
        },
        requiresExternalAssessment: true,
        governanceGateDescription: 'Ph.D. mandatory. Requires external assessor report clearing before final Council ratification.'
    },
    [AcademicRank.ASSOCIATE_PROFESSOR]: {
        currentRank: AcademicRank.ASSOCIATE_PROFESSOR,
        targetRank: AcademicRank.PROFESSOR,
        targetRankLabel: 'Professor (Chair)',
        minQualification: HighestQualification.PHD,
        allowBachelorsWithPhdRegistration: false,
        minPublicationPoints: 66.0,
        eligibleOutputCategories: [
            PublicationType.JOURNAL_ARTICLE,
            PublicationType.CONFERENCE_PROCEEDING,
            PublicationType.ACADEMIC_BOOK,
            PublicationType.BOOK_CHAPTER
        ],
        categoryConstraints: {
            [PublicationType.COURSE_MATERIAL]: { excluded: true, maxUnits: 0 }
        },
        requiresExternalAssessment: true,
        governanceGateDescription: 'Ph.D. mandatory. Cumulative 66+ points, external assessor clearance, and positive Senate/Council recommendation.'
    },
    [AcademicRank.PROFESSOR]: {
        currentRank: AcademicRank.PROFESSOR,
        targetRank: AcademicRank.PROFESSOR,
        targetRankLabel: 'Professor (Distinguished / Senior Chair)',
        minQualification: HighestQualification.PHD,
        allowBachelorsWithPhdRegistration: false,
        minPublicationPoints: 66.0,
        eligibleOutputCategories: [
            PublicationType.JOURNAL_ARTICLE,
            PublicationType.CONFERENCE_PROCEEDING,
            PublicationType.ACADEMIC_BOOK,
            PublicationType.BOOK_CHAPTER
        ],
        categoryConstraints: {},
        requiresExternalAssessment: false,
        governanceGateDescription: 'Highest substantive academic rank reached.'
    }
};

/**
 * Normalizes input string to canonical AcademicRank enum
 */
export function normalizeToAcademicRank(rankStr?: string | null): AcademicRank | null {
    if (!rankStr) return null;
    const clean = rankStr.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z_]/g, '');

    if (clean.includes('PROFESSOR') && !clean.includes('ASSOCIATE') && !clean.includes('READER')) {
        return AcademicRank.PROFESSOR;
    }
    if (clean.includes('ASSOCIATE') || clean.includes('READER')) {
        return AcademicRank.ASSOCIATE_PROFESSOR;
    }
    if (clean.includes('SENIOR_LECTURER') || clean === 'SENIOR_LECTURER') {
        return AcademicRank.SENIOR_LECTURER;
    }
    if (clean === 'LECTURER_I' || clean === 'LECTURER_1' || clean === 'LECTURER1') {
        return AcademicRank.LECTURER_I;
    }
    if (clean === 'LECTURER_II' || clean === 'LECTURER_2' || clean === 'LECTURER2') {
        return AcademicRank.LECTURER_II;
    }
    if (clean.includes('ASSISTANT_LECTURER') || clean === 'ASST_LECTURER') {
        return AcademicRank.ASSISTANT_LECTURER;
    }

    if (Object.values(AcademicRank).includes(clean as AcademicRank)) {
        return clean as AcademicRank;
    }

    return null;
}

/**
 * Normalizes qualification string to canonical HighestQualification
 */
export function normalizeToHighestQualification(qualStr?: string | null): HighestQualification {
    if (!qualStr) return HighestQualification.BACHELORS;
    const clean = qualStr.toUpperCase().trim();

    if (clean.includes('PHD') || clean.includes('PH.D') || clean.includes('DOCTORATE') || clean.includes('D.PHIL')) {
        return HighestQualification.PHD;
    }
    if (clean.includes('MSC') || clean.includes('M.SC') || clean.includes('MASTERS') || clean.includes('M.A') || clean.includes('M.ED') || clean.includes('MPHIL') || clean.includes('M.PHIL')) {
        return HighestQualification.MASTERS;
    }
    return HighestQualification.BACHELORS;
}

/**
 * Retrieves the target promotion rank for a given current rank
 */
export function getTargetAcademicRank(currentRank: AcademicRank): AcademicRank {
    const idx = ACADEMIC_RANK_ORDER.indexOf(currentRank);
    if (idx >= 0 && idx < ACADEMIC_RANK_ORDER.length - 1) {
        return ACADEMIC_RANK_ORDER[idx + 1];
    }
    return AcademicRank.PROFESSOR;
}

export interface PublicationScoringInput {
    id: string;
    title: string;
    type: PublicationType;
    peerReviewed: boolean;
    pointsClaimed: number;
    pointsAwarded?: number | null;
    verificationStatus: string;
}

export interface ScoredPublicationResult {
    publicationId: string;
    title: string;
    type: PublicationType;
    rawPoints: number;
    appliedPoints: number;
    eligible: boolean;
    exclusionReason?: string;
}

export interface PublicationScoringBreakdown {
    totalValidPoints: number;
    totalRawPoints: number;
    requiredPoints: number;
    pointsRequirementMet: boolean;
    pointsDeficit: number;
    courseMaterialsCount: number;
    courseMaterialsCapped: boolean;
    scoredPublications: ScoredPublicationResult[];
    categoryTotals: Record<PublicationType, number>;
}

/**
 * Evaluates publication points for academic promotion based on statutory category constraints and caps.
 */
export function calculateAcademicPublicationScores(
    publications: PublicationScoringInput[],
    targetRank: AcademicRank,
    onlyVerified: boolean = true
): PublicationScoringBreakdown {
    const rule = Object.values(ACADEMIC_PROMOTION_RULES).find(r => r.targetRank === targetRank) || ACADEMIC_PROMOTION_RULES[AcademicRank.ASSISTANT_LECTURER];
    
    let totalValidPoints = 0;
    let totalRawPoints = 0;
    let courseMaterialsUtilized = 0;
    let courseMaterialsCapped = false;

    const scoredPublications: ScoredPublicationResult[] = [];
    const categoryTotals: Record<PublicationType, number> = {
        [PublicationType.JOURNAL_ARTICLE]: 0,
        [PublicationType.CONFERENCE_PROCEEDING]: 0,
        [PublicationType.COURSE_MATERIAL]: 0,
        [PublicationType.ACADEMIC_BOOK]: 0,
        [PublicationType.BOOK_CHAPTER]: 0
    };

    const courseMaterialConstraint = rule.categoryConstraints[PublicationType.COURSE_MATERIAL];
    const maxCourseMaterials = courseMaterialConstraint?.maxUnits !== undefined ? courseMaterialConstraint.maxUnits : 0;
    const isCourseMaterialExcluded = !!courseMaterialConstraint?.excluded;

    for (const pub of publications) {
        const isVerified = pub.verificationStatus === 'VERIFIED';
        if (onlyVerified && !isVerified) {
            scoredPublications.push({
                publicationId: pub.id,
                title: pub.title,
                type: pub.type,
                rawPoints: Number(pub.pointsAwarded || pub.pointsClaimed || 0),
                appliedPoints: 0,
                eligible: false,
                exclusionReason: `Pending committee verification (Status: ${pub.verificationStatus})`
            });
            continue;
        }

        if (!pub.peerReviewed) {
            scoredPublications.push({
                publicationId: pub.id,
                title: pub.title,
                type: pub.type,
                rawPoints: Number(pub.pointsAwarded || pub.pointsClaimed || 0),
                appliedPoints: 0,
                eligible: false,
                exclusionReason: 'Not peer-reviewed'
            });
            continue;
        }

        const rawPoints = Number(pub.pointsAwarded && Number(pub.pointsAwarded) > 0 
            ? pub.pointsAwarded 
            : (pub.pointsClaimed || PUBLICATION_DEFAULT_POINTS[pub.type] || 0));

        totalRawPoints += rawPoints;

        // Check if category is eligible for target rank
        if (!rule.eligibleOutputCategories.includes(pub.type)) {
            scoredPublications.push({
                publicationId: pub.id,
                title: pub.title,
                type: pub.type,
                rawPoints,
                appliedPoints: 0,
                eligible: false,
                exclusionReason: `Category ${pub.type} is ineligible for promotion to ${rule.targetRankLabel}`
            });
            continue;
        }

        // Apply Course Material Specific Constraints
        if (pub.type === PublicationType.COURSE_MATERIAL) {
            if (isCourseMaterialExcluded || maxCourseMaterials === 0) {
                scoredPublications.push({
                    publicationId: pub.id,
                    title: pub.title,
                    type: pub.type,
                    rawPoints,
                    appliedPoints: 0,
                    eligible: false,
                    exclusionReason: `Course Materials are excluded from minimum eligibility scoring for ${rule.targetRankLabel}`
                });
                continue;
            }

            if (courseMaterialsUtilized >= maxCourseMaterials) {
                courseMaterialsCapped = true;
                scoredPublications.push({
                    publicationId: pub.id,
                    title: pub.title,
                    type: pub.type,
                    rawPoints,
                    appliedPoints: 0,
                    eligible: false,
                    exclusionReason: `Maximum Course Material quota (${maxCourseMaterials} units) already reached`
                });
                continue;
            }

            courseMaterialsUtilized += 1;
        }

        // Publication passes all gates
        totalValidPoints += rawPoints;
        categoryTotals[pub.type] = (categoryTotals[pub.type] || 0) + rawPoints;

        scoredPublications.push({
            publicationId: pub.id,
            title: pub.title,
            type: pub.type,
            rawPoints,
            appliedPoints: rawPoints,
            eligible: true
        });
    }

    const pointsRequirementMet = totalValidPoints >= rule.minPublicationPoints;
    const pointsDeficit = Math.max(0, parseFloat((rule.minPublicationPoints - totalValidPoints).toFixed(2)));

    return {
        totalValidPoints: parseFloat(totalValidPoints.toFixed(2)),
        totalRawPoints: parseFloat(totalRawPoints.toFixed(2)),
        requiredPoints: rule.minPublicationPoints,
        pointsRequirementMet,
        pointsDeficit,
        courseMaterialsCount: courseMaterialsUtilized,
        courseMaterialsCapped,
        scoredPublications,
        categoryTotals
    };
}
