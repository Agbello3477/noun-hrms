import prisma from '../prisma';
import { Cadre, CadreType, PromotionEligibilityStatus, Role } from '@prisma/client';
import { calculatePromotionMaturity } from '../utils/promotionCalculator';
import { sendPromotionNotificationEmail } from './email.service';
import { sendPushNotification } from './fcm.service';

export function normalizeToCadreType(cadre?: string | null): CadreType | null {
    if (!cadre) return null;
    const c = cadre.toUpperCase().trim();
    if (c === 'ACADEMIC') return CadreType.ACADEMIC;
    if (c === 'SENIOR_ADMIN' || c === 'ADMINISTRATIVE' || c === 'SENIOR' || c === 'NON_ACADEMIC') return CadreType.SENIOR_ADMIN;
    if (c === 'JUNIOR_STAFF' || c === 'JUNIOR') return CadreType.JUNIOR_STAFF;
    if (c === 'TECHNICAL') return CadreType.TECHNICAL;
    if (c === 'MEDICAL') return CadreType.MEDICAL;
    if (c === 'SECURITY') return CadreType.SECURITY;
    if (Object.values(CadreType).includes(c as CadreType)) return c as CadreType;
    return null;
}

export function normalizeToCadre(cadre?: string | null): Cadre | null {
    if (!cadre) return null;
    const c = cadre.toUpperCase().trim();
    if (c === 'ACADEMIC') return Cadre.ACADEMIC;
    if (c === 'SENIOR_ADMIN' || c === 'ADMINISTRATIVE' || c === 'SENIOR' || c === 'NON_ACADEMIC') return Cadre.ADMINISTRATIVE;
    if (c === 'JUNIOR_STAFF' || c === 'JUNIOR') return Cadre.JUNIOR;
    if (c === 'TECHNICAL') return Cadre.TECHNICAL;
    if (c === 'MEDICAL') return Cadre.MEDICAL;
    if (c === 'SECURITY') return Cadre.SECURITY;
    if (Object.values(Cadre).includes(c as Cadre)) return c as Cadre;
    return null;
}

export interface UpdateScheduleParams {
    staffProfileId: string;
    actorId: string;
    actorRole?: string;
    lastPromotionDate?: Date | string | null;
    cadreType?: CadreType | string | null;
    currentGradeLevel?: string | null;
    nextDueYear?: number | null;
    nextPromotionDueYear?: number | null;
    nextDueDate?: Date | string | null;
    nextPromotionDueDate?: Date | string | null;
    eligibilityStatus?: PromotionEligibilityStatus | string | null;
    promotionEligibilityStatus?: PromotionEligibilityStatus | string | null;
    registryOverride?: boolean;
    overrideReason?: string | null;
    isDueImmediately?: boolean;
}

export interface PromotionFilterParams {
    year?: number;
    cadre?: string;
    status?: string;
    tab?: 'DUE_THIS_CYCLE' | 'MATURED_OVERDUE' | 'UPCOMING' | 'ALL' | string;
    search?: string;
    page?: number;
    limit?: number;
}

export class PromotionService {
    /**
     * Updates or overrides a staff member's promotion maturity schedule and records an immutable audit log.
     * Integrates Disciplinary Integrity Gate and Maker-Checker for Promotion Overrides.
     */
    static async updateStaffPromotionSchedule(params: UpdateScheduleParams) {
        const {
            staffProfileId,
            actorId,
            actorRole,
            lastPromotionDate,
            cadreType,
            currentGradeLevel,
            nextDueYear,
            nextPromotionDueYear,
            nextDueDate,
            nextPromotionDueDate,
            eligibilityStatus,
            promotionEligibilityStatus,
            registryOverride,
            overrideReason,
            isDueImmediately
        } = params;

        const profile = await prisma.staffProfile.findUnique({
            where: { id: staffProfileId },
            include: {
                user: { select: { id: true, email: true, name: true, role: true } },
                unit: { select: { name: true } },
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

        if (!profile) {
            throw new Error('Staff profile not found');
        }

        // 1. Disciplinary Integrity Gate
        const hasDisciplinaryHold = Boolean(profile.hasActiveDisciplinaryBlock || (profile.queries && profile.queries.length > 0));
        if (hasDisciplinaryHold && (isDueImmediately || eligibilityStatus === PromotionEligibilityStatus.DUE_FOR_REVIEW || eligibilityStatus === PromotionEligibilityStatus.APPROVED)) {
            throw new Error(`Cannot clear or approve promotion: Staff candidate is blocked due to unresolved disciplinary matter (${profile.disciplinaryBlockReason || 'Open Registry Query'}).`);
        }

        const effectiveDueYearInput = nextPromotionDueYear !== undefined && nextPromotionDueYear !== null ? nextPromotionDueYear : nextDueYear;
        const isManualOverride = registryOverride === true || (effectiveDueYearInput !== undefined && effectiveDueYearInput !== null && effectiveDueYearInput !== profile.nextPromotionDueYear && effectiveDueYearInput !== profile.nextDueYear);

        if (isManualOverride) {
            if (!overrideReason || overrideReason.trim().length < 5) {
                throw new Error('A valid administrative override justification (minimum 5 characters) is required when modifying promotion schedules.');
            }
        }

        const effectiveLastPromo = lastPromotionDate !== undefined
            ? (lastPromotionDate ? new Date(lastPromotionDate) : null)
            : (profile.lastPromotionDate || profile.dateOfLastPromotion || null);

        const effectiveCadreType = normalizeToCadreType(cadreType) || normalizeToCadreType(profile.cadreType) || normalizeToCadreType(profile.cadre) || null;
        const effectiveCadre = normalizeToCadre(cadreType) || normalizeToCadre(profile.cadreType) || normalizeToCadre(profile.cadre) || null;
        const effectiveLevel = currentGradeLevel !== undefined ? currentGradeLevel : (profile.currentGradeLevel || profile.level);

        const computed = calculatePromotionMaturity(effectiveLastPromo, effectiveCadreType, effectiveLevel);

        const computedDueYear = effectiveDueYearInput !== undefined && effectiveDueYearInput !== null
            ? Number(effectiveDueYearInput)
            : (profile.nextPromotionDueYear || profile.nextDueYear || computed.nextDueYear);

        const effectiveDueDateInput = nextPromotionDueDate !== undefined && nextPromotionDueDate !== null ? nextPromotionDueDate : nextDueDate;
        const computedDueDate = effectiveDueDateInput !== undefined && effectiveDueDateInput !== null
            ? new Date(effectiveDueDateInput)
            : (profile.nextPromotionDueDate || profile.nextDueDate || computed.nextDueDate);

        let effectiveStatus = (promotionEligibilityStatus as PromotionEligibilityStatus)
            || (eligibilityStatus as PromotionEligibilityStatus)
            || profile.promotionEligibilityStatus
            || profile.eligibilityStatus
            || PromotionEligibilityStatus.PENDING_MATURITY;

        if (isDueImmediately) {
            effectiveStatus = PromotionEligibilityStatus.DUE_FOR_REVIEW;
        }

        if (hasDisciplinaryHold) {
            effectiveStatus = PromotionEligibilityStatus.DISQUALIFIED_DISCIPLINARY;
        }

        const isRegistrarOrSuper = actorRole === Role.REGISTRAR || actorRole === Role.SUPER_USER || actorRole === Role.VICE_CHANCELLOR;
        const requiresRegistrarClearance = isManualOverride && !isRegistrarOrSuper;

        const prevDueYear = profile.nextPromotionDueYear || profile.nextDueYear;
        const prevStatus = profile.promotionEligibilityStatus || profile.eligibilityStatus;

        // Execute transaction: update profile + append audit log
        const [updatedProfile, auditLog] = await prisma.$transaction(async (tx) => {
            const updatePayload: any = {
                lastPromotionDate: effectiveLastPromo,
                dateOfLastPromotion: effectiveLastPromo,
                cadreType: effectiveCadreType,
                cadre: effectiveCadre,
                currentGradeLevel: effectiveLevel,
                legacyDataBackfilled: true
            };

            if (requiresRegistrarClearance) {
                // Stage override for Registrar review
                updatePayload.promotionOverrideStatus = 'PENDING_REGISTRAR_OVERRIDE';
                updatePayload.requestedPromotionDueYear = computedDueYear;
                updatePayload.promotionOverrideJustification = overrideReason?.trim();
                updatePayload.promotionOverrideRequestedById = actorId;
                updatePayload.promotionOverrideRequestedAt = new Date();
                updatePayload.promotionEligibilityStatus = PromotionEligibilityStatus.PENDING_REGISTRAR_OVERRIDE;
                updatePayload.eligibilityStatus = PromotionEligibilityStatus.PENDING_REGISTRAR_OVERRIDE;
            } else {
                // Apply directly (Registrar or Standard Cadre Calculation)
                updatePayload.nextDueYear = computedDueYear;
                updatePayload.nextPromotionDueYear = computedDueYear;
                updatePayload.nextDueDate = computedDueDate;
                updatePayload.nextPromotionDueDate = computedDueDate;
                updatePayload.eligibilityStatus = effectiveStatus;
                updatePayload.promotionEligibilityStatus = effectiveStatus;
                updatePayload.registryOverride = isManualOverride;
                updatePayload.overrideReason = isManualOverride ? overrideReason?.trim() : profile.overrideReason;
                updatePayload.isDueForPromotion = isDueImmediately || effectiveStatus === PromotionEligibilityStatus.DUE_FOR_REVIEW || effectiveStatus === PromotionEligibilityStatus.UNDER_EVALUATION;
                if (isManualOverride && isRegistrarOrSuper) {
                    updatePayload.promotionOverrideStatus = 'APPROVED';
                    updatePayload.promotionOverrideApprovedById = actorId;
                    updatePayload.promotionOverrideApprovedAt = new Date();
                }
            }

            const updated = await tx.staffProfile.update({
                where: { id: staffProfileId },
                data: updatePayload,
                include: {
                    user: { select: { id: true, email: true, name: true, role: true } },
                    unit: { select: { name: true } },
                    studyCenter: { select: { name: true } }
                }
            });

            const log = await tx.promotionAuditLog.create({
                data: {
                    staffProfileId,
                    actorId,
                    action: requiresRegistrarClearance ? 'PENDING_REGISTRAR_OVERRIDE' : (isManualOverride ? 'MANUAL_OVERRIDE' : 'SCHEDULE_CONFIG'),
                    previousDueYear: prevDueYear,
                    newDueYear: computedDueYear,
                    previousStatus: prevStatus,
                    newStatus: updatePayload.eligibilityStatus,
                    reason: overrideReason?.trim() || `Configured schedule based on ${computed.cadreRuleApplied}`,
                    metadata: {
                        intervalYears: computed.intervalYears,
                        cadreRuleApplied: computed.cadreRuleApplied,
                        gradeLevel: effectiveLevel,
                        lastPromotionDate: effectiveLastPromo,
                        requiresRegistrarClearance
                    }
                },
                include: {
                    actor: { select: { id: true, name: true, email: true, role: true } }
                }
            });

            return [updated, log];
        });

        // Notify Registrar if pending clearance
        if (requiresRegistrarClearance) {
            const registrars = await prisma.user.findMany({
                where: { role: { in: [Role.REGISTRAR, Role.SUPER_USER] }, isActive: true },
                select: { id: true }
            });
            const staffName = `${profile.surname || ''} ${profile.otherNames || ''}`.trim() || profile.user?.name || 'Staff';
            for (const r of registrars) {
                await prisma.notification.create({
                    data: {
                        userId: r.id,
                        title: '📑 Promotion Override Awaiting Approval',
                        message: `A promotion due year override to ${computedDueYear} for ${staffName} (${profile.staffId}) requires Registrar authorization.`,
                        type: 'WARNING',
                        link: '/dashboard/registry/due-for-promotion'
                    }
                }).catch(() => {});
            }
        }

        return { profile: updatedProfile, auditLog };
    }

    /**
     * Authorize promotion override (Registrar / Super User).
     */
    static async authorizePromotionOverride(staffProfileId: string, actorId: string, remarks?: string) {
        const profile = await prisma.staffProfile.findUnique({
            where: { id: staffProfileId },
            include: { user: true }
        });

        if (!profile) throw new Error('Staff profile not found');
        if (profile.promotionOverrideStatus !== 'PENDING_REGISTRAR_OVERRIDE') {
            throw new Error('No pending promotion override request for this staff member.');
        }

        const newDueYear = profile.requestedPromotionDueYear || new Date().getFullYear();
        const now = new Date();

        const [updated, auditLog] = await prisma.$transaction(async (tx) => {
            const prof = await tx.staffProfile.update({
                where: { id: staffProfileId },
                data: {
                    nextPromotionDueYear: newDueYear,
                    nextDueYear: newDueYear,
                    promotionOverrideStatus: 'APPROVED',
                    promotionOverrideApprovedById: actorId,
                    promotionOverrideApprovedAt: now,
                    promotionEligibilityStatus: PromotionEligibilityStatus.DUE_FOR_REVIEW,
                    eligibilityStatus: PromotionEligibilityStatus.DUE_FOR_REVIEW,
                    isDueForPromotion: true,
                    registryOverride: true,
                    overrideReason: remarks || profile.promotionOverrideJustification || 'Authorized by Registrar'
                }
            });

            const log = await tx.promotionAuditLog.create({
                data: {
                    staffProfileId,
                    actorId,
                    action: 'REGISTRAR_OVERRIDE_APPROVED',
                    previousDueYear: profile.nextPromotionDueYear,
                    newDueYear,
                    previousStatus: PromotionEligibilityStatus.PENDING_REGISTRAR_OVERRIDE,
                    newStatus: PromotionEligibilityStatus.DUE_FOR_REVIEW,
                    reason: remarks || 'Registrar authorized promotion milestone override.'
                }
            });

            return [prof, log];
        });

        // Notify Staff & Initiator
        if (profile.userId) {
            await prisma.notification.create({
                data: {
                    userId: profile.userId,
                    title: '⭐ Promotion Schedule Authorized',
                    message: `The Registrar has authorized your promotion due milestone for ${newDueYear}.`,
                    type: 'SUCCESS',
                    link: '/dashboard/profile'
                }
            }).catch(() => {});
        }

        return { profile: updated, auditLog };
    }

    /**
     * Reject promotion override (Registrar / Super User).
     */
    static async rejectPromotionOverride(staffProfileId: string, actorId: string, reason?: string) {
        const profile = await prisma.staffProfile.findUnique({
            where: { id: staffProfileId }
        });

        if (!profile) throw new Error('Staff profile not found');

        const now = new Date();

        const [updated, auditLog] = await prisma.$transaction(async (tx) => {
            const prof = await tx.staffProfile.update({
                where: { id: staffProfileId },
                data: {
                    promotionOverrideStatus: 'REJECTED',
                    promotionOverrideApprovedById: actorId,
                    promotionOverrideApprovedAt: now,
                    promotionEligibilityStatus: PromotionEligibilityStatus.PENDING_MATURITY,
                    eligibilityStatus: PromotionEligibilityStatus.PENDING_MATURITY,
                    requestedPromotionDueYear: null
                }
            });

            const log = await tx.promotionAuditLog.create({
                data: {
                    staffProfileId,
                    actorId,
                    action: 'REGISTRAR_OVERRIDE_REJECTED',
                    previousStatus: PromotionEligibilityStatus.PENDING_REGISTRAR_OVERRIDE,
                    newStatus: PromotionEligibilityStatus.PENDING_MATURITY,
                    reason: reason || 'Promotion override rejected by Registrar.'
                }
            });

            return [prof, log];
        });

        return { profile: updated, auditLog };
    }

    /**
     * Retrieves paginated, filtered promotion due list for the Registry console.
     */
    static async getPromotionDueList(params: PromotionFilterParams) {
        const {
            year,
            cadre,
            status,
            tab,
            search = '',
            page = 1,
            limit = 15
        } = params;

        const targetYear = year ? Number(year) : new Date().getFullYear();
        const take = Math.min(Math.max(Number(limit) || 15, 1), 100);
        const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

        const permanentFilter = {
            employmentCategory: 'PERMANENT' as const
        };

        const andConditions: any[] = [permanentFilter];

        const where: any = {
            isDeleted: false,
            status: 'ACTIVE',
            AND: andConditions
        };

        if (tab === 'DUE_THIS_CYCLE') {
            andConditions.push({
                OR: [
                    { nextPromotionDueYear: targetYear },
                    { nextDueYear: targetYear },
                    {
                        AND: [
                            { isDueForPromotion: true },
                            { OR: [{ nextPromotionDueYear: null }, { nextDueYear: null }] }
                        ]
                    }
                ]
            });
        } else if (tab === 'MATURED_OVERDUE') {
            andConditions.push({
                OR: [
                    { nextPromotionDueYear: { lt: targetYear } },
                    { nextDueYear: { lt: targetYear } },
                    { isDueForPromotion: true }
                ]
            });
            where.eligibilityStatus = { in: [PromotionEligibilityStatus.DUE_FOR_REVIEW, PromotionEligibilityStatus.UNDER_EVALUATION, PromotionEligibilityStatus.PENDING_MATURITY] };
        } else if (tab === 'UPCOMING') {
            andConditions.push({
                OR: [
                    { nextPromotionDueYear: { gt: targetYear } },
                    { nextDueYear: { gt: targetYear } }
                ]
            });
        } else if (tab === 'ALL') {
            // All configured
        } else if (year) {
            andConditions.push({
                OR: [
                    { nextPromotionDueYear: targetYear },
                    { nextDueYear: targetYear },
                    {
                        AND: [
                            { OR: [{ nextPromotionDueYear: null }, { nextDueYear: null }] },
                            { isDueForPromotion: true }
                        ]
                    }
                ]
            });
        }

        if (cadre && cadre !== 'ALL') {
            const targetCadreType = normalizeToCadreType(cadre);
            const targetCadre = normalizeToCadre(cadre);

            const orConditions: any[] = [];
            if (targetCadreType) orConditions.push({ cadreType: targetCadreType });
            if (targetCadre) orConditions.push({ cadre: targetCadre });

            if (orConditions.length > 0) {
                where.AND = where.AND || [];
                where.AND.push(orConditions.length === 1 ? orConditions[0] : { OR: orConditions });
            }
        }

        if (status && status !== 'ALL') {
            where.eligibilityStatus = status as PromotionEligibilityStatus;
        }

        if (search.trim()) {
            const q = search.trim();
            const searchClause = {
                OR: [
                    { surname: { contains: q, mode: 'insensitive' } },
                    { otherNames: { contains: q, mode: 'insensitive' } },
                    { staffId: { contains: q, mode: 'insensitive' } },
                    { rank: { contains: q, mode: 'insensitive' } },
                    { user: { name: { contains: q, mode: 'insensitive' } } },
                    { user: { email: { contains: q, mode: 'insensitive' } } },
                    { unit: { name: { contains: q, mode: 'insensitive' } } }
                ]
            };
            if (where.AND) {
                where.AND.push(searchClause);
            } else {
                where.AND = [searchClause];
            }
        }

        const [profiles, total, summaryStats] = await Promise.all([
            prisma.staffProfile.findMany({
                where,
                skip,
                take,
                orderBy: [
                    { nextPromotionDueYear: 'asc' },
                    { nextDueYear: 'asc' },
                    { surname: 'asc' }
                ],
                include: {
                    user: { select: { id: true, email: true, name: true } },
                    unit: { select: { id: true, name: true, headId: true } },
                    studyCenter: { select: { id: true, name: true } },
                    academicPublications: {
                        select: {
                            id: true,
                            title: true,
                            type: true,
                            peerReviewed: true,
                            pointsClaimed: true,
                            pointsAwarded: true,
                            verificationStatus: true,
                            evidenceDocumentUrl: true,
                            doiOrIsbn: true,
                            indexingStatus: true
                        }
                    },
                    queries: {
                        where: { status: { in: ['OPEN', 'DEFAULTED_UNANSWERED'] } },
                        select: { id: true, title: true, status: true, source: true }
                    },
                    promotionAuditLogs: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        include: { actor: { select: { name: true, email: true } } }
                    }
                }
            }),
            prisma.staffProfile.count({ where }),
            prisma.staffProfile.groupBy({
                by: ['eligibilityStatus'],
                where: {
                    isDeleted: false,
                    status: 'ACTIVE',
                    ...(year && tab !== 'ALL' ? {
                        OR: [
                            { nextPromotionDueYear: targetYear },
                            { nextDueYear: targetYear }
                        ]
                    } : {})
                },
                _count: { id: true }
            })
        ]);

        const [dueThisCycleCount, maturedOverdueCount, upcomingCount, allConfiguredCount] = await Promise.all([
            prisma.staffProfile.count({
                where: {
                    isDeleted: false,
                    status: 'ACTIVE',
                    AND: [
                        permanentFilter,
                        {
                            OR: [
                                { nextPromotionDueYear: targetYear },
                                { nextDueYear: targetYear },
                                { isDueForPromotion: true }
                            ]
                        }
                    ]
                }
            }),
            prisma.staffProfile.count({
                where: {
                    isDeleted: false,
                    status: 'ACTIVE',
                    AND: [
                        permanentFilter,
                        {
                            OR: [
                                { nextPromotionDueYear: { lt: targetYear } },
                                { nextDueYear: { lt: targetYear } }
                            ]
                        }
                    ]
                }
            }),
            prisma.staffProfile.count({
                where: {
                    isDeleted: false,
                    status: 'ACTIVE',
                    AND: [
                        permanentFilter,
                        {
                            OR: [
                                { nextPromotionDueYear: { gt: targetYear } },
                                { nextDueYear: { gt: targetYear } }
                            ]
                        }
                    ]
                }
            }),
            prisma.staffProfile.count({
                where: {
                    isDeleted: false,
                    status: 'ACTIVE',
                    AND: [permanentFilter]
                }
            })
        ]);

        const counts: Record<string, number> = {
            PENDING_MATURITY: 0,
            DUE_FOR_REVIEW: 0,
            UNDER_EVALUATION: 0,
            APPROVED: 0,
            DEFERRED: 0,
            DISQUALIFIED_DISCIPLINARY: 0,
            PENDING_REGISTRAR_OVERRIDE: 0,
            TOTAL: total
        };

        summaryStats.forEach(item => {
            if (item.eligibilityStatus) {
                counts[item.eligibilityStatus] = item._count.id;
            }
        });

        const enrichedData = profiles.map(p => {
            const fullName = `${p.title ? p.title + ' ' : ''}${p.surname || ''} ${p.otherNames || ''}`.trim() || p.user?.name || 'Staff Member';
            const effectiveDueYear = p.nextPromotionDueYear || p.nextDueYear;
            const effectiveDueDate = p.nextPromotionDueDate || p.nextDueDate;
            const effectiveStatus = p.promotionEligibilityStatus || p.eligibilityStatus;
            const hasDisciplinaryHold = Boolean(p.hasActiveDisciplinaryBlock || (p.queries && p.queries.length > 0));
            const openQueriesCount = p.queries?.length || 0;

            return {
                ...p,
                fullName,
                nextPromotionDueYear: effectiveDueYear,
                nextDueYear: effectiveDueYear,
                nextPromotionDueDate: effectiveDueDate,
                nextDueDate: effectiveDueDate,
                promotionEligibilityStatus: effectiveStatus,
                eligibilityStatus: effectiveStatus,
                hasDisciplinaryHold,
                openQueriesCount
            };
        });

        return {
            data: enrichedData,
            total,
            page: Number(page),
            pages: Math.ceil(total / take) || 1,
            counts,
            tabCounts: {
                dueThisCycle: dueThisCycleCount,
                maturedOverdue: maturedOverdueCount,
                upcoming: upcomingCount,
                all: allConfiguredCount
            },
            cycleYear: targetYear
        };
    }

    /**
     * Executes the Automated Annual Maturity Evaluation Engine (Step A - Step D).
     * Integrates Disciplinary Integrity Gate.
     */
    static async evaluateMaturityCycle(
        targetCycleYear: number = new Date().getFullYear(),
        actorId?: string,
        triggeredBy: 'CRON' | 'MANUAL' = 'CRON'
    ) {
        const log: string[] = [];
        const errors: string[] = [];
        const startTs = new Date().toISOString();

        log.push(`[${startTs}] 🚀 Starting Annual Promotion Maturity Engine (Year=${targetCycleYear}, Trigger=${triggeredBy})`);

        let processed = 0;
        let maturedCount = 0;
        let integrityHoldsCount = 0;
        let skippedCount = 0;

        try {
            const candidates = await prisma.staffProfile.findMany({
                where: {
                    isDeleted: false,
                    status: 'ACTIVE',
                    employmentCategory: 'PERMANENT',
                    AND: [
                        {
                            OR: [
                                { nextDueYear: { lte: targetCycleYear } },
                                { nextPromotionDueYear: { lte: targetCycleYear } },
                                { isDueForPromotion: true }
                            ]
                        }
                    ]
                },
                include: {
                    user: { select: { id: true, email: true, name: true } },
                    unit: { select: { id: true, name: true, headId: true } },
                    studyCenter: { select: { id: true, name: true } },
                    queries: {
                        where: {
                            OR: [
                                { source: 'REGISTRY', resolutionStatus: { in: ['PENDING', 'UNSATISFACTORY'] } },
                                { status: { in: ['OPEN', 'DEFAULTED_UNANSWERED'] } }
                            ]
                        },
                        select: { id: true, title: true, createdAt: true, status: true, source: true }
                    }
                }
            });

            log.push(`[QUERY] Found ${candidates.length} active candidate profiles matching maturity milestone ${targetCycleYear}.`);

            if (candidates.length === 0) {
                return {
                    cycleYear: targetCycleYear,
                    totalCandidates: 0,
                    maturedCount: 0,
                    integrityHoldsCount: 0,
                    skippedCount: 0,
                    log,
                    errors
                };
            }

            const batch = await prisma.promotionBatch.upsert({
                where: { cycleYear: targetCycleYear },
                create: {
                    cycleYear: targetCycleYear,
                    status: 'OPEN',
                    notes: `Compiled by ${triggeredBy} Maturity Engine on ${new Date().toLocaleDateString('en-NG')}`
                },
                update: {
                    updatedAt: new Date()
                }
            });

            const maturedStaffToNotify: Array<{ id: string; email?: string | null; name: string; staffId: string; unitId?: string | null; unitName?: string | null }> = [];
            const unitCandidateTally: Record<string, { unitName: string; headId?: string | null; count: number }> = {};

            for (const profile of candidates) {
                if (profile.evaluatedForYear === targetCycleYear && profile.eligibilityStatus !== PromotionEligibilityStatus.PENDING_MATURITY) {
                    skippedCount++;
                    continue;
                }

                try {
                    const staffName = `${profile.title ? profile.title + ' ' : ''}${profile.surname || ''} ${profile.otherNames || ''}`.trim() || profile.user?.name || 'Staff Member';
                    const staffId = profile.staffId || 'N/A';
                    const unitName = profile.unit?.name || profile.studyCenter?.name || profile.department || 'Registry Directorate';

                    // Disciplinary Integrity Gate Check
                    const queriesCount = profile.queries?.length || 0;
                    const hasUnresolvedQueries = queriesCount > 0;
                    const isSuspended = profile.status === 'SUSPENDED';
                    const hasDisciplinaryBlock = profile.hasActiveDisciplinaryBlock || hasUnresolvedQueries;
                    const integrityClear = !hasDisciplinaryBlock && !isSuspended;

                    let disqualificationReason: string | null = null;
                    if (hasUnresolvedQueries) {
                        disqualificationReason = `Disciplinary Hold: Candidate has ${queriesCount} unresolved official disciplinary quer${queriesCount > 1 ? 'ies' : 'y'}.`;
                        integrityHoldsCount++;
                    } else if (profile.hasActiveDisciplinaryBlock) {
                        disqualificationReason = `Disciplinary Block: ${profile.disciplinaryBlockReason || 'Active Registry disciplinary block'}`;
                        integrityHoldsCount++;
                    } else if (isSuspended) {
                        disqualificationReason = 'Suspended: Staff profile currently under administrative suspension.';
                        integrityHoldsCount++;
                    }

                    const targetStatus = integrityClear
                        ? PromotionEligibilityStatus.DUE_FOR_REVIEW
                        : PromotionEligibilityStatus.DISQUALIFIED_DISCIPLINARY;

                    await prisma.$transaction(async (tx) => {
                        await tx.promotionBatchCandidate.upsert({
                            where: {
                                batchId_staffProfileId: {
                                    batchId: batch.id,
                                    staffProfileId: profile.id
                                }
                            },
                            create: {
                                batchId: batch.id,
                                staffProfileId: profile.id,
                                cadreSnapshot: profile.cadreType || profile.cadre || 'ACADEMIC',
                                rankSnapshot: profile.rank || profile.currentRank || null,
                                levelSnapshot: profile.level ? `${profile.level}${profile.step ? '/' + profile.step : ''}` : null,
                                unitSnapshot: unitName,
                                status: targetStatus,
                                integrityClear,
                                disqualificationReason
                            },
                            update: {
                                status: targetStatus,
                                integrityClear,
                                disqualificationReason,
                                updatedAt: new Date()
                            }
                        });

                        await tx.promotionLog.create({
                            data: {
                                staffProfileId: profile.id,
                                snapshotRank: profile.rank || profile.currentRank || null,
                                snapshotLevel: profile.level ? `${profile.level}${profile.step ? '/' + profile.step : ''}` : null,
                                snapshotUnit: unitName,
                                status: integrityClear ? 'DUE_FOR_PROMOTION' : 'INTEGRITY_DISQUALIFIED',
                                calendarYear: targetCycleYear,
                                triggeredBy,
                                cronExecutedAt: new Date(),
                                notes: disqualificationReason || 'Automated cadre maturity milestone reached.'
                            }
                        });

                        await tx.staffProfile.update({
                            where: { id: profile.id },
                            data: {
                                eligibilityStatus: targetStatus,
                                promotionEligibilityStatus: targetStatus,
                                isDueForPromotion: integrityClear,
                                evaluatedForYear: targetCycleYear,
                                promotionFlaggedAt: new Date()
                            }
                        });
                    });

                    if (integrityClear) {
                        maturedCount++;
                        maturedStaffToNotify.push({
                            id: profile.user?.id || profile.id,
                            email: profile.user?.email,
                            name: staffName,
                            staffId,
                            unitId: profile.unit?.id,
                            unitName
                        });

                        if (profile.unit?.id) {
                            if (!unitCandidateTally[profile.unit.id]) {
                                unitCandidateTally[profile.unit.id] = {
                                    unitName: profile.unit.name,
                                    headId: profile.unit.headId,
                                    count: 0
                                };
                            }
                            unitCandidateTally[profile.unit.id].count++;
                        }
                    }

                    processed++;
                } catch (candErr: any) {
                    const msg = `[ERROR] Failed processing candidate ${profile.id}: ${candErr.message}`;
                    errors.push(msg);
                    log.push(msg);
                }
            }

            await prisma.promotionBatch.update({
                where: { id: batch.id },
                data: { candidateCount: maturedCount }
            });

            // Dispatch Notifications
            for (const s of maturedStaffToNotify) {
                if (s.id) {
                    await prisma.notification.create({
                        data: {
                            userId: s.id,
                            title: `⭐ ${targetCycleYear} Promotion Exercise Eligibility Notice`,
                            message: `Your profile has matured for the ${targetCycleYear} Annual Promotion Exercise. Dossier staged for Appraisal Committee evaluation.`,
                            type: 'SUCCESS',
                            link: '/dashboard/profile'
                        }
                    }).catch(() => {});
                }
            }

            log.push(`[COMPLETE] Evaluated ${processed} candidates. Matured: ${maturedCount}, Disciplinary Holds: ${integrityHoldsCount}, Skipped: ${skippedCount}.`);
        } catch (fatalErr: any) {
            const msg = `[FATAL] Maturity engine crashed: ${fatalErr.message}`;
            errors.push(msg);
            log.push(msg);
        }

        return {
            cycleYear: targetCycleYear,
            totalCandidates: processed,
            maturedCount,
            integrityHoldsCount,
            skippedCount,
            errors,
            log
        };
    }

    static async syncCandidates(cycleYear: number = new Date().getFullYear(), actorId?: string) {
        return await this.evaluateMaturityCycle(cycleYear, actorId, 'MANUAL');
    }

    static async batchActionCandidates(params: {
        staffProfileIds: string[];
        action: 'APPROVE_FOR_DOCKET' | 'DEFER' | 'SET_STATUS';
        status?: PromotionEligibilityStatus;
        reason: string;
        actorId: string;
    }) {
        const { staffProfileIds, action, status, reason, actorId } = params;

        let targetStatus: PromotionEligibilityStatus = PromotionEligibilityStatus.DUE_FOR_REVIEW;
        if (action === 'APPROVE_FOR_DOCKET') {
            targetStatus = PromotionEligibilityStatus.UNDER_EVALUATION;
        } else if (action === 'DEFER') {
            targetStatus = PromotionEligibilityStatus.DEFERRED;
        } else if (status) {
            targetStatus = status;
        }

        const updatedCount = await prisma.$transaction(async (tx) => {
            const updated = await tx.staffProfile.updateMany({
                where: { id: { in: staffProfileIds } },
                data: {
                    eligibilityStatus: targetStatus,
                    promotionEligibilityStatus: targetStatus,
                    isDueForPromotion: targetStatus !== PromotionEligibilityStatus.DEFERRED && targetStatus !== PromotionEligibilityStatus.PENDING_MATURITY && targetStatus !== PromotionEligibilityStatus.DISQUALIFIED_DISCIPLINARY,
                    overrideReason: reason.trim()
                }
            });

            await tx.promotionAuditLog.createMany({
                data: staffProfileIds.map(profileId => ({
                    staffProfileId: profileId,
                    actorId,
                    action: action,
                    newStatus: targetStatus,
                    reason: reason.trim(),
                    metadata: { batchAction: action }
                }))
            });

            return updated.count;
        });

        return { success: true, updatedCount, targetStatus };
    }

    static async getStaffPromotionAuditLogs(staffProfileId: string) {
        return prisma.promotionAuditLog.findMany({
            where: { staffProfileId },
            orderBy: { createdAt: 'desc' },
            include: {
                actor: { select: { id: true, name: true, email: true, role: true } }
            }
        });
    }
}
