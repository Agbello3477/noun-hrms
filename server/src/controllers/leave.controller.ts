
import { Request, Response } from 'express';
import { PrismaClient, LeaveStatus, LeaveType, Role } from '@prisma/client';

const prisma = new PrismaClient();

// Apply for Leave
export const applyForLeave = async (req: Request, res: Response) => {
    try {
        const { type, startDate, endDate, reason } = req.body;
        // @ts-ignore
        const userId = req.user.id;

        const staffProfile = await prisma.staffProfile.findUnique({ where: { userId } });
        if (!staffProfile) return res.status(400).json({ message: 'Staff profile not found' });

        // Validation...
        if (new Date(startDate) >= new Date(endDate)) {
            return res.status(400).json({ message: 'End date must be after start date' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1;

        const leave = await prisma.leaveRequest.create({
            data: {
                staffId: staffProfile.id,
                type: type as LeaveType,
                startDate: start,
                endDate: end,
                durationDays,
                reason,
                status: LeaveStatus.PENDING
            }
        });

        res.status(201).json({ message: 'Leave request submitted', leave });
    } catch (error) {
        console.error('Leave Apply Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Get My Leaves
export const getMyLeaves = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user.id;
        const staffProfile = await prisma.staffProfile.findUnique({ where: { userId } });
        if (!staffProfile) return res.status(200).json([]); // No profile, no leaves

        const leaves = await prisma.leaveRequest.findMany({
            where: { staffId: staffProfile.id },
            orderBy: { createdAt: 'desc' }
        });
        res.json(leaves);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching leaves' });
    }
};

// Unit Head: Get Pending Requests
export const getUnitPendingLeaves = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user.id;

        const headProfile = await prisma.staffProfile.findUnique({
            where: { userId },
            select: { unitId: true, centerId: true }
        });

        if (!headProfile) return res.status(403).json({ message: 'Profile not found' });

        const leaves = await prisma.leaveRequest.findMany({
            where: {
                status: LeaveStatus.PENDING,
                staff: {
                    OR: [
                        // If head has unitId, show unit requests. If head has centerId (Manager), show center requests.
                        ...(headProfile.unitId ? [{ unitId: headProfile.unitId }] : []),
                        ...(headProfile.centerId ? [{ centerId: headProfile.centerId }] : [])
                    ]
                }
            },
            include: {
                staff: {
                    select: {
                        user: { select: { name: true, email: true } },
                        level: true,
                        department: true // or unit/center
                    }
                }
            }
        });

        res.json(leaves);

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error fetching pending leaves' });
    }
};

// Approve/Reject
export const updateLeaveStatus = async (req: Request, res: Response) => {
    try {
        const { leaveId, status, comment } = req.body; // status: APPROVED | REJECTED | RECOMMENDED
        // @ts-ignore
        const approverId = req.user.id;

        const leave = await prisma.leaveRequest.update({
            where: { id: leaveId },
            data: {
                status: status as LeaveStatus,
                approvedById: status === 'APPROVED' ? approverId : undefined
                // If we had a generic 'comments' field in schema we'd add it
            }
        });

        // Notify User (EmailService TODO)

        res.json({ message: `Leave ${status}`, leave });

    } catch (error) {
        res.status(500).json({ message: 'Error updating leave' });
    }
};
