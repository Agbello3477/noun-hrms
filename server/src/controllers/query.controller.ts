import { Request, Response } from 'express';
import { QueryStatus, Role } from '@prisma/client';
import { StorageService } from '../services/storage.service';
import { notifyUser } from './notification.controller';
import prisma from '../prisma';

interface AuthRequest extends Request {
    user?: { id: string; role: string };
}

// Issue Query (HR -> Staff & Unit Managers)
export const issueQuery = async (req: AuthRequest, res: Response) => {
    try {
        const { staffId, title, content, copyHR } = req.body;
        const issuerId = req.user?.id;
        const issuerRole = req.user?.role;

        // Validation
        const staff = await prisma.staffProfile.findUnique({ where: { id: staffId } });
        if (!staff) return res.status(404).json({ message: 'Staff profile not found' });

        // Boundary check for non-global managers
        const isHQAdmin = [Role.HR_ADMIN, Role.SUPER_USER, Role.VICE_CHANCELLOR].includes(issuerRole as any);
        if (!isHQAdmin) {
            if ([Role.STUDY_CENTER_MANAGER, Role.UNIT_HEAD, Role.UNIT_ADMIN].includes(issuerRole as any)) {
                const issuerProfile = await prisma.staffProfile.findUnique({
                    where: { userId: issuerId },
                    select: { unitId: true, centerId: true }
                });
                if (!issuerProfile) {
                    return res.status(403).json({ message: 'Unauthorized: You do not have a staff profile' });
                }

                const matchesPlacement = (
                    (issuerRole === Role.STUDY_CENTER_MANAGER && issuerProfile.centerId && staff.centerId === issuerProfile.centerId) ||
                    ((issuerRole === Role.UNIT_HEAD || issuerRole === Role.UNIT_ADMIN) && issuerProfile.unitId && staff.unitId === issuerProfile.unitId)
                );

                if (!matchesPlacement) {
                    return res.status(403).json({ message: 'Unauthorized: Staff is not in your center/unit' });
                }
            } else {
                return res.status(403).json({ message: 'Unauthorized' });
            }
        }

        const query = await prisma.staffQuery.create({
            data: {
                staffId,
                issuedById: issuerId!,
                title,
                content,
                status: QueryStatus.OPEN,
                copyHR: copyHR !== undefined ? Boolean(copyHR) : true
            }
        });

        // Notify Staff
        await notifyUser(
            staff.userId,
            'New Query Received',
            `You have received a pending query: "${title}". Please respond immediately.`,
            'WARNING',
            '/dashboard/query'
        );

        res.status(201).json(query);
    } catch (error) {
        console.error('Error issuing query:', error);
        res.status(500).json({ message: 'Error issuing query' });
    }
};

// Respond to Query (Staff -> HR)
export const respondToQuery = async (req: AuthRequest, res: Response) => {
    try {
        const { queryId, responseText } = req.body;
        const responderId = req.user?.id;
        const file = req.file; // Attachment

        const query = await prisma.staffQuery.findUnique({
            where: { id: queryId },
            include: { staff: true, issuedBy: true }
        });

        if (!query) return res.status(404).json({ message: 'Query not found' });

        // Ensure responder is the target staff
        if (query.staff.userId !== responderId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        let attachmentUrl = undefined;
        if (file) {
            attachmentUrl = await StorageService.uploadFile(file);
        }

        const updatedQuery = await prisma.staffQuery.update({
            where: { id: queryId },
            data: {
                response: responseText,
                responseAttachmentUrl: attachmentUrl,
                status: QueryStatus.RESPONDED
            }
        });

        // Notify Issuer (HR)
        await notifyUser(
            query.issuedById,
            'Query Response Received',
            `Staff ${query.staff.surname} has responded to query "${query.title}".`,
            'INFO',
            `/dashboard/hr/query`
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

        const isHQAdmin = [Role.HR_ADMIN, Role.SUPER_USER, Role.VICE_CHANCELLOR].includes(role as any);
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
            if (!headProfile) return res.json([]);

            const managerFilter: any[] = [
                { issuedById: userId }
            ];

            if (role === Role.STUDY_CENTER_MANAGER && headProfile.centerId) {
                managerFilter.push({ staff: { centerId: headProfile.centerId } });
            }
            if ((role === Role.UNIT_HEAD || role === Role.UNIT_ADMIN) && headProfile.unitId) {
                managerFilter.push({ staff: { unitId: headProfile.unitId } });
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
            // Regular staff: only see queries issued to them
            const profile = await prisma.staffProfile.findUnique({ where: { userId } });
            if (!profile) return res.json([]);
            whereClause.staffId = profile.id;
        }

        const queries = await prisma.staffQuery.findMany({
            where: whereClause,
            include: {
                staff: { select: { user: { select: { name: true } }, staffId: true } },
                issuedBy: { select: { name: true } }
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
        const { status } = req.body; // Expect 'CLOSED' or 'ESCALATED'
        const userId = req.user?.id;
        const role = req.user?.role;

        console.log(`[resolveQuery] Attempting to resolve query ${id} with status: ${status}`);

        const existingQuery = await prisma.staffQuery.findUnique({
            where: { id },
            include: { staff: true }
        });

        if (!existingQuery) return res.status(404).json({ message: 'Query not found' });

        const isHQAdmin = [Role.HR_ADMIN, Role.SUPER_USER, Role.VICE_CHANCELLOR].includes(role as any);
        if (isHQAdmin) {
            if (!existingQuery.copyHR && existingQuery.issuedById !== userId) {
                return res.status(403).json({ message: 'Unauthorized: This is an internal-only query and you did not issue it.' });
            }
        } else {
            if ([Role.STUDY_CENTER_MANAGER, Role.UNIT_HEAD, Role.UNIT_ADMIN].includes(role as any)) {
                const headProfile = await prisma.staffProfile.findUnique({
                    where: { userId },
                    select: { unitId: true, centerId: true }
                });
                if (!headProfile) {
                    return res.status(403).json({ message: 'Unauthorized: You do not have a staff profile' });
                }

                const matchesPlacement = (
                    (role === Role.STUDY_CENTER_MANAGER && headProfile.centerId && existingQuery.staff.centerId === headProfile.centerId) ||
                    ((role === Role.UNIT_HEAD || role === Role.UNIT_ADMIN) && headProfile.unitId && existingQuery.staff.unitId === headProfile.unitId) ||
                    existingQuery.issuedById === userId
                );

                if (!matchesPlacement) {
                    return res.status(403).json({ message: 'Unauthorized: Staff is not in your center/unit and you did not issue this query' });
                }
            } else {
                return res.status(403).json({ message: 'Unauthorized to resolve queries' });
            }
        }

        const query = await prisma.staffQuery.update({
            where: { id },
            data: { status },
            include: { staff: true }
        });

        // Notify Staff
        await notifyUser(
            query.staff.userId,
            'Query Updated',
            `Your query "${query.title}" has been marked as ${status}.`,
            status === 'CLOSED' ? 'SUCCESS' : 'WARNING',
            '/dashboard/query'
        );

        console.log(`[resolveQuery] Successfully updated query ${id}`);
        res.json(query);
    } catch (error) {
        console.error('[resolveQuery] Error resolving query:', error);
        res.status(500).json({ message: 'Error resolving query', error: String(error) });
    }
};
