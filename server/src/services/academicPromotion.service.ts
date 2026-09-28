import prisma from '../prisma';
import {
    PublicationType,
    PublicationVerificationStatus,
    PromotionEligibilityStatus
} from '@prisma/client';
import {
    AcademicRank,
    HighestQualification,
    ACADEMIC_PROMOTION_RULES,
    ACADEMIC_RANK_LABELS,
    normalizeToAcademicRank,
    normalizeToHighestQualification,
    getTargetAcademicRank,
    calculateAcademicPublicationScores,
    PublicationScoringBreakdown,
    AcademicPromotionCriteria
} from '../utils/academicPromotionRules';
import { calculatePromotionMaturity } from '../utils/promotionCalculator';

export interface AcademicEvaluationGateResult {
    passed: boolean;
    title: string;
    details: string;
    required: string;
    actual: string;
    isBlocker: boolean;
}

export interface AcademicPromotionEvaluationResult {
    staffId: string;
    staffName: string;
    staffIdNumber: string;
    currentRank: AcademicRank;
    currentRankLabel: string;
    targetRank: AcademicRank;
    targetRankLabel: string;
    rule: AcademicPromotionCriteria;
    highestQualification: HighestQualification;
    phdGraduationDate?: Date | null;
    phdRegistrationProofUrl?: string | null;
    phdRegistrationVerified: boolean;
    qualificationGate: AcademicEvaluationGateResult;
    publicationScoringGate: AcademicEvaluationGateResult;
    tenureGate: AcademicEvaluationGateResult;
    disciplinaryGate: AcademicEvaluationGateResult;
    overallEligible: boolean;
    suggestedStatus: PromotionEligibilityStatus;
    passedGatesCount: number;
    totalGatesCount: number;
    deficits: string[];
    checklist: string[];
    publicationBreakdown: PublicationScoringBreakdown;
    draftPublicationBreakdown: PublicationScoringBreakdown;
}

export interface VetPublicationParams {
    publicationId: string;
    actorId: string;
    pointsAwarded: number;
    verificationStatus: PublicationVerificationStatus;
    vettingRemarks?: string;
}

export class AcademicPromotionService {
    /**
     * Evaluates full statutory promotion eligibility for an academic staff member.
     */
    static async evaluateAcademicPromotion(
        staffId: string,
        overrideCurrentRank?: AcademicRank | string,
        overrideTargetRank?: AcademicRank | string
    ): Promise<AcademicPromotionEvaluationResult> {
        const staff = await prisma.staffProfile.findUnique({
            where: { id: staffId },
            include: {
                user: { select: { id: true, name: true, email: true, role: true } },
                unit: { select: { id: true, name: true, type: true } },
                academicPublications: {
                    orderBy: { publicationDate: 'desc' }
                },
                queries: {
                    where: {
                        OR: [
                            { source: 'REGISTRY', resolutionStatus: { in: ['PENDING', 'UNSATISFACTORY'] } },
                            { status: { in: ['OPEN', 'DEFAULTED_UNANSWERED'] } }
                        ]
                    }
                }
            }
        });

        if (!staff) {
            throw new Error(`Staff profile '${staffId}' not found.`);
        }

        // Determine current rank
        const rawRank = overrideCurrentRank || staff.currentAcademicRank || staff.rank || staff.currentGradeLevel;
        const currentRank = normalizeToAcademicRank(rawRank) || AcademicRank.ASSISTANT_LECTURER;
        
        // Determine target rank
        const targetRank = overrideTargetRank
            ? (normalizeToAcademicRank(overrideTargetRank) || getTargetAcademicRank(currentRank))
            : (normalizeToAcademicRank(staff.targetPromotionRank) || getTargetAcademicRank(currentRank));

        const rule = ACADEMIC_PROMOTION_RULES[currentRank] || ACADEMIC_PROMOTION_RULES[AcademicRank.ASSISTANT_LECTURER];

        // 1. Qualification Gate
        const highestQual = normalizeToHighestQualification(staff.highestQualification);
        const hasPhdRegistrationProof = !!staff.phdRegistrationProofUrl;
        
        let qualificationPassed = false;
        let qualificationDetails = '';

        if (rule.minQualification === HighestQualification.PHD) {
            qualificationPassed = highestQual === HighestQualification.PHD;
            qualificationDetails = qualificationPassed
                ? 'Candidate possesses a verified Ph.D. Degree.'
                : `Ph.D. Degree is mandatory for promotion to ${rule.targetRankLabel}. Current: ${highestQual}.`;
        } else if (rule.minQualification === HighestQualification.MASTERS) {
            if (highestQual === HighestQualification.PHD || highestQual === HighestQualification.MASTERS) {
                qualificationPassed = true;
                qualificationDetails = `Candidate satisfies minimum qualification criteria with ${highestQual} Degree.`;
            } else if (rule.allowBachelorsWithPhdRegistration && highestQual === HighestQualification.BACHELORS && hasPhdRegistrationProof) {
                qualificationPassed = true;
                qualificationDetails = "Candidate holds a Bachelor's Degree with verified evidence of Ph.D. registration.";
            } else {
                qualificationPassed = false;
                qualificationDetails = "Minimum Master's Degree or Bachelor's with verified Ph.D. registration required.";
            }
        } else {
            qualificationPassed = true;
            qualificationDetails = 'Educational qualification requirement satisfied.';
        }

        const qualificationGate: AcademicEvaluationGateResult = {
            passed: qualificationPassed,
            title: 'Educational Qualification Gate',
            details: qualificationDetails,
            required: rule.minQualification === HighestQualification.PHD ? 'Ph.D. Degree (Mandatory)' : "Master's Degree OR Ph.D. Registration",
            actual: highestQual + (hasPhdRegistrationProof ? ' (+ Ph.D. Reg Proof)' : ''),
            isBlocker: true
        };

        // 2. Publication Scoring Gate
        const publicationInputs = staff.academicPublications.map(p => ({
            id: p.id,
            title: p.title,
            type: p.type,
            peerReviewed: p.peerReviewed,
            pointsClaimed: p.pointsClaimed,
            pointsAwarded: p.pointsAwarded,
            verificationStatus: p.verificationStatus
        }));

        const verifiedBreakdown = calculateAcademicPublicationScores(publicationInputs, targetRank, true);
        const draftBreakdown = calculateAcademicPublicationScores(publicationInputs, targetRank, false);

        const publicationPassed = verifiedBreakdown.pointsRequirementMet;
        const courseCapNote = verifiedBreakdown.courseMaterialsCapped ? ' (Course Materials capped at max limit)' : '';

        const publicationScoringGate: AcademicEvaluationGateResult = {
            passed: publicationPassed,
            title: 'Research Output & Publications Scoring Gate',
            details: publicationPassed
                ? `Accrued ${verifiedBreakdown.totalValidPoints} verified points against ${rule.minPublicationPoints} required points.`
                : `Deficit of ${verifiedBreakdown.pointsDeficit} points. Verified points: ${verifiedBreakdown.totalValidPoints} / ${rule.minPublicationPoints} required${courseCapNote}.`,
            required: `${rule.minPublicationPoints}.0 Points`,
            actual: `${verifiedBreakdown.totalValidPoints}.0 Points (Verified)`,
            isBlocker: true
        };

        // 3. Statutory Tenure / Maturity Gate
        const effectiveLastPromo = staff.lastPromotionDate || staff.dateOfLastPromotion || staff.createdAt;
        const tenureResult = calculatePromotionMaturity(effectiveLastPromo, 'ACADEMIC', staff.currentGradeLevel);
        const currentYear = new Date().getFullYear();
        const tenureMatured = (staff.nextPromotionDueYear || tenureResult.nextDueYear) <= currentYear;

        const tenureGate: AcademicEvaluationGateResult = {
            passed: tenureMatured,
            title: 'Statutory 3-Year Waiting Tenure Gate',
            details: tenureMatured
                ? `Maturity cycle reached in ${staff.nextPromotionDueYear || tenureResult.nextDueYear} (Effective: 1st October).`
                : `Statutory 3-year waiting tenure pending. Due cycle: ${staff.nextPromotionDueYear || tenureResult.nextDueYear}.`,
            required: `October 1st, ${staff.nextPromotionDueYear || tenureResult.nextDueYear}`,
            actual: `Last Promotion: ${effectiveLastPromo ? new Date(effectiveLastPromo).toLocaleDateString() : 'N/A'}`,
            isBlocker: false
        };

        // 4. Registry Disciplinary Integrity Gate
        const hasUnresolvedDisciplinary = staff.hasActiveDisciplinaryBlock || staff.queries.length > 0;
        const disciplinaryGate: AcademicEvaluationGateResult = {
            passed: !hasUnresolvedDisciplinary,
            title: 'Registry Disciplinary Integrity Gate',
            details: hasUnresolvedDisciplinary
                ? `Disciplinary Block Active: ${staff.disciplinaryBlockReason || 'Unresolved Registry Queries on staff folio'}.`
                : 'No active queries or disciplinary holds on folio.',
            required: 'Clean Registry Folio (No Unresolved Queries)',
            actual: hasUnresolvedDisciplinary ? 'DISCIPLINARY HOLD' : 'CLEAR',
            isBlocker: true
        };

        // Composite Verdict
        const deficits: string[] = [];
        const checklist: string[] = [];

        if (qualificationGate.passed) {
            checklist.push(`✓ Educational Qualification: ${qualificationGate.actual}`);
        } else {
            deficits.push(`Qualification Requirement: ${qualificationGate.details}`);
        }

        if (publicationScoringGate.passed) {
            checklist.push(`✓ Publication Scoring: ${verifiedBreakdown.totalValidPoints} / ${rule.minPublicationPoints} Points`);
        } else {
            deficits.push(`Publication Points Deficit: Needs ${verifiedBreakdown.pointsDeficit} more verified publication points`);
        }

        if (tenureGate.passed) {
            checklist.push(`✓ Statutory Tenure: Matured (${staff.nextPromotionDueYear || tenureResult.nextDueYear})`);
        } else {
            deficits.push(`Tenure Pending: Due in year ${staff.nextPromotionDueYear || tenureResult.nextDueYear}`);
        }

        if (disciplinaryGate.passed) {
            checklist.push('✓ Disciplinary Clearance: Clean folio');
        } else {
            deficits.push(`Disciplinary Gate: ${disciplinaryGate.details}`);
        }

        const overallEligible = qualificationGate.passed && publicationScoringGate.passed && disciplinaryGate.passed;

        let suggestedStatus: PromotionEligibilityStatus = PromotionEligibilityStatus.PENDING_MATURITY;
        if (hasUnresolvedDisciplinary) {
            suggestedStatus = PromotionEligibilityStatus.DISQUALIFIED_DISCIPLINARY;
        } else if (overallEligible) {
            suggestedStatus = PromotionEligibilityStatus.DUE_FOR_REVIEW;
        }

        const gates = [qualificationGate, publicationScoringGate, tenureGate, disciplinaryGate];
        const passedGatesCount = gates.filter(g => g.passed).length;

        const staffName = staff.user.name || `${staff.surname || ''} ${staff.otherNames || ''}`.trim() || 'Academic Staff';

        return {
            staffId: staff.id,
            staffName,
            staffIdNumber: staff.staffId || 'N/A',
            currentRank,
            currentRankLabel: ACADEMIC_RANK_LABELS[currentRank] || currentRank,
            targetRank,
            targetRankLabel: rule.targetRankLabel,
            rule,
            highestQualification: highestQual,
            phdGraduationDate: staff.phdGraduationDate,
            phdRegistrationProofUrl: staff.phdRegistrationProofUrl,
            phdRegistrationVerified: hasPhdRegistrationProof,
            qualificationGate,
            publicationScoringGate,
            tenureGate,
            disciplinaryGate,
            overallEligible,
            suggestedStatus,
            passedGatesCount,
            totalGatesCount: gates.length,
            deficits,
            checklist,
            publicationBreakdown: verifiedBreakdown,
            draftPublicationBreakdown: draftBreakdown
        };
    }

    /**
     * Vets and scores an individual publication submitted by an academic staff.
     */
    static async vetPublication(params: VetPublicationParams) {
        const { publicationId, actorId, pointsAwarded, verificationStatus, vettingRemarks } = params;

        const publication = await prisma.academicPublication.findUnique({
            where: { id: publicationId },
            include: { staff: true }
        });

        if (!publication) {
            throw new Error(`Publication '${publicationId}' not found.`);
        }

        const vetted = await prisma.academicPublication.update({
            where: { id: publicationId },
            data: {
                pointsAwarded: Number(pointsAwarded),
                verificationStatus,
                vettedById: actorId,
                vettedAt: new Date(),
                vettingRemarks: vettingRemarks || null
            }
        });

        // Recalculate total verified publication points for the staff profile
        const allVerifiedPubs = await prisma.academicPublication.findMany({
            where: {
                staffId: publication.staffId,
                verificationStatus: PublicationVerificationStatus.VERIFIED,
                peerReviewed: true
            }
        });

        const totalVerified = allVerifiedPubs.reduce((sum, p) => sum + (Number(p.pointsAwarded) || Number(p.pointsClaimed) || 0), 0);

        await prisma.staffProfile.update({
            where: { id: publication.staffId },
            data: {
                totalVerifiedPublicationPoints: parseFloat(totalVerified.toFixed(2))
            }
        });

        return vetted;
    }

    /**
     * Retrieves the complete academic appraisal dossier for a staff member.
     */
    static async getStaffAcademicDossier(staffId: string) {
        const staff = await prisma.staffProfile.findUnique({
            where: { id: staffId },
            include: {
                user: { select: { id: true, name: true, email: true, role: true } },
                unit: { select: { id: true, name: true, code: true } },
                academicPublications: {
                    include: {
                        vettedBy: { select: { id: true, name: true, email: true } }
                    },
                    orderBy: { publicationDate: 'desc' }
                }
            }
        });

        if (!staff) {
            throw new Error(`Staff '${staffId}' not found.`);
        }

        const evaluation = await this.evaluateAcademicPromotion(staffId);

        return {
            staff,
            evaluation,
            publications: staff.academicPublications,
            totalPublicationsCount: staff.academicPublications.length,
            verifiedPublicationsCount: staff.academicPublications.filter(p => p.verificationStatus === 'VERIFIED').length
        };
    }
}
