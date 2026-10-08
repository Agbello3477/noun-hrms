import { Request, Response } from 'express';
import prisma from '../prisma';
import { Role } from '@prisma/client';
import { sendPushNotification } from '../services/fcm.service';

interface AuthRequest extends Request {
    user?: {
        id: string;
        role: Role;
    };
}

export const getRoster = async (req: AuthRequest, res: Response) => {
    try {
        const roster = await prisma.securityRoster.findMany({
            include: {
                user: {
                    select: { name: true, email: true }
                }
            },
            orderBy: { date: 'desc' },
            take: 200
        });
        res.json(roster);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to fetch rosters' });
    }
};

export const createRoster = async (req: AuthRequest, res: Response) => {
    const { userId, shift, zone, date } = req.body;
    const assignedById = req.user?.id;

    try {
        const roster = await prisma.securityRoster.create({
            data: {
                userId,
                shift,
                zone,
                date: new Date(date),
                assignedById: assignedById || ''
            }
        });
        res.status(201).json(roster);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to assign shift roster' });
    }
};

export const getIncidents = async (req: AuthRequest, res: Response) => {
    const { status, priority, page, limit } = req.query;

    try {
        const pageNum = page ? parseInt(String(page)) : 1;
        const limitNum = Math.min(parseInt(String(limit || 25)), 25);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            ...(status ? { status: String(status) } : {}),
            ...(priority ? { priority: String(priority) } : {})
        };

        const [total, incidents] = await Promise.all([
            prisma.securityIncident.count({ where }),
            prisma.securityIncident.findMany({
                where,
                select: {
                    id: true,
                    title: true,
                    description: true,
                    category: true,
                    priority: true,
                    status: true,
                    location: true,
                    attachmentUrl: true,
                    createdAt: true,
                    reporter: {
                        select: { name: true, email: true }
                    },
                    assignedTo: {
                        select: { name: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum
            })
        ]);

        res.setHeader('X-Total-Count', total.toString());
        res.setHeader('X-Total-Pages', Math.ceil(total / limitNum).toString());
        res.setHeader('X-Current-Page', pageNum.toString());

        res.json(incidents);
    } catch (error: any) {
        console.error('Failed to fetch security incidents:', error);
        res.status(500).json({ message: 'Failed to fetch security incidents' });
    }
};

export const createIncident = async (req: AuthRequest, res: Response) => {
    const { title, description, category, location, attachmentUrl, isAnonymous } = req.body;
    const user = req.user;

    if (!title || !description || !location) {
        return res.status(400).json({ message: 'Headline, location, and description are required' });
    }

    try {
        // Verify user exists in database for valid FK relation if not anonymous
        let validReporterId: string | null = null;
        let reporterDisplayName: string | undefined = undefined;

        if (!isAnonymous && user?.id) {
            const existingUser = await prisma.user.findUnique({
                where: { id: user.id },
                select: { id: true, name: true, email: true }
            });
            if (existingUser) {
                validReporterId = existingUser.id;
                reporterDisplayName = existingUser.name || existingUser.email;
            }
        } else if (isAnonymous) {
            reporterDisplayName = 'Anonymous Reporter';
        }

        const incident = await prisma.securityIncident.create({
            data: {
                title: title.trim(),
                description: description.trim(),
                category: category || 'SUSPICIOUS_ACTIVITY',
                location: location.trim(),
                attachmentUrl: attachmentUrl?.trim() || null,
                reporterId: validReporterId,
                reporterName: reporterDisplayName
            }
        });

        // Trigger real-time alert notifications asynchronously in background
        (async () => {
            try {
                const securityHeads = await prisma.user.findMany({
                    where: { 
                        OR: [
                            { role: Role.SECURITY_HEAD },
                            { role: Role.SUPER_USER },
                            { role: Role.ADMIN }
                        ]
                    }
                });

                for (const head of securityHeads) {
                    await prisma.notification.create({
                        data: {
                            userId: head.id,
                            title: `🚨 Incident Reported: ${category || 'Security Alert'}`,
                            message: `${title} at ${location}. Priority evaluation required.`,
                            type: 'WARNING',
                            link: `/dashboard/security`
                        }
                    });
                }

                if (securityHeads.length > 0) {
                    sendPushNotification(
                        securityHeads.map(h => h.id),
                        `🚨 Incident Reported: ${category || 'Security Alert'}`,
                        `${title} at ${location}. Priority evaluation required.`,
                        `/dashboard/security`
                    ).catch(err => console.error('FCM push failed:', err));
                }
            } catch (notifyErr) {
                console.error('Failed to dispatch incident notifications:', notifyErr);
            }
        })();

        res.status(201).json(incident);
    } catch (error: any) {
        console.error('Failed to record incident report:', error);
        res.status(500).json({ message: error?.message || 'Failed to record incident report' });
    }
};

export const updateIncident = async (req: AuthRequest, res: Response) => {
    const { incidentId, priority, status, assignedToId, assignedOfficerIds } = req.body;

    try {
        const incident = await prisma.securityIncident.findUnique({
            where: { id: incidentId }
        });

        if (!incident) return res.status(404).json({ message: 'Incident not found' });

        let finalAssignedToId = assignedToId;
        if (assignedOfficerIds) {
            const officerIds = assignedOfficerIds.split(',').map((id: string) => id.trim()).filter(Boolean);
            if (officerIds.length > 0) {
                finalAssignedToId = officerIds[0];
            }
        }

        const updated = await prisma.securityIncident.update({
            where: { id: incidentId },
            data: {
                ...(priority ? { priority } : {}),
                ...(status ? { status } : {}),
                ...(finalAssignedToId ? { assignedToId: finalAssignedToId } : {}),
                ...(assignedOfficerIds !== undefined ? { assignedOfficerIds } : {})
            }
        });

        // Notify all assigned field officers
        if (assignedOfficerIds) {
            const officerIds = assignedOfficerIds.split(',').map((id: string) => id.trim()).filter(Boolean);
            const oldOfficerIds = incident.assignedOfficerIds 
                ? incident.assignedOfficerIds.split(',').map((id: string) => id.trim()).filter(Boolean) 
                : [];
            
            const newOfficers = officerIds.filter((id: string) => !oldOfficerIds.includes(id));
            
            for (const officerId of newOfficers) {
                await prisma.notification.create({
                    data: {
                        userId: officerId,
                        title: 'New Security Incident Assignment',
                        message: `You have been dispatched to investigate: ${incident.title} at ${incident.location}.`,
                        type: 'WARNING'
                    }
                });
            }

            if (newOfficers.length > 0) {
                sendPushNotification(
                    newOfficers,
                    'New Security Incident Assignment',
                    `You have been dispatched to investigate: ${incident.title} at ${incident.location}.`,
                    `/dashboard/security/command`
                ).catch(err => console.error('FCM push failed:', err));
            }
        } else if (assignedToId && assignedToId !== incident.assignedToId) {
            // Legacy single officer fallback notification
            await prisma.notification.create({
                data: {
                    userId: assignedToId,
                    title: 'New Security Incident Assignment',
                    message: `You have been dispatched to investigate: ${incident.title} at ${incident.location}.`,
                    type: 'WARNING'
                }
            });

            sendPushNotification(
                [assignedToId],
                'New Security Incident Assignment',
                `You have been dispatched to investigate: ${incident.title} at ${incident.location}.`,
                `/dashboard/security/command`
            ).catch(err => console.error('FCM push failed:', err));
        }

        // Alert Security Head on high priority updates
        if (priority === 'HIGH' && incident.priority !== 'HIGH') {
            const securityHeads = await prisma.user.findMany({
                where: { role: Role.SECURITY_HEAD }
            });
            for (const head of securityHeads) {
                await prisma.notification.create({
                    data: {
                        userId: head.id,
                        title: '⚠️ CRITICAL: Threat Priority Escalation',
                        message: `Incident ${incident.title} at ${incident.location} has been raised to HIGH priority.`,
                        type: 'ERROR'
                    }
                });
            }

            sendPushNotification(
                securityHeads.map(h => h.id),
                '⚠️ CRITICAL: Threat Priority Escalation',
                `Incident ${incident.title} at ${incident.location} has been raised to HIGH priority.`,
                `/dashboard/security/command`
            ).catch(err => console.error('FCM push failed:', err));
        }

        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to update incident details' });
    }
};

export const createConsolidatedReport = async (req: AuthRequest, res: Response) => {
    const { startDate, endDate, summary, recommendations } = req.body;
    const authorId = req.user?.id;

    try {
        // Parallelise the two count queries — eliminates one serial DB round trip
        const dateRange = {
            gte: new Date(startDate),
            lte: new Date(endDate)
        };
        const [totalIncidents, highPriorityIncidents] = await Promise.all([
            prisma.securityIncident.count({ where: { createdAt: dateRange } }),
            prisma.securityIncident.count({ where: { priority: 'HIGH', createdAt: dateRange } })
        ]);

        const report = await prisma.consolidatedSecurityReport.create({
            data: {
                authorId: authorId || '',
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                summary,
                totalIncidents,
                highPriorityIncidents,
                recommendations
            }
        });

        // Trigger system notification to the Vice Chancellor (VC)
        const vcUsers = await prisma.user.findMany({
            where: { role: Role.VICE_CHANCELLOR },
            select: { id: true }
        });

        if (vcUsers.length > 0) {
            // createMany eliminates N serial DB writes
            await prisma.notification.createMany({
                data: vcUsers.map(vc => ({
                    userId: vc.id,
                    title: 'New Consolidated Security Report',
                    message: `Security Head has submitted the latest consolidated security intelligence report.`,
                    type: 'INFO',
                    link: `/dashboard/security/reports`
                }))
            });
        }

        sendPushNotification(
            vcUsers.map(v => v.id),
            'New Consolidated Security Report',
            `Security Head has submitted the latest consolidated security intelligence report.`,
            `/dashboard/security/reports`
        ).catch(err => console.error('FCM push failed:', err));

        res.status(201).json(report);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to compile consolidated report' });
    }
};

export const getConsolidatedReports = async (req: AuthRequest, res: Response) => {
    try {
        const reports = await prisma.consolidatedSecurityReport.findMany({
            include: {
                author: {
                    select: { name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(reports);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to fetch consolidated reports' });
    }
};
