import { Request, Response } from 'express';
import prisma from '../prisma';
import { sendPushNotification } from '../services/fcm.service';
import { jobQueueService } from '../services/jobQueue.service';

interface AuthRequest extends Request {
    user?: { id: string; role: string };
}

// Format date into human readable standard (e.g. 01 Jan 2026)
const formatDateStr = (d: Date | string): string => {
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Registry / HR creates a new Annual Leave Exercise Session
 * POST /api/v1/leave/sessions
 */
export const createLeaveSession = async (req: AuthRequest, res: Response) => {
    try {
        const { title, year, startDate, endDate } = req.body;

        if (!title || !year || !startDate || !endDate) {
            return res.status(400).json({ message: 'Title, year, start date, and end date are required.' });
        }

        const parsedYear = parseInt(year, 10);
        if (isNaN(parsedYear)) {
            return res.status(400).json({ message: 'Year must be a valid integer.' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ message: 'Invalid start date or end date.' });
        }

        if (start > end) {
            return res.status(400).json({ message: 'End date must be greater than or equal to start date.' });
        }

        const existing = await prisma.leaveSession.findFirst({ where: { year: parsedYear } });
        if (existing) {
            return res.status(400).json({ message: `Leave session for year ${parsedYear} already exists.` });
        }

        const session = await prisma.leaveSession.create({
            data: {
                title: title.trim(),
                year: parsedYear,
                startDate: start,
                endDate: end,
                isActive: false
            }
        });

        res.status(201).json({
            success: true,
            data: session,
            message: `Leave session for ${parsedYear} created successfully.`
        });
    } catch (error: any) {
        console.error('Error creating leave session:', error);
        res.status(500).json({ message: error.message || 'Error creating leave session.' });
    }
};

/**
 * Registry / HR updates or toggles a Leave Session (Active / Inactive)
 * PUT /api/v1/leave/sessions/:id
 */
export const updateLeaveSession = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, startDate, endDate, isActive } = req.body;

        const existingSession = await prisma.leaveSession.findUnique({ where: { id } });
        if (!existingSession) {
            return res.status(404).json({ message: 'Leave session not found.' });
        }

        const isTransitioningToActive = isActive === true && !existingSession.isActive;

        // If activating, deactivate other sessions so only one active session exists at a time
        if (isActive === true) {
            await prisma.leaveSession.updateMany({
                where: { id: { not: id } },
                data: { isActive: false }
            });
        }

        const session = await prisma.leaveSession.update({
            where: { id },
            data: {
                title: title ? title.trim() : undefined,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                isActive: typeof isActive === 'boolean' ? isActive : undefined
            }
        });

        // If registry toggled the session ON, notify all active university staff
        if (isTransitioningToActive) {
            (async () => {
                try {
                    const activeUsers = await prisma.user.findMany({
                        where: {
                            isActive: true,
                            staffProfile: {
                                isNot: null
                            }
                        },
                        include: {
                            staffProfile: true
                        }
                    });

                    const formattedStartDate = formatDateStr(session.startDate);
                    const formattedEndDate = formatDateStr(session.endDate);

                    const notificationTitle = `Registry Annual Leave Application Exercise Opened`;
                    const notificationMessage = `Registry leave application is open for ${session.year} from ${formattedStartDate} to ${formattedEndDate}. You can now submit your statutory leave application.`;
                    const link = '/dashboard/leaves';

                    // 1. Bulk insert in-app notifications
                    const notificationsData = activeUsers.map(staffUser => ({
                        userId: staffUser.id,
                        title: notificationTitle,
                        message: notificationMessage,
                        type: 'INFO',
                        link
                    }));

                    if (notificationsData.length > 0) {
                        await prisma.notification.createMany({
                            data: notificationsData
                        });

                        // 2. Dispatch bulk FCM Push Notifications asynchronously
                        sendPushNotification(
                            activeUsers.map(u => u.id),
                            notificationTitle,
                            notificationMessage,
                            link
                        ).catch(err => {
                            console.error('Failed to dispatch bulk FCM push notifications for leave session:', err);
                        });
                    }

                    // 3. Queue emails asynchronously via background job queue
                    for (const staffUser of activeUsers) {
                        if (staffUser.email) {
                            const name = staffUser.name || [
                                staffUser.staffProfile?.title,
                                staffUser.staffProfile?.surname,
                                staffUser.staffProfile?.otherNames
                            ].filter(Boolean).join(' ') || 'Staff Member';

                            await jobQueueService.enqueue('SEND_LEAVE_SESSION_EMAIL', {
                                email: staffUser.email,
                                name,
                                sessionTitle: session.title,
                                year: session.year,
                                startDate: session.startDate.toISOString(),
                                endDate: session.endDate.toISOString()
                            });
                        }
                    }
                } catch (notifyErr) {
                    console.error('Error dispatching Leave session notifications:', notifyErr);
                }
            })();
        }

        res.json({
            success: true,
            data: session,
            message: `Leave session updated successfully.${isTransitioningToActive ? ' Broadcast notification sent to all staff.' : ''}`
        });
    } catch (error: any) {
        console.error('Error updating leave session:', error);
        res.status(500).json({ message: error.message || 'Error updating leave session.' });
    }
};

/**
 * Get all leave sessions
 * GET /api/v1/leave/sessions
 */
export const getLeaveSessions = async (req: Request, res: Response) => {
    try {
        const sessions = await prisma.leaveSession.findMany({
            orderBy: { year: 'desc' }
        });
        res.json(sessions);
    } catch (error: any) {
        console.error('Error fetching leave sessions:', error);
        res.status(500).json({ message: 'Error fetching leave sessions.' });
    }
};

/**
 * Get currently active leave session
 * GET /api/v1/leave/sessions/active
 */
export const getActiveLeaveSession = async (req: Request, res: Response) => {
    try {
        const session = await prisma.leaveSession.findFirst({
            where: { isActive: true }
        });
        res.json(session || null);
    } catch (error: any) {
        console.error('Error fetching active leave session:', error);
        res.status(500).json({ message: 'Error fetching active leave session.' });
    }
};

/**
 * Delete a leave session
 * DELETE /api/v1/leave/sessions/:id
 */
export const deleteLeaveSession = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const session = await prisma.leaveSession.findUnique({ where: { id } });

        if (!session) {
            return res.status(404).json({ message: 'Leave session not found.' });
        }

        if (session.isActive) {
            return res.status(400).json({ message: 'Cannot delete an active leave session. Please deactivate it first.' });
        }

        await prisma.leaveSession.delete({ where: { id } });
        res.json({ success: true, message: 'Leave session deleted successfully.' });
    } catch (error: any) {
        console.error('Error deleting leave session:', error);
        res.status(500).json({ message: 'Error deleting leave session.' });
    }
};
