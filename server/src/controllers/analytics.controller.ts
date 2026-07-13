import { Request, Response } from 'express';
import { LeaveStatus, LeaveType, Role, AperStatus } from '@prisma/client';
import { redisService } from '../services/redis.service';
import prisma from '../prisma';

// --- Shared geo-political zone mapping ---
const STATE_TO_ZONE: Record<string, string> = {
    'benue': 'North Central', 'kogi': 'North Central', 'kwara': 'North Central',
    'nasarawa': 'North Central', 'niger': 'North Central', 'plateau': 'North Central',
    'fct': 'North Central', 'abuja': 'North Central', 'federal capital territory': 'North Central',
    'adamawa': 'North East', 'bauchi': 'North East', 'borno': 'North East',
    'gombe': 'North East', 'taraba': 'North East', 'yobe': 'North East',
    'jigawa': 'North West', 'kaduna': 'North West', 'kano': 'North West',
    'katsina': 'North West', 'kebbi': 'North West', 'sokoto': 'North West', 'zamfara': 'North West',
    'abia': 'South East', 'anambra': 'South East', 'ebonyi': 'South East',
    'enugu': 'South East', 'imo': 'South East',
    'akwa ibom': 'South South', 'bayelsa': 'South South', 'cross river': 'South South',
    'delta': 'South South', 'edo': 'South South', 'rivers': 'South South',
    'ekiti': 'South West', 'lagos': 'South West', 'ogun': 'South West',
    'ondo': 'South West', 'osun': 'South West', 'oyo': 'South West'
};

const ZONE_STATES: Record<string, string[]> = {
    'North Central': ['benue','kogi','kwara','nasarawa','niger','plateau','fct','abuja','federal capital territory'],
    'North East': ['adamawa','bauchi','borno','gombe','taraba','yobe'],
    'North West': ['jigawa','kaduna','kano','katsina','kebbi','sokoto','zamfara'],
    'South East': ['abia','anambra','ebonyi','enugu','imo'],
    'South South': ['akwa ibom','bayelsa','cross river','delta','edo','rivers'],
    'South West': ['ekiti','lagos','ogun','ondo','osun','oyo']
};

// GET /api/analytics/recruitment
export const getRecruitmentAnalytics = async (req: Request, res: Response) => {
    try {
        const { year, month, gender, zone, region } = req.query as Record<string, string>;

        const currentYear = new Date().getFullYear();
        const filterYear = year ? parseInt(year) : currentYear;

        // Build date range
        const startDate = month
            ? new Date(filterYear, parseInt(month) - 1, 1)
            : new Date(filterYear, 0, 1);
        const endDate = month
            ? new Date(filterYear, parseInt(month), 0, 23, 59, 59)
            : new Date(filterYear, 11, 31, 23, 59, 59);

        // Build WHERE clause for stateOfOrigin (zone / region filter)
        let stateFilter: any = undefined;
        const activeZone = zone || region; // allow either query param
        if (activeZone && ZONE_STATES[activeZone]) {
            stateFilter = { in: ZONE_STATES[activeZone].map(s => s) };
        }

        // Build staff profile WHERE
        const profileWhere: any = {
            isDeleted: false,
            user: {
                createdAt: { gte: startDate, lte: endDate }
            }
        };
        if (gender) profileWhere.gender = gender;
        if (stateFilter) profileWhere.stateOfOrigin = stateFilter;

        // Fetch matching staff profiles
        const staffRecords = await prisma.staffProfile.findMany({
            where: profileWhere,
            select: {
                gender: true,
                stateOfOrigin: true,
                cadre: true,
                user: { select: { createdAt: true, name: true, email: true, role: true } }
            }
        });

        // Build monthly breakdown (Jan–Dec)
        const monthlyMap: Record<number, number> = {};
        for (let m = 1; m <= 12; m++) monthlyMap[m] = 0;

        staffRecords.forEach(s => {
            const m = new Date(s.user.createdAt).getMonth() + 1;
            monthlyMap[m] = (monthlyMap[m] || 0) + 1;
        });

        const monthlyBreakdown = Object.entries(monthlyMap).map(([m, count]) => ({
            month: parseInt(m),
            label: new Date(filterYear, parseInt(m) - 1, 1).toLocaleString('default', { month: 'short' }),
            count
        }));

        // Gender summary
        const genderMap: Record<string, number> = {};
        staffRecords.forEach(s => {
            const g = s.gender || 'Not Specified';
            genderMap[g] = (genderMap[g] || 0) + 1;
        });

        // Zone summary
        const zoneMap: Record<string, number> = {};
        staffRecords.forEach(s => {
            const state = (s.stateOfOrigin || '').trim().toLowerCase();
            const z = STATE_TO_ZONE[state] || 'Not Specified';
            zoneMap[z] = (zoneMap[z] || 0) + 1;
        });

        // Cadre summary
        const cadreMap: Record<string, number> = {};
        staffRecords.forEach(s => {
            const c = s.cadre || 'Not Specified';
            cadreMap[c] = (cadreMap[c] || 0) + 1;
        });

        res.json({
            total: staffRecords.length,
            filterYear,
            filterMonth: month ? parseInt(month) : null,
            filterGender: gender || null,
            filterZone: activeZone || null,
            monthlyBreakdown,
            byGender: Object.entries(genderMap).map(([label, count]) => ({ label, count })),
            byZone: Object.entries(zoneMap).map(([zone, count]) => ({ zone, count })),
            byCadre: Object.entries(cadreMap).map(([label, count]) => ({ label, count }))
        });
    } catch (error) {
        console.error('Recruitment Analytics Error:', error);
        res.status(500).json({ message: 'Error fetching recruitment analytics' });
    }
};

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

        const CACHE_KEY = `manager:dashboard:stats:${userId}`;
        const cached = await redisService.get(CACHE_KEY);
        if (cached) {
            return res.json(cached);
        }

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
            const emptyResult = {
                totalStaff: 0,
                activeLeaves: 0,
                pendingLeaves: 0,
                pendingAper: 0,
                activeQueries: 0
            };
            await redisService.set(CACHE_KEY, emptyResult, 30);
            return res.json(emptyResult);
        }

        const staffOrClause = [
            ...(unitId ? [{ unitId }] : []),
            ...(centerId ? [{ centerId }] : [])
        ];

        const today = new Date();

        // Run counts in parallel
        const [
            totalStaff,
            activeLeaves,
            pendingLeaves,
            pendingAper,
            activeQueries
        ] = await Promise.all([
            prisma.user.count({
                where: {
                    isActive: true,
                    staffProfile: {
                        OR: staffOrClause
                    }
                }
            }),
            prisma.leaveRequest.count({
                where: {
                    status: LeaveStatus.APPROVED,
                    endDate: { gte: today },
                    staff: {
                        OR: staffOrClause
                    }
                }
            }),
            prisma.leaveRequest.count({
                where: {
                    status: LeaveStatus.PENDING,
                    staff: {
                        OR: staffOrClause
                    }
                }
            }),
            prisma.aperForm.count({
                where: {
                    status: AperStatus.SUBMITTED,
                    staff: {
                        OR: staffOrClause
                    }
                }
            }),
            prisma.staffQuery.count({
                where: {
                    status: 'OPEN',
                    staff: {
                        OR: staffOrClause
                    }
                }
            })
        ]);

        const result = {
            totalStaff,
            activeLeaves,
            pendingLeaves,
            pendingAper,
            activeQueries
        };

        await redisService.set(CACHE_KEY, result, 30); // 30 seconds cache for better real-time feel

        res.json(result);

    } catch (error) {
        console.error('Error fetching manager dashboard stats:', error);
        res.status(500).json({ message: 'Error fetching manager dashboard stats' });
    }
};
