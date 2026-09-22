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
     */
    static async updateStaffPromotionSchedule(params: UpdateScheduleParams) {
        const {
            staffProfileId,
            actorId,
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
                unit: { select: { name: true } }
            }
        });

        if (!profile) {
            throw new Error('Staff profile not found');
        }

        const effectiveDueYearInput = nextPromotionDueYear !== undefined && nextPromotionDueYear !== null ? nextPromotionDueYear : nextDueYear;
        const isManualOverride = registryOverride === true || (effectiveDueYearInput !== undefined && effectiveDueYearInput !== null && effectiveDueYearInput !== profile.nextPromotionDueYear && effectiveDueYearInput !== profile.nextDueYear);

        if (isManualOverride) {
            if (!overrideReason || overrideReason.trim().length < 5) {
                throw new Error('A valid administrative override justification (minimum 5 characters) is required when modifying promotion schedules.');
            }
        }

        // Determine candidate promotion date
        const effectiveLastPromo = lastPromotionDate !== undefined
            ? (lastPromotionDate ? new Date(lastPromotionDate) : null)
            : (profile.lastPromotionDate || profile.dateOfLastPromotion || null);

        const effectiveCadreType = normalizeToCadreType(cadreType) || normalizeToCadreType(profile.cadreType) || normalizeToCadreType(profile.cadre) || null;
        const effectiveCadre = normalizeToCadre(cadreType) || normalizeToCadre(profile.cadreType) || normalizeToCadre(profile.cadre) || null;
        const effectiveLevel = currentGradeLevel !== undefined ? currentGradeLevel : (profile.currentGradeLevel || profile.level);

        // Calculate auto-computed defaults if not explicitly overridden
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

        const prevDueYear = profile.nextPromotionDueYear || profile.nextDueYear;
        const prevStatus = profile.promotionEligibilityStatus || profile.eligibilityStatus;

        // Execute transaction: update profile + append audit log
        const [updatedProfile, auditLog] = await prisma.$transaction(async (tx) => {
            const updated = await tx.staffProfile.update({
                where: { id: staffProfileId },
                data: {
                    lastPromotionDate: effectiveLastPromo,
                    dateOfLastPromotion: effectiveLastPromo, // sync legacy field
                    cadreType: effectiveCadreType,
                    cadre: effectiveCadre, // sync legacy cadre field
                    currentGradeLevel: effectiveLevel,
                    nextDueYear: computedDueYear,
                    nextPromotionDueYear: computedDueYear,
                    nextDueDate: computedDueDate,
                    nextPromotionDueDate: computedDueDate,
                    eligibilityStatus: effectiveStatus,
                    promotionEligibilityStatus: effectiveStatus,
                    legacyDataBackfilled: true,
                    registryOverride: isManualOverride,
                    overrideReason: isManualOverride ? overrideReason?.trim() : profile.overrideReason,
                    isDueForPromotion: isDueImmediately || effectiveStatus === PromotionEligibilityStatus.DUE_FOR_REVIEW || effectiveStatus === PromotionEligibilityStatus.UNDER_EVALUATION
                },
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
                    action: isManualOverride ? 'MANUAL_OVERRIDE' : 'SCHEDULE_CONFIG',
                    previousDueYear: prevDueYear,
                    newDueYear: computedDueYear,
                    previousStatus: prevStatus,
                    newStatus: effectiveStatus,
                    reason: overrideReason?.trim() || `Configured schedule based on ${computed.cadreRuleApplied}`,
                    metadata: {
                        intervalYears: computed.intervalYears,
                        cadreRuleApplied: computed.cadreRuleApplied,
                        gradeLevel: effectiveLevel,
                        lastPromotionDate: effectiveLastPromo
                    }
                },
                include: {
                    actor: { select: { id: true, name: true, email: true, role: true } }
                }
            });

            return [updated, log];
        });

        return { profile: updatedProfile, auditLog };
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

        const where: any = {
            isDeleted: false,
            status: 'ACTIVE'
        };

        // Tab & Year filtering logic
        if (tab === 'DUE_THIS_CYCLE') {
            where.OR = [
                { nextPromotionDueYear: targetYear },
                { nextDueYear: targetYear },
                {
                    AND: [
                        { isDueForPromotion: true },
                        { OR: [{ nextPromotionDueYear: null }, { nextDueYear: null }] }
                    ]
                }
            ];
        } else if (tab === 'MATURED_OVERDUE') {
            where.OR = [
                { nextPromotionDueYear: { lt: targetYear } },
                { nextDueYear: { lt: targetYear } },
                { isDueForPromotion: true }
            ];
            where.eligibilityStatus = { in: [PromotionEligibilityStatus.DUE_FOR_REVIEW, PromotionEligibilityStatus.UNDER_EVALUATION, PromotionEligibilityStatus.PENDING_MATURITY] };
        } else if (tab === 'UPCOMING') {
            where.OR = [
                { nextPromotionDueYear: { gt: targetYear } },
                { nextDueYear: { gt: targetYear } }
            ];
        } else if (tab === 'ALL') {
            // No year constraint on 'ALL' tab
        } else if (year) {
            where.OR = [
                { nextPromotionDueYear: targetYear },
                { nextDueYear: targetYear },
                {
                    AND: [
                        { OR: [{ nextPromotionDueYear: null }, { nextDueYear: null }] },
                        { isDueForPromotion: true }
                    ]
                }
            ];
        }

        // Cadre filter
        if (cadre && cadre !== 'ALL') {
            const targetCadreType = normalizeToCadreType(cadre);
            const targetCadre = normalizeToCadre(cadre);

            const orConditions: any[] = [];
            if (targetCadreType) {
                orConditions.push({ cadreType: targetCadreType });
            }
            if (targetCadre) {
                orConditions.push({ cadre: targetCadre });
            }

            if (orConditions.length > 0) {
                where.AND = where.AND || [];
                where.AND.push(orConditions.length === 1 ? orConditions[0] : { OR: orConditions });
            }
        }

        // Status filter
        if (status && status !== 'ALL') {
            where.eligibilityStatus = status as PromotionEligibilityStatus;
        }

        // Search filter (staff ID, name, rank, unit/department)
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
                    OR: [
                        { nextPromotionDueYear: targetYear },
                        { nextDueYear: targetYear },
                        { isDueForPromotion: true }
                    ]
                }
            }),
            prisma.staffProfile.count({
                where: {
                    isDeleted: false,
                    status: 'ACTIVE',
                    OR: [
                        { nextPromotionDueYear: { lt: targetYear } },
                        { nextDueYear: { lt: targetYear } }
                    ]
                }
            }),
            prisma.staffProfile.count({
                where: {
                    isDeleted: false,
                    status: 'ACTIVE',
                    OR: [
                        { nextPromotionDueYear: { gt: targetYear } },
                        { nextDueYear: { gt: targetYear } }
                    ]
                }
            }),
            prisma.staffProfile.count({
                where: {
                    isDeleted: false,
                    status: 'ACTIVE'
                }
            })
        ]);

        const counts: Record<string, number> = {
            PENDING_MATURITY: 0,
            DUE_FOR_REVIEW: 0,
            UNDER_EVALUATION: 0,
            APPROVED: 0,
            DEFERRED: 0,
            TOTAL: total
        };

        summaryStats.forEach(item => {
            if (item.eligibilityStatus) {
                counts[item.eligibilityStatus] = item._count.id;
            }
        });

        // Format and enrich profiles
        const enrichedData = profiles.map(p => {
            const fullName = `${p.title ? p.title + ' ' : ''}${p.surname || ''} ${p.otherNames || ''}`.trim() || p.user?.name || 'Staff Member';
            const effectiveDueYear = p.nextPromotionDueYear || p.nextDueYear;
            const effectiveDueDate = p.nextPromotionDueDate || p.nextDueDate;
            const effectiveStatus = p.promotionEligibilityStatus || p.eligibilityStatus;

            return {
                ...p,
                fullName,
                nextPromotionDueYear: effectiveDueYear,
                nextDueYear: effectiveDueYear,
                nextPromotionDueDate: effectiveDueDate,
                nextDueDate: effectiveDueDate,
                promotionEligibilityStatus: effectiveStatus,
                eligibilityStatus: effectiveStatus
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
     * Runs an on-demand docket synchronization to stage candidates whose maturity year <= currentYear into DUE_FOR_REVIEW.
     */
    static async syncCandidates(cycleYear: number = new Date().getFullYear(), actorId?: string) {
        // 1. Evaluate annual cycle engine
        const evalResult = await this.evaluateMaturityCycle(cycleYear, actorId, 'MANUAL');

        // 2. Fast-track update any pending staff with nextPromotionDueYear <= cycleYear into DUE_FOR_REVIEW
        const updateResult = await prisma.staffProfile.updateMany({
            where: {
                isDeleted: false,
                status: 'ACTIVE',
                OR: [
                    { nextPromotionDueYear: { lte: cycleYear } },
                    { nextDueYear: { lte: cycleYear } },
                    { isDueForPromotion: true }
                ],
                eligibilityStatus: PromotionEligibilityStatus.PENDING_MATURITY
            },
            data: {
                promotionEligibilityStatus: PromotionEligibilityStatus.DUE_FOR_REVIEW,
                eligibilityStatus: PromotionEligibilityStatus.DUE_FOR_REVIEW,
                isDueForPromotion: true
            }
        });

        return {
            cycleYear,
            evalResult,
            stagedCount: updateResult.count
        };
    }


    /**
     * Executes the Automated Annual Maturity Evaluation Engine (Step A - Step D).
     * Screens active staff, verifies integrity/queries, transitions status, builds docket, and dispatches multi-tier notifications.
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
            // Step A: Query active staff where nextDueYear <= targetCycleYear OR legacy flagged
            const candidates = await prisma.staffProfile.findMany({
                where: {
                    isDeleted: false,
                    status: 'ACTIVE',
                    OR: [
                        { nextDueYear: { lte: targetCycleYear } },
                        { isDueForPromotion: true }
                    ]
                },
                include: {
                    user: { select: { id: true, email: true, name: true } },
                    unit: { select: { id: true, name: true, headId: true } },
                    studyCenter: { select: { id: true, name: true } },
                    queries: {
                        where: { status: 'OPEN' },
                        select: { id: true, title: true, createdAt: true }
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

            // Step C Prep: Upsert Annual Promotion Batch Docket
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
                // Idempotency: Skip if already evaluated for this cycle year and already DUE_FOR_REVIEW / UNDER_EVALUATION
                if (profile.evaluatedForYear === targetCycleYear && profile.eligibilityStatus !== PromotionEligibilityStatus.PENDING_MATURITY) {
                    skippedCount++;
                    log.push(`[SKIP] Staff ${profile.staffId || profile.id} already staged for cycle ${targetCycleYear}.`);
                    continue;
                }

                try {
                    const staffName = `${profile.title ? profile.title + ' ' : ''}${profile.surname || ''} ${profile.otherNames || ''}`.trim() || profile.user?.name || 'Staff Member';
                    const staffId = profile.staffId || 'N/A';
                    const unitName = profile.unit?.name || profile.studyCenter?.name || profile.department || 'Registry Directorate';

                    // Step B: Disciplinary & Integrity screening
                    const hasOpenQueries = profile.queries.length > 0;
                    const isSuspended = profile.status === 'SUSPENDED';
                    const integrityClear = !hasOpenQueries && !isSuspended;

                    let disqualificationReason: string | null = null;
                    if (hasOpenQueries) {
                        disqualificationReason = `Pending Integrity Review: Candidate has ${profile.queries.length} unresolved official quer${profile.queries.length > 1 ? 'ies' : 'y'}.`;
                        integrityHoldsCount++;
                    } else if (isSuspended) {
                        disqualificationReason = 'Suspended: Staff profile currently under administrative suspension.';
                        integrityHoldsCount++;
                    }

                    const targetStatus = integrityClear
                        ? PromotionEligibilityStatus.DUE_FOR_REVIEW
                        : PromotionEligibilityStatus.PENDING_MATURITY;

                    // Step C: Persist candidate record & audit trail inside transaction
                    await prisma.$transaction(async (tx) => {
                        // Upsert batch candidate
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

                        // Create legacy PromotionLog record for backward compatibility
                        await tx.promotionLog.create({
                            data: {
                                staffProfileId: profile.id,
                                snapshotRank: profile.rank || profile.currentRank || null,
                                snapshotLevel: profile.level ? `${profile.level}${profile.step ? '/' + profile.step : ''}` : null,
                                snapshotUnit: unitName,
                                status: integrityClear ? 'DUE_FOR_PROMOTION' : 'INTEGRITY_HOLD',
                                calendarYear: targetCycleYear,
                                triggeredBy,
                                cronExecutedAt: new Date(),
                                notes: disqualificationReason || 'Automated cadre maturity milestone reached.'
                            }
                        });

                        // Update StaffProfile
                        await tx.staffProfile.update({
                            where: { id: profile.id },
                            data: {
                                eligibilityStatus: targetStatus,
                                isDueForPromotion: integrityClear,
                                evaluatedForYear: targetCycleYear,
                                promotionFlaggedAt: new Date()
                            }
                        });

                        // Append immutable PromotionAuditLog
                        if (actorId || triggeredBy === 'CRON') {
                            const systemActor = actorId ? await tx.user.findUnique({ where: { id: actorId }, select: { id: true } }) : null;
                            const effectiveActorId = systemActor?.id || profile.user?.id || profile.id;

                            await tx.promotionAuditLog.create({
                                data: {
                                    staffProfileId: profile.id,
                                    actorId: effectiveActorId,
                                    action: 'CRON_EVALUATED',
                                    previousDueYear: profile.nextDueYear,
                                    newDueYear: profile.nextDueYear || targetCycleYear,
                                    previousStatus: profile.eligibilityStatus,
                                    newStatus: targetStatus,
                                    reason: integrityClear
                                        ? `Automated Annual Maturity Review: Profile matured for ${targetCycleYear} Promotion Exercise.`
                                        : `Automated Review Integrity Hold: ${disqualificationReason}`,
                                    metadata: {
                                        cycleYear: targetCycleYear,
                                        triggeredBy,
                                        integrityClear,
                                        openQueriesCount: profile.queries.length
                                    }
                                }
                            });
                        }
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

                        // Aggregate by unit
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
                    log.push(`[PROCESSED] ${staffName} (${staffId}) -> ${targetStatus} (Clear=${integrityClear})`);

                } catch (candErr: any) {
                    const msg = `[ERROR] Failed processing candidate ${profile.id}: ${candErr.message}`;
                    errors.push(msg);
                    log.push(msg);
                    console.error(msg, candErr);
                }
            }

            // Update batch total count
            await prisma.promotionBatch.update({
                where: { id: batch.id },
                data: { candidateCount: maturedCount }
            });

            // Step D: Dispatch Multi-Tier Notifications
            log.push(`[NOTIFY] Dispatching notifications for ${maturedStaffToNotify.length} matured candidates...`);

            // 1. Staff notifications
            for (const s of maturedStaffToNotify) {
                if (s.id) {
                    await prisma.notification.create({
                        data: {
                            userId: s.id,
                            title: `⭐ ${targetCycleYear} Promotion Exercise Eligibility Notice`,
                            message: `Your profile has matured for the ${targetCycleYear} Annual Promotion Exercise. The Registry Appraisal Committee has staged your dossier for evaluation.`,
                            type: 'SUCCESS',
                            link: '/dashboard/profile'
                        }
                    }).catch(() => {});

                    sendPushNotification(
                        [s.id],
                        `⭐ ${targetCycleYear} Promotion Exercise Notice`,
                        `Your profile has matured for the ${targetCycleYear} Annual Promotion Exercise.`,
                        '/dashboard/profile'
                    ).catch(() => {});
                }

                if (s.email) {
                    sendPromotionNotificationEmail(s.email, s.name, s.staffId).catch(err => console.error('Email alert failed:', err));
                }
            }

            // 2. Unit Heads / Faculty Deans notifications
            for (const unitId of Object.keys(unitCandidateTally)) {
                const info = unitCandidateTally[unitId];
                if (info.headId) {
                    await prisma.notification.create({
                        data: {
                            userId: info.headId,
                            title: `📋 ${targetCycleYear} Promotion Candidates (${info.unitName})`,
                            message: `${info.count} staff candidate${info.count > 1 ? 's' : ''} in your unit have matured for the ${targetCycleYear} Promotion Exercise.`,
                            type: 'INFO',
                            link: '/dashboard/unit/staff'
                        }
                    }).catch(() => {});
                }
            }

            // 3. Central Registry / Appraisal Committee oversight alerts
            const registryAdmins = await prisma.user.findMany({
                where: {
                    role: { in: [Role.HR_ADMIN, Role.SUPER_USER, Role.VICE_CHANCELLOR, Role.ADMIN] },
                    isActive: true
                },
                select: { id: true }
            });

            if (registryAdmins.length > 0) {
                await prisma.notification.createMany({
                    data: registryAdmins.map(admin => ({
                        userId: admin.id,
                        title: `📑 ${targetCycleYear} Annual Promotion Docket Compiled`,
                        message: `The ${targetCycleYear} Promotion Evaluation Engine has compiled ${maturedCount} eligible candidate(s) with ${integrityHoldsCount} integrity hold(s).`,
                        type: 'INFO',
                        link: '/dashboard/registry/due-for-promotion'
                    }))
                }).catch(() => {});
            }

            log.push(`[COMPLETE] Evaluated ${processed} candidates. Matured: ${maturedCount}, Holds: ${integrityHoldsCount}, Skipped: ${skippedCount}.`);

        } catch (fatalErr: any) {
            const msg = `[FATAL] Maturity engine crashed: ${fatalErr.message}`;
            errors.push(msg);
            log.push(msg);
            console.error(msg, fatalErr);
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

    /**
     * Batch actions on candidates (e.g. Approve for Docket, Defer, Status Update).
     */
    static async batchActionCandidates(params: {
        staffProfileIds: string[];
        action: 'APPROVE_FOR_DOCKET' | 'DEFER' | 'SET_STATUS';
        status?: PromotionEligibilityStatus;
        reason: string;
        actorId: string;
    }) {
        const { staffProfileIds, action, status, reason, actorId } = params;

        if (!staffProfileIds || staffProfileIds.length === 0) {
            throw new Error('No staff candidates specified.');
        }

        if (!reason || reason.trim().length < 5) {
            throw new Error('A valid administrative reason (minimum 5 characters) is required for batch promotion actions.');
        }

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
                    isDueForPromotion: targetStatus !== PromotionEligibilityStatus.DEFERRED && targetStatus !== PromotionEligibilityStatus.PENDING_MATURITY,
                    overrideReason: reason.trim()
                }
            });

            // Insert audit logs for each profile
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

    /**
     * Retrieves the audit log history for a specific staff profile.
     */
    static async getStaffPromotionAuditLogs(staffProfileId: string) {
        return prisma.promotionAuditLog.findMany({
            where: { staffProfileId },
            orderBy: { createdAt: 'desc' },
            include: {
                actor: {
                    select: { id: true, name: true, email: true, role: true }
                }
            }
        });
    }
}
