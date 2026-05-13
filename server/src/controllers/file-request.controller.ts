import { Request, Response } from 'express';
import { PrismaClient, RequestStatus, Role } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

// Create Request (VC/Registrar -> HR)
export const createRequest = async (req: Request, res: Response) => {
    try {
        const { staffId, reason } = req.body;
        // @ts-ignore
        const requesterId = req.user.id;

        // Validation: Verify staff exists
        const staff = await prisma.staffProfile.findUnique({ where: { id: staffId } });
        if (!staff) return res.status(404).json({ message: 'Staff not found' });

        const request = await prisma.fileRequest.create({
            data: {
                requesterId,
                staffId,
                reason,
                status: RequestStatus.PENDING
            }
        });

        // TODO: Notify HR Admin (Socket/Email)

        res.status(201).json(request);
    } catch (error) {
        res.status(500).json({ message: 'Error creating request' });
    }
};

// Approve Request (HR -> Requester)
export const approveRequest = async (req: Request, res: Response) => {
    try {
        const { requestId } = req.body;
        // @ts-ignore
        const approverRole = req.user.role;

        // Role Check logic is in routes, but double check
        if (![Role.HR_ADMIN, Role.SUPER_USER].includes(approverRole)) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Generate Secure Link (Mock logic for now)
        // In reality, this would be a signed URL or a temporary token
        const token = randomBytes(32).toString('hex');
        const accessLink = `/dashboard/dossier/view?token=${token}`;

        // Expiry: 24 hours
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const request = await prisma.fileRequest.update({
            where: { id: requestId },
            data: {
                status: RequestStatus.APPROVED,
                accessLink,
                expiresAt
            }
        });

        res.json({ message: 'Request approved', request });

    } catch (error) {
        res.status(500).json({ message: 'Error approving request' });
    }
};

// Get Requests (Tabbed View)
export const getRequests = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user.id;
        // @ts-ignore
        const role = req.user.role;

        // If I am requester, show my outgoing. If I am HR, show incoming.
        let whereClause: any = {};

        if (req.query.type === 'incoming') {
            // HR Viewing incoming Queue
            if (![Role.HR_ADMIN, Role.SUPER_USER].includes(role)) {
                return res.status(403).json({ message: 'Unauthorized to view incoming requests' });
            }
            // Show all pending or recently processed
            // No user filter needed, show ALL
        } else {
            // Requesters viewing their history (VC, Registrar, etc)
            whereClause.requesterId = userId;
        }

        const requests = await prisma.fileRequest.findMany({
            where: whereClause,
            include: {
                staff: { select: { surname: true, otherNames: true, staffId: true } },
                requester: { select: { name: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(requests);

    } catch (error) {
        res.status(500).json({ message: 'Error fetching requests' });
    }
};
