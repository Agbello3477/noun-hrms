import { Request, Response } from 'express';
import { PrismaClient, QueryStatus, Role } from '@prisma/client';
import { StorageService } from '../services/storage.service';
import { notifyUser } from './notification.controller';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
    user?: { id: string; role: string };
}

// Issue Query (HR -> Staff)
export const issueQuery = async (req: AuthRequest, res: Response) => {
    try {
        const { staffId, title, content } = req.body;
        const issuerId = req.user?.id;

        // Validation
        const staff = await prisma.staffProfile.findUnique({ where: { id: staffId } });
        if (!staff) return res.status(404).json({ message: 'Staff profile not found' });

        const query = await prisma.staffQuery.create({
            data: {
                staffId,
                issuedById: issuerId!,
                title,
                content,
                status: QueryStatus.OPEN
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
        const { staffId } = req.query;

        let whereClause: any = {};

        // If I am HR Administrator, I can see all, or filter by staffId
        const allowedRoles: string[] = [Role.HR_ADMIN, Role.SUPER_USER];
        if (allowedRoles.includes(role as string)) {
            if (staffId) whereClause.staffId = staffId;
        } else {
            // I am regular staff (or unit head), I only see my own queries
            // Need to find my staffProfile id
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
        res.status(500).json({ message: 'Error fetching queries' });
    }
};

// Resolve Query (HR Only)
export const resolveQuery = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // Expect 'CLOSED' or 'ESCALATED'

        console.log(`[resolveQuery] Attempting to resolve query ${id} with status: ${status}`);

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
