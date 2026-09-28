import { Request, Response } from 'express';
import { RequestStatus, Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import prisma from '../prisma';
import { notifyUser } from './notification.controller';

// Create Request (VC/Registrar/Director/Dean -> HR)
export const createRequest = async (req: Request, res: Response) => {
    try {
        const { staffId, reason } = req.body;
        // @ts-ignore
        const requesterId = req.user.id;

        const staff = await prisma.staffProfile.findUnique({ where: { id: staffId } });
        if (!staff) return res.status(404).json({ message: 'Staff not found' });

        const submittedAt = new Date();
        const expectedResolutionAt = new Date(submittedAt.getTime() + 24 * 3600000); // 24h SLA target

        const request = await prisma.fileRequest.create({
            data: {
                requesterId,
                staffId,
                reason,
                status: RequestStatus.PENDING,
                submittedAt,
                expectedResolutionAt
            }
        });

        // Notify all HR Admins (Registry)
        const hrAdmins = await prisma.user.findMany({
            where: {
                role: { in: [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.REGISTRAR] }
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

        if (![Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.REGISTRAR].includes(approverRole)) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const existing = await prisma.fileRequest.findUnique({ where: { id: requestId } });
        if (!existing) return res.status(404).json({ message: 'File request not found' });

        const token = randomBytes(32).toString('hex');
        const accessLink = `/dashboard/dossier/view?token=${token}`;

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const resolvedAt = new Date();
        const submittedAt = existing.submittedAt || existing.createdAt;
        const turnaroundTimeHours = (resolvedAt.getTime() - submittedAt.getTime()) / (1000 * 60 * 60);
        const slaBreach = existing.expectedResolutionAt ? resolvedAt > existing.expectedResolutionAt : false;

        const request = await prisma.fileRequest.update({
            where: { id: requestId },
            data: {
                status: RequestStatus.APPROVED,
                accessLink,
                expiresAt,
                approvedById: approverId,
                transferredById: approverId,
                resolvedAt,
                turnaroundTimeHours,
                slaBreach
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

        let whereClause: any = {};

        if (req.query.type === 'incoming') {
            if (![Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.REGISTRAR].includes(role)) {
                return res.status(403).json({ message: 'Unauthorized to view incoming requests' });
            }
        } else if (req.query.type === 'received') {
            whereClause.requesterId = userId;
            whereClause.status = RequestStatus.APPROVED;
        } else {
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

        const existing = await prisma.fileRequest.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: 'File request not found' });

        const token = randomBytes(32).toString('hex');
        const accessLink = `/dashboard/dossier/view?token=${token}`;

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const resolvedAt = new Date();
        const submittedAt = existing.submittedAt || existing.createdAt;
        const turnaroundTimeHours = (resolvedAt.getTime() - submittedAt.getTime()) / (1000 * 60 * 60);
        const slaBreach = existing.expectedResolutionAt ? resolvedAt > existing.expectedResolutionAt : false;

        const request = await prisma.fileRequest.update({
            where: { id },
            data: {
                status: RequestStatus.APPROVED,
                accessLink,
                expiresAt,
                approvedById: approverId,
                transferredById: approverId,
                resolvedAt,
                turnaroundTimeHours,
                slaBreach
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

        const existing = await prisma.fileRequest.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: 'File request not found' });

        const resolvedAt = new Date();
        const submittedAt = existing.submittedAt || existing.createdAt;
        const turnaroundTimeHours = (resolvedAt.getTime() - submittedAt.getTime()) / (1000 * 60 * 60);
        const slaBreach = existing.expectedResolutionAt ? resolvedAt > existing.expectedResolutionAt : false;

        const request = await prisma.fileRequest.update({
            where: { id },
            data: {
                status: RequestStatus.REJECTED,
                resolvedAt,
                turnaroundTimeHours,
                slaBreach
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

        // @ts-ignore
        if (fileRequest.requesterId !== userId && ![Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.REGISTRAR].includes(req.user.role)) {
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

        const hrAdmins = await prisma.user.findMany({
            where: {
                role: { in: [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.REGISTRAR] }
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
