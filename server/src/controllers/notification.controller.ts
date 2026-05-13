
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient(); // In a real app, use a singleton instance

// --- Internal Helper ---
export const notifyUser = async (userId: string, title: string, message: string, type = 'INFO', link?: string) => {
    try {
        await prisma.notification.create({
            data: { userId, title, message, type, link }
        });
    } catch (error) {
        console.error('Failed to create notification', error);
    }
};

// --- API Endpoints ---

export const getNotifications = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user?.id;

        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        const unreadCount = await prisma.notification.count({
            where: { userId, isRead: false }
        });

        res.json({ notifications, unreadCount });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching notifications' });
    }
};

export const markAsRead = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const userId = req.user?.id;

        await prisma.notification.updateMany({
            where: { id, userId }, // Ensure ownership
            data: { isRead: true }
        });

        res.json({ message: 'Marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating notification' });
    }
};

export const markAllRead = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user?.id;

        await prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true }
        });

        res.json({ message: 'All marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating notifications' });
    }
};

export const deleteNotification = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const userId = req.user?.id;

        await prisma.notification.deleteMany({
            where: { id, userId }
        });

        res.json({ message: 'Notification deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting notification' });
    }
};
