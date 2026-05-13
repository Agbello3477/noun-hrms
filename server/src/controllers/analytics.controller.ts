import { Request, Response } from 'express';
import { PrismaClient, LeaveStatus, LeaveType } from '@prisma/client';
import { redisService } from '../services/redis.service';

const prisma = new PrismaClient();

export const getHRAnalytics = async (req: Request, res: Response) => {
    try {
        const CACHE_KEY = 'hr:analytics:dashboard';
        const cached = await redisService.get(CACHE_KEY);
        if (cached) {
            return res.json(cached);
        }

        // 1. Total Workforce Count
        const totalStaff = await prisma.user.count({
            where: { role: { not: 'SUPER_USER' } } // Exclude developers/system owners if needed
        });

        // 2. Leave Statistics
        // Aggregate active leaves by type.
        // Active = Status APPROVED and EndDate >= Today
        const today = new Date();

        const activeLeaves = await prisma.leaveRequest.groupBy({
            by: ['type'],
            where: {
                status: LeaveStatus.APPROVED,
                endDate: { gte: today }
            },
            _count: {
                _all: true
            }
        });

        // Map database enums to frontend friendly keys
        const leaveStats = {
            study: 0,
            withoutPay: 0,
            sick: 0,
            sabbatical: 0,
            maternity: 0,
            paternity: 0,
            annual: 0
        };

        activeLeaves.forEach(group => {
            if (group.type === LeaveType.STUDY) leaveStats.study = group._count._all;
            if (group.type === LeaveType.WITHOUT_PAY) leaveStats.withoutPay = group._count._all;
            if (group.type === LeaveType.SICK) leaveStats.sick = group._count._all;
            if (group.type === LeaveType.SABBATICAL) leaveStats.sabbatical = group._count._all;
            if (group.type === LeaveType.MATERNITY) leaveStats.maternity = group._count._all;
            if (group.type === LeaveType.PATERNITY) leaveStats.paternity = group._count._all;
            if (group.type === LeaveType.ANNUAL) leaveStats.annual = group._count._all;
        });

        // 3. Gender Distribution (Optional but good for analytics)
        const genderDist = await prisma.staffProfile.groupBy({
            by: ['gender'],
            _count: { _all: true }
        });

        const result = {
            totalWorkforce: totalStaff,
            activeLeaves: leaveStats,
            genderDistribution: genderDist
        };

        await redisService.set(CACHE_KEY, result, 30); // 30 seconds cache for better real-time feel

        res.json(result);

    } catch (error) {
        console.error('Analytics Error:', error);
        res.status(500).json({ message: 'Error fetching analytics' });
    }
};
