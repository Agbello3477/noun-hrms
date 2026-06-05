import { Request, Response } from 'express';
import prisma from '../prisma';
import { StorageService } from '../services/storage.service';

// Create a new general or targeted memo
export const createMemo = async (req: Request, res: Response) => {
    try {
        const { title, content, recipientId, recipientIds } = req.body;
        // @ts-ignore
        const senderId = req.user?.id;

        if (!title || !content) {
            return res.status(400).json({ message: 'Title and content are required' });
        }

        // Parse allowResponses which could be string in multipart form-data
        let allowResponses = true;
        if (req.body.allowResponses !== undefined) {
            allowResponses = req.body.allowResponses === 'true' || req.body.allowResponses === true;
        }

        // Handle attachment file
        const file = req.file;
        let attachmentUrl = null;
        let attachmentName = null;
        if (file) {
            attachmentUrl = await StorageService.uploadFile(file);
            attachmentName = file.originalname;
        }

        // Parse recipientIds which could be string/array in multipart form-data
        let parsedRecipientIds: string[] = [];
        if (recipientIds) {
            if (Array.isArray(recipientIds)) {
                parsedRecipientIds = recipientIds;
            } else if (typeof recipientIds === 'string') {
                try {
                    const parsed = JSON.parse(recipientIds);
                    if (Array.isArray(parsed)) {
                        parsedRecipientIds = parsed;
                    } else {
                        parsedRecipientIds = [recipientIds];
                    }
                } catch {
                    parsedRecipientIds = recipientIds.split(',').map(s => s.trim()).filter(Boolean);
                }
            }
        }

        // Handle multiple selected staff recipients
        if (parsedRecipientIds.length > 0) {
            const validRecipients = await prisma.user.findMany({
                where: {
                    id: { in: parsedRecipientIds },
                    isActive: true
                },
                select: { id: true }
            });

            if (validRecipients.length !== parsedRecipientIds.length) {
                return res.status(404).json({ message: 'One or more selected recipients are not found or inactive' });
            }

            // Create memos for each recipient
            const createdMemos = await prisma.$transaction(
                parsedRecipientIds.map(rId =>
                    prisma.memo.create({
                        data: {
                            title,
                            content,
                            allowResponses: allowResponses,
                            senderId,
                            recipientId: rId,
                            attachmentUrl,
                            attachmentName
                        }
                    })
                )
            );

            // Create notifications for each recipient
            await prisma.notification.createMany({
                data: createdMemos.map(memo => ({
                    userId: memo.recipientId!,
                    title: 'New Private Memo',
                    message: title,
                    type: 'INFO',
                    link: `/dashboard/memos?id=${memo.id}`
                }))
            });

            return res.status(201).json(createdMemos[0]);
        }

        if (recipientId) {
            const recipientUser = await prisma.user.findUnique({
                where: { id: recipientId, isActive: true }
            });
            if (!recipientUser) {
                return res.status(404).json({ message: 'Recipient staff member not found or inactive' });
            }
        }

        // Create the memo in DB
        const memo = await prisma.memo.create({
            data: {
                title,
                content,
                allowResponses: allowResponses,
                senderId,
                recipientId: recipientId || null,
                attachmentUrl,
                attachmentName
            }
        });

        if (recipientId) {
            // Private targeted memo - notify only the recipient
            await prisma.notification.create({
                data: {
                    userId: recipientId,
                    title: 'New Private Memo',
                    message: title,
                    type: 'INFO',
                    link: `/dashboard/memos?id=${memo.id}`
                }
            });
        } else {
            // Fetch all active users to notify
            const activeUsers = await prisma.user.findMany({
                where: { isActive: true },
                select: { id: true }
            });

            // Batch create notifications for all users
            if (activeUsers.length > 0) {
                const notificationsData = activeUsers.map(user => ({
                    userId: user.id,
                    title: 'New Memo Broadcast',
                    message: title,
                    type: 'INFO',
                    link: `/dashboard/memos?id=${memo.id}`
                }));

                await prisma.notification.createMany({
                    data: notificationsData
                });
            }
        }

        res.status(201).json(memo);
    } catch (error) {
        console.error('Error creating memo:', error);
        res.status(500).json({ message: 'Failed to create memo' });
    }
};

// Get list of memos (with response count if HR)
export const getMemos = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const role = req.user?.role;
        // @ts-ignore
        const userId = req.user?.id;
        const isHR = ['HR_ADMIN', 'SUPER_USER', 'ADMIN'].includes(role);

        let memos;
        if (isHR) {
            memos = await prisma.memo.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    sender: {
                        select: {
                            name: true,
                            email: true
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
            });
        } else {
            memos = await prisma.memo.findMany({
                where: {
                    OR: [
                        { recipientId: null },
                        { recipientId: userId }
                    ]
                },
                orderBy: { createdAt: 'desc' },
                include: {
                    sender: {
                        select: {
                            name: true,
                            email: true
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
                    }
                }
            });
        }

        res.json(memos);
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
        const isHR = ['HR_ADMIN', 'SUPER_USER', 'ADMIN'].includes(role);

        if (isHR) {
            // HR sees full memo and all responses
            const memo = await prisma.memo.findUnique({
                where: { id },
                include: {
                    sender: {
                        select: { name: true, email: true }
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

            if (!memo) {
                return res.status(404).json({ message: 'Memo not found' });
            }

            res.json(memo);
        } else {
            // Staff sees memo + their own response (if any)
            const memo = await prisma.memo.findUnique({
                where: { id },
                include: {
                    sender: {
                        select: { name: true, email: true }
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

            if (!memo) {
                return res.status(404).json({ message: 'Memo not found' });
            }

            // Access check: only broadcast or addressed to them
            if (memo.recipientId && memo.recipientId !== userId) {
                return res.status(403).json({ message: 'Access denied to this memo' });
            }

            const myResponse = await prisma.memoResponse.findFirst({
                where: { memoId: id, staffId: userId }
            });

            res.json({ ...memo, myResponse });
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

        // Access check: only broadcast or addressed to them
        if (memo.recipientId && memo.recipientId !== userId) {
            return res.status(403).json({ message: 'Access denied to respond to this memo' });
        }

        if (!memo.allowResponses) {
            return res.status(400).json({ message: 'Responses are not allowed for this memo' });
        }

        // Check if user already responded
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
