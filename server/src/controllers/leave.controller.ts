
import { Request, Response } from 'express';
import { LeaveStatus, LeaveType, Role } from '@prisma/client';
import prisma from '../prisma';
import { notifyUser } from './notification.controller';
import { sendLeaveNotification } from '../services/email.service';

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
            include: { unit: true, studyCenter: true }
        });

        if (!headProfile) return res.status(403).json({ message: 'Profile not found' });

        const unit = headProfile.unit;
        const centerId = headProfile.centerId;

        let leaves = [];

        if (unit && unit.type === 'FACULTY') {
            // Dean: View RECOMMENDED leaves from departments in this faculty
            const facultyCode = unit.code || '';
            const mapping: Record<string, string[]> = {
                'FAC-SCIEN': ['DEP-CS', 'DEP-MTH'],
                'FAC-LAW': ['DEP-LAW'],
                'FAC-SOCIA': ['DEP-POL'],
                'FAC-MANAG': ['DEP-ACC'],
                'FAC-EDUCA': ['DEP-EDT'],
                'FAC-HEALT': ['DEP-PBH'],
                'FAC-AGRIC': ['DEP-AGR'],
                'FAC-ARTS': ['DEP-ART'],
                'FAC-COMPU': ['DEP-CMP']
            };
            const departmentCodes = mapping[facultyCode] || [];
            
            const deptUnits = await prisma.unit.findMany({
                where: { code: { in: departmentCodes } },
                select: { id: true }
            });
            const deptIds = deptUnits.map(d => d.id);

            leaves = await prisma.leaveRequest.findMany({
                where: {
                    status: LeaveStatus.RECOMMENDED,
                    staff: {
                        unitId: { in: deptIds }
                    }
                },
                include: {
                    staff: {
                        select: {
                            user: { select: { name: true, email: true } },
                            level: true,
                            unit: true,
                            studyCenter: true
                        }
                    }
                }
            });
        } else if (unit && unit.type === 'DEPARTMENT') {
            // HOD: View PENDING leaves from staff in this department
            leaves = await prisma.leaveRequest.findMany({
                where: {
                    status: LeaveStatus.PENDING,
                    staff: {
                        unitId: unit.id
                    }
                },
                include: {
                    staff: {
                        select: {
                            user: { select: { name: true, email: true } },
                            level: true,
                            unit: true,
                            studyCenter: true
                        }
                    }
                }
            });
        } else {
            // Study Center Manager or Directorate Director: View PENDING leaves in their unit/center
            leaves = await prisma.leaveRequest.findMany({
                where: {
                    status: LeaveStatus.PENDING,
                    staff: {
                        OR: [
                            ...(unit ? [{ unitId: unit.id }] : []),
                            ...(centerId ? [{ centerId: centerId }] : [])
                        ]
                    }
                },
                include: {
                    staff: {
                        select: {
                            user: { select: { name: true, email: true } },
                            level: true,
                            unit: true,
                            studyCenter: true
                        }
                    }
                }
            });
        }

        res.json(leaves);

    } catch (error) {
        console.error('Error fetching unit leaves:', error);
        res.status(500).json({ message: 'Error fetching pending leaves' });
    }
};

// Approve/Reject/Recommend
export const updateLeaveStatus = async (req: Request, res: Response) => {
    try {
        const { leaveId, status, comment, approvedDays } = req.body; // status: APPROVED | REJECTED | RECOMMENDED
        // @ts-ignore
        const approverId = req.user.id;

        const existingLeave = await prisma.leaveRequest.findUnique({
            where: { id: leaveId },
            include: {
                staff: {
                    include: {
                        user: true
                    }
                }
            }
        });
        if (!existingLeave) return res.status(404).json({ message: 'Leave request not found' });

        let updatedEndDate = existingLeave.endDate;
        let updatedDuration = existingLeave.durationDays;

        if (status === 'APPROVED' && approvedDays) {
            const numDays = parseInt(approvedDays);
            if (numDays > 0 && numDays <= existingLeave.durationDays) {
                updatedDuration = numDays;
                const start = new Date(existingLeave.startDate);
                const newEnd = new Date(start);
                newEnd.setDate(start.getDate() + numDays - 1);
                updatedEndDate = newEnd;
            }
        }

        const leave = await prisma.leaveRequest.update({
            where: { id: leaveId },
            data: {
                status: status as LeaveStatus,
                durationDays: updatedDuration,
                endDate: updatedEndDate,
                ...(status === 'APPROVED' ? { approvedById: approverId } : {}),
                ...(status === 'RECOMMENDED' ? { recommendedById: approverId } : {}),
                ...(status === 'REJECTED' ? { rejectionReason: comment || 'Rejected by supervisor' } : {})
            }
        });

        // Trigger notifications asynchronously
        if (existingLeave.staff?.user) {
            const staffUser = existingLeave.staff.user;
            const staffEmail = staffUser.email;
            const staffName = staffUser.name || 'Staff Member';
            const phone = existingLeave.staff.phone;
            const commentVal = status === 'REJECTED' ? (comment || 'Rejected by supervisor') : comment;

            // 1. Send Email and optional SMS
            sendLeaveNotification(
                staffEmail,
                staffName,
                existingLeave.type,
                status,
                updatedDuration,
                commentVal,
                phone
            ).catch(err => console.error('Failed to send leave email notification:', err));

            // 2. Create In-App Notification
            const statusText = status === 'APPROVED' ? `approved for ${updatedDuration} days` : status === 'RECOMMENDED' ? 'recommended and forwarded for final approval' : 'rejected';
            const nMsg = `Your ${existingLeave.type} leave request has been ${statusText}.${status === 'REJECTED' ? ` Reason: ${commentVal}` : ''}`;
            notifyUser(
                staffUser.id,
                `Leave Request ${status}`,
                nMsg,
                status === 'APPROVED' ? 'SUCCESS' : status === 'REJECTED' ? 'ERROR' : 'INFO',
                '/dashboard/leaves'
            ).catch(err => console.error('Failed to create leave in-app notification:', err));
        }

        res.json({ message: `Leave status updated to ${status}`, leave });

    } catch (error) {
        console.error('Error updating leave:', error);
        res.status(500).json({ message: 'Error updating leave' });
    }
};
