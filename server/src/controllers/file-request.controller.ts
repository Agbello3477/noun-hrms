import { Request, Response } from 'express';
import { RequestStatus, Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import prisma from '../prisma';
import { notifyUser } from './notification.controller';

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

        // Notify all HR Admins (Registry)
        const hrAdmins = await prisma.user.findMany({
            where: {
                role: { in: [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN] }
            }
        });

        const staffName = `${staff.surname || ''} ${staff.otherNames || ''}`.trim() || 'Staff';
        const requester = await prisma.user.findUnique({ where: { id: requesterId } });
        const requesterName = requester?.name || 'A Manager';

        for (const hr of hrAdmins) {
            await notifyUser(
                hr.id,
                'New File Request',
                `A file request has been created for staff ${staffName} by ${requesterName}.`,
                'INFO',
                '/dashboard/registry/file-requests'
            );
        }

        res.status(201).json(request);
    } catch (error) {
        console.error('Error creating request', error);
        res.status(500).json({ message: 'Error creating request' });
    }
};

// Approve Request (HR -> Requester)
export const approveRequest = async (req: Request, res: Response) => {
    try {
        const { requestId } = req.body;
        // @ts-ignore
        const approverRole = req.user.role;
        // @ts-ignore
        const approverId = req.user.id;

        // Role Check logic is in routes, but double check
        if (![Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN].includes(approverRole)) {
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
                expiresAt,
                approvedById: approverId,
                transferredById: approverId
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
            if (![Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN].includes(role)) {
                return res.status(403).json({ message: 'Unauthorized to view incoming requests' });
            }
            // Show all pending or recently processed
            // No user filter needed, show ALL
        } else if (req.query.type === 'received') {
            // Requesters viewing approved files in their dashboard
            whereClause.requesterId = userId;
            whereClause.status = RequestStatus.APPROVED;
        } else {
            // Requesters viewing their history (VC, Registrar, etc)
            whereClause.requesterId = userId;
        }

        const requests = await prisma.fileRequest.findMany({
            where: whereClause,
            include: {
                staff: { select: { surname: true, otherNames: true, staffId: true, id: true } },
                requester: {
                    select: {
                        name: true,
                        role: true,
                        staffProfile: {
                            select: {
                                unit: { select: { name: true } },
                                studyCenter: { select: { name: true } }
                            }
                        }
                    }
                },
                approvedBy: { select: { name: true } },
                transferredBy: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(requests);

    } catch (error) {
        res.status(500).json({ message: 'Error fetching requests' });
    }
};

// Approve Request (REST Endpoint - PUT /api/file-requests/:id/approve)
export const approveRequestRoute = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const approverId = req.user.id;

        // Generate Secure Link (Mock logic for now)
        const token = randomBytes(32).toString('hex');
        const accessLink = `/dashboard/dossier/view?token=${token}`;

        // Expiry: 24 hours
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const request = await prisma.fileRequest.update({
            where: { id },
            data: {
                status: RequestStatus.APPROVED,
                accessLink,
                expiresAt,
                approvedById: approverId,
                transferredById: approverId
            }
        });

        res.json({ message: 'Request approved successfully', request });
    } catch (error) {
        res.status(500).json({ message: 'Error approving request' });
    }
};

// Reject Request (REST Endpoint - PUT /api/file-requests/:id/reject)
export const rejectRequestRoute = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const request = await prisma.fileRequest.update({
            where: { id },
            data: {
                status: RequestStatus.REJECTED
            }
        });

        res.json({ message: 'Request rejected successfully', request });
    } catch (error) {
        res.status(500).json({ message: 'Error rejecting request' });
    }
};

// Return Request (REST Endpoint - PUT /api/file-requests/:id/return)
export const returnRequest = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const userId = req.user.id;

        const fileRequest = await prisma.fileRequest.findUnique({
            where: { id },
            include: { requester: true }
        });

        if (!fileRequest) {
            return res.status(404).json({ message: 'File request not found' });
        }

        // Verify permission: only the original requester or HR can return the file
        // @ts-ignore
        if (fileRequest.requesterId !== userId && ![Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN].includes(req.user.role)) {
            return res.status(403).json({ message: 'Unauthorized to return this file' });
        }

        const request = await prisma.fileRequest.update({
            where: { id },
            data: {
                status: RequestStatus.RETURNED,
                accessLink: null,
                expiresAt: null
            }
        });

        // Notify all HR Admins (Registry)
        const hrAdmins = await prisma.user.findMany({
            where: {
                role: { in: [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN] }
            }
        });

        const requesterName = fileRequest.requester?.name || 'A Manager';
        const staffProfile = await prisma.staffProfile.findUnique({ where: { id: fileRequest.staffId } });
        const staffName = staffProfile ? `${staffProfile.surname || ''} ${staffProfile.otherNames || ''}`.trim() : 'Staff';

        for (const hr of hrAdmins) {
            await notifyUser(
                hr.id,
                'File Returned to HR',
                `The file for ${staffName} has been returned to HR by ${requesterName}.`,
                'SUCCESS',
                '/dashboard/registry/file-requests'
            );
        }

        res.json({ message: 'File returned successfully', request });
    } catch (error) {
        console.error('Error returning request', error);
        res.status(500).json({ message: 'Error returning file' });
    }
};
