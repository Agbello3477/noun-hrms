import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// NOUN HQ Mock Coordinates (Abuja)
const STUDY_CENTER_COORDS = { lat: 9.0765, lng: 7.3986 };
const ALLOWED_RADIUS_KM = 5.0; // Large radius for demo

interface AuthRequest extends Request {
    user?: { id: string };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export const clockIn = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { latitude, longitude } = req.body;

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        // Geo-fencing Validation
        if (latitude && longitude) {
            const dist = calculateDistance(latitude, longitude, STUDY_CENTER_COORDS.lat, STUDY_CENTER_COORDS.lng);
            if (dist > ALLOWED_RADIUS_KM) {
                return res.status(400).json({ message: `You are too far from the Study Center (${dist.toFixed(2)}km)` });
            }
        } else {
            return res.status(400).json({ message: 'Location access is required to clock in.' });
        }

        // Check if already clocked in today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const existingRecord = await prisma.attendance.findFirst({
            where: {
                userId,
                clockIn: {
                    gte: startOfDay,
                },
            },
        });

        if (existingRecord) {
            return res.status(400).json({ message: 'You have already clocked in today.' });
        }

        const attendance = await prisma.attendance.create({
            data: {
                userId,
                latitude,
                longitude,
                status: 'PRESENT', // Could implement logic for LATE
            },
        });

        res.json({ message: 'Clocked in successfully', attendance });
    } catch (error) {
        console.error('Clock in error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const clockOut = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        // Find open record
        const record = await prisma.attendance.findFirst({
            where: {
                userId,
                clockIn: { gte: startOfDay },
                clockOut: null,
            },
        });

        if (!record) {
            return res.status(400).json({ message: 'No active clock-in record found.' });
        }

        const updatedRecord = await prisma.attendance.update({
            where: { id: record.id },
            data: { clockOut: new Date() },
        });

        res.json({ message: 'Clocked out successfully', attendance: updatedRecord });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getAttendanceLogs = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const logs = await prisma.attendance.findMany({
            where: { userId },
            orderBy: { clockIn: 'desc' },
            take: 30, // Last 30 entries
        });

        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
