import { Request, Response } from 'express';
import { LeaveStatus, LeaveType, Role, AperStatus } from '@prisma/client';
import { redisService } from '../services/redis.service';
import prisma from '../prisma';

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

        // 4. Geo-political Zone Distribution
        const STATE_TO_ZONE: Record<string, string> = {
            'benue': 'North Central', 'kogi': 'North Central', 'kwara': 'North Central', 
            'nasarawa': 'North Central', 'niger': 'North Central', 'plateau': 'North Central', 
            'fct': 'North Central', 'abuja': 'North Central', 'federal capital territory': 'North Central',
            'adamawa': 'North East', 'bauchi': 'North East', 'borno': 'North East', 
            'gombe': 'North East', 'taraba': 'North East', 'yobe': 'North East',
            'jigawa': 'North West', 'kaduna': 'North West', 'kano': 'North West', 
            'katsina': 'North West', 'kebbi': 'North West', 'sokoto': 'North West', 
            'zamfara': 'North West',
            'abia': 'South East', 'anambra': 'South East', 'ebonyi': 'South East', 
            'enugu': 'South East', 'imo': 'South East',
            'akwa ibom': 'South South', 'bayelsa': 'South South', 'cross river': 'South South', 
            'delta': 'South South', 'edo': 'South South', 'rivers': 'South South',
            'ekiti': 'South West', 'lagos': 'South West', 'ogun': 'South West', 
            'ondo': 'South West', 'osun': 'South West', 'oyo': 'South West'
        };

        const stateDist = await prisma.staffProfile.groupBy({
            by: ['stateOfOrigin'],
            where: { isDeleted: false },
            _count: { _all: true }
        });

        const zoneCounts: Record<string, number> = {
            'North Central': 0,
            'North East': 0,
            'North West': 0,
            'South East': 0,
            'South South': 0,
            'South West': 0,
            'Not Specified': 0
        };

        stateDist.forEach(group => {
            const state = (group.stateOfOrigin || '').trim().toLowerCase();
            const zone = STATE_TO_ZONE[state] || 'Not Specified';
            zoneCounts[zone] += group._count._all;
        });

        const zoneDistribution = Object.entries(zoneCounts).map(([zone, count]) => ({
            zone,
            count
        }));

        const result = {
            totalWorkforce: totalStaff,
            activeLeaves: leaveStats,
            genderDistribution: genderDist,
            zoneDistribution
        };

        await redisService.set(CACHE_KEY, result, 30); // 30 seconds cache for better real-time feel

        res.json(result);

    } catch (error) {
        console.error('Analytics Error:', error);
        res.status(500).json({ message: 'Error fetching analytics' });
    }
};

export const getManagerDashboardStats = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user.id;

        const managerProfile = await prisma.staffProfile.findUnique({
            where: { userId },
            select: { id: true, unitId: true, centerId: true }
        });

        if (!managerProfile) {
            return res.status(403).json({ message: 'Unauthorized: You do not have a staff profile' });
        }

        const unitId = managerProfile.unitId;
        const centerId = managerProfile.centerId;

        if (!unitId && !centerId) {
            return res.json({
                totalStaff: 0,
                activeLeaves: 0,
                pendingLeaves: 0,
                pendingAper: 0,
                activeQueries: 0
            });
        }

        const staffOrClause = [
            ...(unitId ? [{ unitId }] : []),
            ...(centerId ? [{ centerId }] : [])
        ];

        // 1. Total Staff count
        const totalStaff = await prisma.user.count({
            where: {
                isActive: true,
                staffProfile: {
                    OR: staffOrClause
                }
            }
        });

        // 2. Active Leaves
        const today = new Date();
        const activeLeaves = await prisma.leaveRequest.count({
            where: {
                status: LeaveStatus.APPROVED,
                endDate: { gte: today },
                staff: {
                    OR: staffOrClause
                }
            }
        });

        // 3. Pending Leaves
        const pendingLeaves = await prisma.leaveRequest.count({
            where: {
                status: LeaveStatus.PENDING,
                staff: {
                    OR: staffOrClause
                }
            }
        });

        // 4. Pending Appraisal Reviews
        const pendingAper = await prisma.aperForm.count({
            where: {
                status: AperStatus.SUBMITTED,
                staff: {
                    OR: staffOrClause
                }
            }
        });

        // 5. Active Queries
        const activeQueries = await prisma.staffQuery.count({
            where: {
                status: 'OPEN',
                staff: {
                    OR: staffOrClause
                }
            }
        });

        res.json({
            totalStaff,
            activeLeaves,
            pendingLeaves,
            pendingAper,
            activeQueries
        });

    } catch (error) {
        console.error('Error fetching manager dashboard stats:', error);
        res.status(500).json({ message: 'Error fetching manager dashboard stats' });
    }
};
