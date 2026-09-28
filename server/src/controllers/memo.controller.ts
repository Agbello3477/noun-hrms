import { Request, Response } from 'express';
import prisma from '../prisma';
import { StorageService } from '../services/storage.service';
import { sendPushNotification } from '../services/fcm.service';
import { Role } from '@prisma/client';

const formatMemoSenderName = (memo: any) => {
    if (!memo || !memo.sender) return memo;
    const role = memo.sender.role;
    const profile = memo.sender.staffProfile;

    if (['SUPER_USER', 'HR_ADMIN', 'ADMIN', 'REGISTRAR'].includes(role)) {
        memo.sender.name = 'Human Resource Registry';
    } else if (profile) {
        if (profile.studyCenter?.name) {
            memo.sender.name = profile.studyCenter.name;
        } else if (profile.unit?.name) {
            memo.sender.name = profile.unit.name;
        }
    }
    return memo;
};

/**
 * Resolves audience user IDs given targetAudience identifier
 */
async function resolveAudienceUserIds(targetAudience: string): Promise<string[]> {
    if (targetAudience === 'ALL_STAFF') {
        const users = await prisma.user.findMany({
            where: { isActive: true },
            select: { id: true }
        });
        return users.map(u => u.id);
    }

    if (targetAudience === 'DIRECTORS_ONLY') {
        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                OR: [
                    { staffProfile: { rank: { contains: 'Director', mode: 'insensitive' } } },
                    { role: Role.UNIT_HEAD, staffProfile: { unit: { type: 'DIRECTORATE' } } }
                ]
            },
            select: { id: true }
        });
        return users.map(u => u.id);
    }

    if (targetAudience === 'DEANS_ONLY') {
        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                OR: [
                    { staffProfile: { rank: { contains: 'Dean', mode: 'insensitive' } } },
                    { role: Role.UNIT_HEAD, staffProfile: { unit: { type: 'FACULTY' } } }
                ]
            },
            select: { id: true }
        });
        return users.map(u => u.id);
    }

    if (targetAudience === 'DIRECTORS_AND_DEANS') {
        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                OR: [
                    { staffProfile: { rank: { contains: 'Director', mode: 'insensitive' } } },
                    { staffProfile: { rank: { contains: 'Dean', mode: 'insensitive' } } },
                    { role: Role.UNIT_HEAD, staffProfile: { unit: { type: { in: ['DIRECTORATE', 'FACULTY'] } } } }
                ]
            },
            select: { id: true }
        });
        return users.map(u => u.id);
    }

    if (targetAudience === 'HEADS_OF_DEPARTMENT_ONLY') {
        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                role: Role.UNIT_HEAD,
                staffProfile: { unit: { type: 'DEPARTMENT' } }
            },
            select: { id: true }
        });
        return users.map(u => u.id);
    }

    if (targetAudience === 'STUDY_CENTER_DIRECTORS_ALL') {
        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                role: Role.STUDY_CENTER_MANAGER
            },
            select: { id: true }
        });
        return users.map(u => u.id);
    }

    return [];
}

// Create a new general or targeted memo
export const createMemo = async (req: Request, res: Response) => {
    try {
        const { title, content, recipientId, recipientIds, targetAudience } = req.body;
        // @ts-ignore
        const senderId = req.user?.id;

        if (!title || !content) {
            return res.status(400).json({ message: 'Title and content are required' });
        }

        let allowResponses = true;
        if (req.body.allowResponses !== undefined) {
            allowResponses = req.body.allowResponses === 'true' || req.body.allowResponses === true;
        }

        const file = req.file;
        let attachmentUrl = null;
        let attachmentName = null;
        if (file) {
            attachmentUrl = await StorageService.uploadFile(file);
            attachmentName = file.originalname;
        }

        let parsedRecipientIds: string[] = [];
        if (targetAudience && targetAudience !== 'CUSTOM_RECIPIENTS' && targetAudience !== 'ALL_STAFF') {
            parsedRecipientIds = await resolveAudienceUserIds(targetAudience);
        } else if (recipientIds) {
            if (Array.isArray(recipientIds)) {
                parsedRecipientIds = recipientIds.map(s => String(s).trim()).filter(Boolean);
            } else if (typeof recipientIds === 'string') {
                try {
                    const parsed = JSON.parse(recipientIds);
                    if (Array.isArray(parsed)) {
                        parsedRecipientIds = parsed.map(s => String(s).trim()).filter(Boolean);
                    } else if (typeof parsed === 'string' && parsed.trim()) {
                        parsedRecipientIds = [parsed.trim()];
                    } else {
                        parsedRecipientIds = [recipientIds.trim()];
                    }
                } catch {
                    parsedRecipientIds = recipientIds.split(',').map(s => s.trim()).filter(Boolean);
                }
            }
        } else if (recipientId && typeof recipientId === 'string' && recipientId.trim()) {
            parsedRecipientIds = [recipientId.trim()];
        }

        // @ts-ignore
        const senderRole = req.user?.role;
        const isHR = ['SUPER_USER', 'HR_ADMIN', 'ADMIN', 'VICE_CHANCELLOR', 'REGISTRAR'].includes(senderRole);

        let managerProfile = null;
        if (!isHR) {
            managerProfile = await prisma.staffProfile.findUnique({
                where: { userId: senderId }
            });
            if (!managerProfile || (!managerProfile.unitId && !managerProfile.centerId)) {
                return res.status(400).json({ message: 'Your manager profile is not associated with any unit or study center' });
            }
        }

        const isUnivBroadcast = req.body.isUniversityBroadcast === 'true' || req.body.isUniversityBroadcast === true || targetAudience === 'ALL_STAFF';

        // Enforce boundary checks for Unit Managers
        if (!isHR && managerProfile) {
            if (isUnivBroadcast) {
                parsedRecipientIds = [];
            } else if (parsedRecipientIds.length > 0) {
                const recipientsProfiles = await prisma.staffProfile.findMany({
                    where: {
                        userId: { in: parsedRecipientIds }
                    },
                    select: { 
                        userId: true, 
                        unitId: true, 
                        centerId: true,
                        user: { select: { role: true } }
                    }
                });

                const invalidRecipient = recipientsProfiles.find(p => {
                    const sameUnit = managerProfile.unitId && p.unitId === managerProfile.unitId;
                    const sameCenter = managerProfile.centerId && p.centerId === managerProfile.centerId;
                    const isManagerOrAdmin = ['UNIT_HEAD', 'STUDY_CENTER_MANAGER', 'UNIT_ADMIN', 'HR_ADMIN', 'SUPER_USER', 'ADMIN', 'VICE_CHANCELLOR', 'REGISTRAR'].includes(p.user.role);
                    return !sameUnit && !sameCenter && !isManagerOrAdmin;
                });

                if (invalidRecipient || recipientsProfiles.length !== parsedRecipientIds.length) {
                    return res.status(403).json({ message: 'Unauthorized: You can only send memos to staff in your own unit/center or to university managers' });
                }
            } else {
                const unitStaffProfiles = await prisma.staffProfile.findMany({
                    where: {
                        OR: [
                            ...(managerProfile.unitId ? [{ unitId: managerProfile.unitId }] : []),
                            ...(managerProfile.centerId ? [{ centerId: managerProfile.centerId }] : [])
                        ],
                        user: { isActive: true }
                    },
                    select: { userId: true }
                });

                const recipientUserIds = unitStaffProfiles
                    .map(p => p.userId)
                    .filter(id => id !== senderId);

                if (recipientUserIds.length === 0) {
                    return res.status(400).json({ message: 'No staff members found in your unit/center to send the memo to' });
                }

                parsedRecipientIds = recipientUserIds;
            }
        }

        // Handle targeted recipient dispatch
        if (parsedRecipientIds.length > 0) {
            const validRecipients = await prisma.user.findMany({
                where: {
                    id: { in: parsedRecipientIds },
                    isActive: true
                },
                select: { id: true }
            });

            const memo = await prisma.memo.create({
                data: {
                    title,
                    content,
                    allowResponses: allowResponses,
                    senderId,
                    recipientId: parsedRecipientIds.length === 1 ? parsedRecipientIds[0] : null,
                    targetAudience: targetAudience || 'CUSTOM_RECIPIENTS',
                    attachmentUrl,
                    attachmentName
                }
            });

            // Create in-app notifications for each recipient
            const notificationsData = validRecipients.map(u => ({
                userId: u.id,
                title: targetAudience ? `Official Registry Memo: ${title}` : 'New Private Memo',
                message: title,
                type: 'INFO',
                link: `/dashboard/memos?id=${memo.id}`
            }));

            if (notificationsData.length > 0) {
                const chunkSize = 100;
                for (let i = 0; i < notificationsData.length; i += chunkSize) {
                    await prisma.notification.createMany({
                        data: notificationsData.slice(i, i + chunkSize)
                    });
                }
            }

            sendPushNotification(
                validRecipients.map(u => u.id),
                'New Official Memo',
                title,
                `/dashboard/memos?id=${memo.id}`
            ).catch(err => console.error('FCM push failed:', err));

            return res.status(201).json(memo);
        }

        // General Broadcast Memo
        const memo = await prisma.memo.create({
            data: {
                title,
                content,
                allowResponses: allowResponses,
                senderId,
                recipientId: null,
                targetAudience: 'ALL_STAFF',
                attachmentUrl,
                attachmentName
            }
        });

        const activeUsers = await prisma.user.findMany({
            where: { isActive: true },
            select: { id: true }
        });

        if (activeUsers.length > 0) {
            const notificationsData = activeUsers.map(user => ({
                userId: user.id,
                title: 'New Memo Broadcast',
                message: title,
                type: 'INFO',
                link: `/dashboard/memos?id=${memo.id}`
            }));

            const chunkSize = 100;
            for (let i = 0; i < notificationsData.length; i += chunkSize) {
                await prisma.notification.createMany({
                    data: notificationsData.slice(i, i + chunkSize)
                });
            }

            sendPushNotification(
                activeUsers.map(u => u.id),
                'New Memo Broadcast',
                title,
                `/dashboard/memos?id=${memo.id}`
            ).catch(err => console.error('FCM push failed:', err));
        }

        res.status(201).json(memo);
    } catch (error) {
        console.error('Error creating memo:', error);
        res.status(500).json({ message: 'Failed to create memo' });
    }
};

// Get list of memos
export const getMemos = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const role = req.user?.role;
        // @ts-ignore
        const userId = req.user?.id;

        const pageNum = req.query.page ? parseInt(String(req.query.page)) : 1;
        const limitNum = Math.min(parseInt(String(req.query.limit || 25)), 25);
        const skip = (pageNum - 1) * limitNum;

        const whereClause: any = {
            OR: [
                { recipientId: null },
                { recipientId: userId },
                { senderId: userId }
            ]
        };

        const [total, memos] = await Promise.all([
            prisma.memo.count({ where: whereClause }),
            prisma.memo.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
                select: {
                    id: true,
                    title: true,
                    content: true,
                    allowResponses: true,
                    targetAudience: true,
                    attachmentUrl: true,
                    attachmentName: true,
                    createdAt: true,
                    sender: {
                        select: {
                            name: true,
                            email: true,
                            role: true,
                            staffProfile: {
                                select: {
                                    signatureUrl: true,
                                    unit: { select: { name: true } },
                                    studyCenter: { select: { name: true } }
                                }
                            }
                        }
                    },
                    recipient: {
                        select: {
                            name: true,
                            email: true,
                            staffProfile: {
                                select: {
                                    staffId: true
                                }
                            }
                        }
                    },
                    _count: {
                        select: { responses: true }
                    }
                }
            })
        ]);

        res.setHeader('X-Total-Count', total.toString());
        res.setHeader('X-Total-Pages', Math.ceil(total / limitNum).toString());
        res.setHeader('X-Current-Page', pageNum.toString());

        const formatted = memos.map(m => formatMemoSenderName(m));
        res.json(formatted);
    } catch (error) {
        console.error('Error fetching memos:', error);
        res.status(500).json({ message: 'Failed to fetch memos' });
    }
};

// Get a single memo by ID
export const getMemoById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const userId = req.user?.id;
        // @ts-ignore
        const role = req.user?.role;
        const isHR = ['HR_ADMIN', 'SUPER_USER', 'ADMIN', 'VICE_CHANCELLOR', 'REGISTRAR'].includes(role);

        const memoCheck = await prisma.memo.findUnique({
            where: { id },
            select: { senderId: true, recipientId: true }
        });

        if (!memoCheck) {
            return res.status(404).json({ message: 'Memo not found' });
        }

        const isSender = memoCheck.senderId === userId;
        const isRecipient = memoCheck.recipientId === userId;
        const isBroadcast = memoCheck.recipientId === null;

        if (!isSender && !isRecipient && !isBroadcast && !isHR) {
            return res.status(403).json({ message: 'Access denied to this memo' });
        }

        if (isHR || isSender) {
            const memo = await prisma.memo.findUnique({
                where: { id },
                include: {
                    sender: {
                        select: {
                            name: true,
                            email: true,
                            role: true,
                            staffProfile: {
                                select: {
                                    signatureUrl: true,
                                    unit: { select: { name: true } },
                                    studyCenter: { select: { name: true } }
                                }
                            }
                        }
                    },
                    recipient: {
                        select: {
                            name: true,
                            email: true,
                            staffProfile: {
                                select: { staffId: true }
                            }
                        }
                    },
                    responses: {
                        include: {
                            staff: {
                                select: {
                                    name: true,
                                    email: true,
                                    staffProfile: {
                                        select: {
                                            staffId: true,
                                            level: true,
                                            step: true,
                                            cadre: true,
                                            unit: {
                                                select: { name: true }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });

            res.json(formatMemoSenderName(memo));
        } else {
            const memo = await prisma.memo.findUnique({
                where: { id },
                include: {
                    sender: {
                        select: {
                            name: true,
                            email: true,
                            role: true,
                            staffProfile: {
                                select: {
                                    signatureUrl: true,
                                    unit: { select: { name: true } },
                                    studyCenter: { select: { name: true } }
                                }
                            }
                        }
                    },
                    recipient: {
                        select: {
                            name: true,
                            email: true,
                            staffProfile: {
                                select: { staffId: true }
                            }
                        }
                    }
                }
            });

            const myResponse = await prisma.memoResponse.findFirst({
                where: { memoId: id, staffId: userId }
            });

            res.json({ ...formatMemoSenderName(memo), myResponse });
        }
    } catch (error) {
        console.error('Error fetching memo details:', error);
        res.status(500).json({ message: 'Failed to fetch memo details' });
    }
};

// Submit a response to a memo
export const respondToMemo = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        // @ts-ignore
        const userId = req.user?.id;

        if (!content || content.trim() === '') {
            return res.status(400).json({ message: 'Response content cannot be empty' });
        }

        const memo = await prisma.memo.findUnique({
            where: { id }
        });

        if (!memo) {
            return res.status(404).json({ message: 'Memo not found' });
        }

        if (memo.recipientId && memo.recipientId !== userId) {
            return res.status(403).json({ message: 'Access denied to respond to this memo' });
        }

        if (!memo.allowResponses) {
            return res.status(400).json({ message: 'Responses are not allowed for this memo' });
        }

        const existingResponse = await prisma.memoResponse.findFirst({
            where: { memoId: id, staffId: userId }
        });

        if (existingResponse) {
            return res.status(400).json({ message: 'You have already responded to this memo' });
        }

        const response = await prisma.memoResponse.create({
            data: {
                memoId: id,
                staffId: userId,
                content: content.trim()
            }
        });

        res.status(201).json(response);
    } catch (error) {
        console.error('Error responding to memo:', error);
        res.status(500).json({ message: 'Failed to submit response' });
    }
};
