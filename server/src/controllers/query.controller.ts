import { Request, Response } from 'express';
import { QueryStatus, Role, DisciplinaryActionType, PromotionEligibilityStatus } from '@prisma/client';
import { StorageService } from '../services/storage.service';
import { notifyUser } from './notification.controller';
import prisma from '../prisma';

interface AuthRequest extends Request {
    user?: { id: string; role: string };
}

// Issue Query or Warning (Unified Disciplinary Dispatch)
export const issueQuery = async (req: AuthRequest, res: Response) => {
    try {
        const {
            staffId,
            staffProfileId,
            title,
            content,
            copyHR,
            actionType = 'QUERY',
            stipulatedHours = 48,
            source: customSource,
            severity
        } = req.body;

        const targetId = staffProfileId || staffId;
        const issuerId = req.user?.id;
        const issuerRole = req.user?.role;

        if (!targetId || !title) {
            return res.status(400).json({ message: 'Staff ID and Title are required' });
        }

        // 1. Validation & Multi-Format Staff Profile Resolution
        let staff = await prisma.staffProfile.findUnique({ where: { id: targetId } });
        if (!staff) {
            staff = await prisma.staffProfile.findFirst({
                where: { OR: [{ userId: targetId }, { staffId: targetId }] }
            });
        }
        if (!staff) {
            return res.status(404).json({ message: 'Staff profile not found' });
        }

        // 2. Boundary check for non-global managers
        const isHQAdmin = [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR, Role.REGISTRAR].includes(issuerRole as any);
        if (!isHQAdmin) {
            if ([Role.STUDY_CENTER_MANAGER, Role.UNIT_HEAD, Role.UNIT_ADMIN].includes(issuerRole as any)) {
                const issuerProfile = await prisma.staffProfile.findUnique({
                    where: { userId: issuerId },
                    select: { unitId: true, centerId: true }
                });

                let matchesPlacement = (
                    (issuerRole === Role.STUDY_CENTER_MANAGER && issuerProfile?.centerId && staff.centerId === issuerProfile.centerId) ||
                    ((issuerRole === Role.UNIT_HEAD || issuerRole === Role.UNIT_ADMIN) && issuerProfile?.unitId && staff.unitId === issuerProfile.unitId)
                );

                if (!matchesPlacement && issuerRole === Role.UNIT_HEAD && staff.unitId) {
                    const headUnit = await prisma.unit.findFirst({ where: { id: staff.unitId, headId: issuerId } });
                    if (headUnit) matchesPlacement = true;
                }

                if (!matchesPlacement) {
                    return res.status(403).json({ message: 'Unauthorized: Target staff is not within your center or unit' });
                }
            } else {
                return res.status(403).json({ message: 'Unauthorized to issue queries' });
            }
        }

        const isWarningAction = actionType === 'OFFICIAL_WARNING';
        const hours = isWarningAction ? 0 : Number(stipulatedHours || 48);
        const responseDeadline = isWarningAction ? null : new Date(Date.now() + hours * 3600000);
        const source = customSource || (isHQAdmin ? 'REGISTRY' : 'UNIT_HEAD');

        // 3. Create StaffQuery / Warning
        const query = await prisma.staffQuery.create({
            data: {
                staffId: staff.id,
                issuedById: issuerId!,
                title,
                content: content || '',
                actionType: isWarningAction ? DisciplinaryActionType.OFFICIAL_WARNING : DisciplinaryActionType.QUERY,
                isQuery: !isWarningAction,
                isWarning: isWarningAction,
                stipulatedHours: hours,
                responseDeadline,
                source,
                status: isWarningAction ? QueryStatus.CLOSED : QueryStatus.OPEN,
                resolutionStatus: isWarningAction ? 'ABSORBED' : 'PENDING',
                copyHR: copyHR !== undefined ? Boolean(copyHR) : true,
                breachLoggedToFolio: isWarningAction
            }
        });

        // 4. Update Staff Profile with Disciplinary Integrity Hold if originating from Registry
        if (!isWarningAction && (source === 'REGISTRY' || copyHR)) {
            await prisma.staffProfile.update({
                where: { id: staff.id },
                data: {
                    hasActiveDisciplinaryBlock: true,
                    disciplinaryBlockReason: `Pending Query: "${title}" (${hours}h defense window)`
                }
            });
        }

        // 5. Notify Staff
        const issuerLabel = isHQAdmin ? 'Registry' : ([Role.STUDY_CENTER_MANAGER].includes(issuerRole as any) ? 'Study Center Director' : 'Unit Head');
        if (isWarningAction) {
            await notifyUser(
                staff.userId,
                '⚠️ Official Warning / Admonition Issued',
                `You have been issued an official warning/admonition by ${issuerLabel}: "${title}". This caution has been entered into your personnel folio.`,
                'WARNING',
                '/dashboard/queries'
            );
        } else {
            await notifyUser(
                staff.userId,
                '🚨 Official Query Issued (Defense Required)',
                `You have received a formal disciplinary query from ${issuerLabel}: "${title}". A formal defense is required within ${hours} hours.`,
                'ERROR',
                '/dashboard/queries'
            );
        }

        res.status(201).json(query);
    } catch (error) {
        console.error('Error issuing disciplinary action:', error);
        res.status(500).json({ message: 'Error issuing disciplinary action', error: String(error) });
    }
};

// Respond to Query (Staff -> HR)
export const respondToQuery = async (req: AuthRequest, res: Response) => {
    try {
        const { queryId, responseText, content } = req.body;
        const replyText = responseText || content;
        const responderId = req.user?.id;
        const file = req.file;

        if (!queryId) return res.status(400).json({ message: 'Query ID is required' });
        if (!replyText || replyText.trim().length === 0) {
            return res.status(400).json({ message: 'Response text is required' });
        }

        const query = await prisma.staffQuery.findUnique({
            where: { id: queryId },
            include: { staff: true, issuedBy: true }
        });

        if (!query) return res.status(404).json({ message: 'Query not found' });

        const isTargetUser = query.staff.userId === responderId || query.staff.id === responderId;
        const isHQAdmin = [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR, Role.REGISTRAR].includes(req.user?.role as any);

        if (!isTargetUser && !isHQAdmin) {
            return res.status(403).json({ message: 'Unauthorized: You can only respond to queries issued to your staff account.' });
        }

        let attachmentUrl = undefined;
        if (file) {
            attachmentUrl = await StorageService.uploadFile(file);
        }

        const now = new Date();
        const isBreached = query.responseDeadline ? now > query.responseDeadline : false;

        const updatedQuery = await prisma.staffQuery.update({
            where: { id: queryId },
            data: {
                response: replyText,
                responseAttachmentUrl: attachmentUrl,
                status: QueryStatus.RESPONDED,
                slaBreached: isBreached || query.slaBreached,
                slaBreachedAt: isBreached ? now : query.slaBreachedAt
            }
        });

        // Notify Issuer (HR / Unit Head)
        await notifyUser(
            query.issuedById,
            'Query Defense Received',
            `Staff ${query.staff.surname || ''} has submitted their defense for query "${query.title}".`,
            'INFO',
            `/dashboard/queries`
        );

        res.json(updatedQuery);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error responding to query' });
    }
};

// Get Queries
export const getQueries = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        const { staffId } = req.query as { staffId?: string };

        let whereClause: any = {};

        const isHQAdmin = [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR, Role.REGISTRAR].includes(role as any);
        if (isHQAdmin) {
            whereClause.OR = [
                { copyHR: true },
                { issuedById: userId }
            ];
            if (staffId) {
                whereClause = {
                    AND: [
                        { staffId },
                        {
                            OR: [
                                { copyHR: true },
                                { issuedById: userId }
                            ]
                        }
                    ]
                };
            }
        } else if ([Role.STUDY_CENTER_MANAGER, Role.UNIT_HEAD, Role.UNIT_ADMIN].includes(role as any)) {
            const headProfile = await prisma.staffProfile.findUnique({
                where: { userId },
                select: { id: true, unitId: true, centerId: true }
            });

            const managerFilter: any[] = [
                { issuedById: userId }
            ];

            if (role === Role.STUDY_CENTER_MANAGER && headProfile?.centerId) {
                managerFilter.push({ staff: { centerId: headProfile.centerId } });
            }
            if ((role === Role.UNIT_HEAD || role === Role.UNIT_ADMIN) && headProfile?.unitId) {
                managerFilter.push({ staff: { unitId: headProfile.unitId } });
            }

            if (role === Role.UNIT_HEAD) {
                const headUnits = await prisma.unit.findMany({ where: { headId: userId }, select: { id: true } });
                const unitIds = headUnits.map(u => u.id);
                if (unitIds.length > 0) {
                    managerFilter.push({ staff: { unitId: { in: unitIds } } });
                }
            }

            whereClause.OR = managerFilter;

            if (staffId) {
                whereClause = {
                    AND: [
                        { staffId },
                        { OR: managerFilter }
                    ]
                };
            }
        } else {
            const profile = await prisma.staffProfile.findUnique({ where: { userId } });
            if (!profile) return res.json([]);
            whereClause.staffId = profile.id;
        }

        const queries = await prisma.staffQuery.findMany({
            where: whereClause,
            include: {
                staff: {
                    select: {
                        id: true,
                        surname: true,
                        otherNames: true,
                        staffId: true,
                        rank: true,
                        unit: { select: { name: true } },
                        user: { select: { name: true, email: true } }
                    }
                },
                issuedBy: {
                    select: {
                        name: true,
                        role: true,
                        staffProfile: {
                            select: {
                                rank: true,
                                signatureUrl: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(queries);
    } catch (error) {
        console.error('Error fetching queries:', error);
        res.status(500).json({ message: 'Error fetching queries' });
    }
};

// Resolve Query (HR & Unit Managers)
export const resolveQuery = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const {
            status = 'CLOSED',
            resolutionStatus = 'SATISFACTORY', // SATISFACTORY, UNSATISFACTORY, EXONERATED, COMMITTEE_REFERRAL
            disciplinaryCommitteeRef,
            remarks
        } = req.body;

        const userId = req.user?.id;
        const role = req.user?.role;

        const existingQuery = await prisma.staffQuery.findUnique({
            where: { id },
            include: { staff: true }
        });

        if (!existingQuery) return res.status(404).json({ message: 'Query not found' });

        const isHQAdmin = [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR, Role.REGISTRAR].includes(role as any);
        if (!isHQAdmin && existingQuery.issuedById !== userId) {
            return res.status(403).json({ message: 'Unauthorized to resolve this query.' });
        }

        const query = await prisma.staffQuery.update({
            where: { id },
            data: {
                status: status as QueryStatus,
                resolutionStatus,
                disciplinaryCommitteeRef: disciplinaryCommitteeRef || existingQuery.disciplinaryCommitteeRef
            },
            include: { staff: true }
        });

        // If resolution is SATISFACTORY or EXONERATED, check if staff has any other unresolved queries
        if (resolutionStatus === 'SATISFACTORY' || resolutionStatus === 'EXONERATED') {
            const otherOpenQueries = await prisma.staffQuery.count({
                where: {
                    staffId: existingQuery.staffId,
                    id: { not: id },
                    status: { in: ['OPEN', 'DEFAULTED_UNANSWERED'] }
                }
            });

            if (otherOpenQueries === 0) {
                await prisma.staffProfile.update({
                    where: { id: existingQuery.staffId },
                    data: {
                        hasActiveDisciplinaryBlock: false,
                        disciplinaryBlockReason: null,
                        promotionEligibilityStatus: PromotionEligibilityStatus.DUE_FOR_REVIEW
                    }
                });
            }
        }

        // Notify Staff
        await notifyUser(
            query.staff.userId,
            'Disciplinary Query Resolution',
            `Your query "${query.title}" has been resolved with verdict: ${resolutionStatus}. Status: ${status}.`,
            resolutionStatus === 'SATISFACTORY' || resolutionStatus === 'EXONERATED' ? 'SUCCESS' : 'WARNING',
            '/dashboard/queries'
        );

        res.json(query);
    } catch (error) {
        console.error('[resolveQuery] Error resolving query:', error);
        res.status(500).json({ message: 'Error resolving query', error: String(error) });
    }
};

// Acknowledge Official Warning (Staff -> Folio Logged)
export const acknowledgeWarning = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const queryId = id || req.body?.queryId;
        const userId = req.user?.id;

        if (!queryId) return res.status(400).json({ message: 'Query ID is required' });

        const query = await prisma.staffQuery.findUnique({
            where: { id: queryId },
            include: { staff: true, issuedBy: true }
        });

        if (!query) return res.status(404).json({ message: 'Disciplinary record not found' });

        const isTargetUser = query.staff.userId === userId || query.staff.id === userId;
        const isHQAdmin = [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR, Role.REGISTRAR].includes(req.user?.role as any);

        if (!isTargetUser && !isHQAdmin) {
            return res.status(403).json({ message: 'Unauthorized: You can only acknowledge warnings issued to your staff account.' });
        }

        const updatedQuery = await prisma.staffQuery.update({
            where: { id: queryId },
            data: {
                warningAcknowledged: true,
                warningAcknowledgedAt: new Date(),
                breachLoggedToFolio: true,
                status: QueryStatus.CLOSED,
                resolutionStatus: 'ACKNOWLEDGED'
            },
            include: {
                staff: {
                    select: {
                        id: true,
                        surname: true,
                        otherNames: true,
                        staffId: true,
                        user: { select: { name: true, email: true } }
                    }
                }
            }
        });

        // Notify Issuer
        await notifyUser(
            query.issuedById,
            'Official Warning Acknowledged',
            `Staff ${query.staff.surname || ''} ${query.staff.otherNames || ''} has formally acknowledged receipt of Official Warning "${query.title}". Folio record updated.`,
            'INFO',
            `/dashboard/registry/queries`
        );

        res.json({
            message: 'Official Warning formally acknowledged and entered into staff digital folio.',
            query: updatedQuery
        });
    } catch (error: any) {
        console.error('Error acknowledging warning:', error);
        res.status(500).json({ message: 'Error acknowledging warning', error: error.message });
    }
};
