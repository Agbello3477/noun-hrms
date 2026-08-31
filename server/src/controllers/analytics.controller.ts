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

        const activeZone = zone || region; // allow either query param
        const cacheKey = `analytics:recruitment:${filterYear}:${month || 'all'}:${gender || 'all'}:${activeZone || 'all'}`;
        const cached = await redisService.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        // Build WHERE clause for stateOfOrigin (zone / region filter)
        let stateFilter: any = undefined;
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

        const resultData = {
            total: staffRecords.length,
            filterYear,
            filterMonth: month ? parseInt(month) : null,
            filterGender: gender || null,
            filterZone: activeZone || null,
            monthlyBreakdown,
            byGender: Object.entries(genderMap).map(([label, count]) => ({ label, count })),
            byZone: Object.entries(zoneMap).map(([zone, count]) => ({ zone, count })),
            byCadre: Object.entries(cadreMap).map(([label, count]) => ({ label, count }))
        };

        await redisService.set(cacheKey, resultData, 60);
        res.json(resultData);
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

        // Parallelise all independent DB queries — eliminates sequential latency
        const today = new Date();

        const [
            totalStaff,
            activeLeaves,
            genderDist,
            stateDist,
            activeLeavesList
        ] = await Promise.all([
            // 1. Total Workforce Count
            prisma.user.count({
                where: { role: { not: 'SUPER_USER' } }
            }),

            // 2. Leave Statistics — aggregate active leaves by type
            prisma.leaveRequest.groupBy({
                by: ['type'],
                where: {
                    status: LeaveStatus.APPROVED,
                    endDate: { gte: today }
                },
                _count: { _all: true }
            }),

            // 3. Gender Distribution
            prisma.staffProfile.groupBy({
                by: ['gender'],
                _count: { _all: true }
            }),

            // 4. Geo-political Zone Distribution
            prisma.staffProfile.groupBy({
                by: ['stateOfOrigin'],
                where: { isDeleted: false },
                _count: { _all: true }
            }),

            // 5. Active leaves detail list — explicit select (no wide include)
            prisma.leaveRequest.findMany({
                where: {
                    status: LeaveStatus.APPROVED,
                    endDate: { gte: today }
                },
                select: {
                    id: true,
                    type: true,
                    startDate: true,
                    endDate: true,
                    durationDays: true,
                    staff: {
                        select: {
                            id: true,
                            title: true,
                            surname: true,
                            otherNames: true,
                            unit: { select: { name: true, type: true } },
                            studyCenter: { select: { name: true } }
                        }
                    }
                },
                orderBy: { endDate: 'asc' },
                take: 200
            })
        ]);

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
            zoneDistribution,
            activeLeavesList: activeLeavesList.map(l => ({
                id: l.id,
                type: l.type,
                startDate: l.startDate,
                endDate: l.endDate,
                durationDays: l.durationDays,
                staff: l.staff ? {
                    id: l.staff.id,
                    title: l.staff.title,
                    surname: l.staff.surname,
                    otherNames: l.staff.otherNames,
                    unitName: l.staff.unit?.name,
                    unitType: l.staff.unit?.type,
                    studyCenterName: l.staff.studyCenter?.name
                } : null
            }))
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

// GET /api/analytics/vc-executive
export const getVcExecutiveAnalytics = async (req: Request, res: Response) => {
    const CACHE_KEY = 'vc:executive:analytics';
    try {
        // 1. Try Redis cache hit
        const cached = await redisService.get(CACHE_KEY);
        if (cached) {
            return res.json(cached);
        }

        // 2. Fetch High-Level KPIs
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [
            totalActiveStaff,
            staffDueForPromotion,
            activeSecurityThreats,
            todayClinicConsultations,
            totalActiveResearchProjects
        ] = await Promise.all([
            prisma.user.count({ where: { isActive: true, role: { not: 'SUPER_USER' } } }),
            prisma.staffProfile.count({ where: { isDueForPromotion: true, isDeleted: false } }),
            prisma.securityIncident.count({ where: { status: { in: ['REPORTED', 'DISPATCHED'] } } }),
            prisma.clinicEncounter.count({ where: { createdAt: { gte: startOfToday } } }),
            prisma.researchProject.count({ where: { status: 'ONGOING' } })
        ]);

        // 3. Fetch Staff Distribution by Dept & State
        const staffByDeptRaw = await prisma.staffProfile.groupBy({
            by: ['department'],
            where: { isDeleted: false, status: 'ACTIVE' },
            _count: { id: true }
        });
        const staffByDept = staffByDeptRaw.map(d => ({
            department: d.department || 'Unassigned',
            count: d._count.id
        }));

        const staffByStateRaw = await prisma.staffProfile.groupBy({
            by: ['stateOfOrigin'],
            where: { isDeleted: false, status: 'ACTIVE' },
            _count: { id: true }
        });
        const staffByState = staffByStateRaw.map(s => ({
            state: s.stateOfOrigin || 'Not Specified',
            count: s._count.id
        }));

        // 4. Fetch Security Incident Categories & High-Risk Zones
        const incidentsByCategoryRaw = await prisma.securityIncident.groupBy({
            by: ['category'],
            _count: { id: true }
        });
        const incidentCategories = incidentsByCategoryRaw.map(c => ({
            category: c.category,
            count: c._count.id
        }));

        const highRiskZonesRaw = await prisma.securityIncident.groupBy({
            by: ['location'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 10
        });
        const highRiskZones = highRiskZonesRaw.map(z => ({
            location: z.location,
            count: z._count.id
        }));

        // 5. Fetch Clinic Attendance Trends (Nurses -> Doctors -> Pharmacy)
        // Group by month and encounter status
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const clinicEncounters = await prisma.clinicEncounter.findMany({
            where: { createdAt: { gte: sixMonthsAgo } },
            select: { status: true, createdAt: true }
        });

        // Map encounters to monthly breakdown
        const monthlyClinicTrends: Record<string, { month: string, nurse: number, doctor: number, pharmacy: number }> = {};
        for (let i = 0; i < 6; i++) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const mLabel = d.toLocaleString('default', { month: 'short', year: '2-digit' });
            monthlyClinicTrends[mLabel] = { month: mLabel, nurse: 0, doctor: 0, pharmacy: 0 };
        }

        clinicEncounters.forEach(e => {
            const mLabel = new Date(e.createdAt).toLocaleString('default', { month: 'short', year: '2-digit' });
            if (monthlyClinicTrends[mLabel]) {
                if (e.status === 'TRIAGE') {
                    monthlyClinicTrends[mLabel].nurse++;
                } else if (e.status === 'CONSULTATION' || e.status === 'CLOSED') {
                    monthlyClinicTrends[mLabel].doctor++;
                } else if (e.status === 'PHARMACY_REQUESTED') {
                    monthlyClinicTrends[mLabel].pharmacy++;
                }
            }
        });

        const clinicTrends = Object.values(monthlyClinicTrends).reverse();

        // 6. Fetch Promotion Pipeline Progress
        const promotionProgressRaw = await prisma.promotionLog.groupBy({
            by: ['status'],
            _count: { id: true }
        });
        const promotionProgress = {
            pending: promotionProgressRaw.find(p => p.status === 'DUE_FOR_PROMOTION')?._count.id || 0,
            cleared: promotionProgressRaw.find(p => p.status === 'PROMOTED')?._count.id || 0,
            withdrawn: promotionProgressRaw.find(p => p.status === 'WITHDRAWN')?._count.id || 0
        };

        const result = {
            kpis: {
                totalActiveStaff,
                staffDueForPromotion,
                activeSecurityThreats,
                todayClinicConsultations,
                totalActiveResearchProjects
            },
            analytics: {
                staffByDept,
                staffByState,
                incidentCategories,
                highRiskZones,
                clinicTrends,
                promotionProgress
            }
        };

        // Cache for 5 minutes (300 seconds)
        await redisService.set(CACHE_KEY, result, 300);

        res.json(result);
    } catch (error) {
        console.error('Error fetching VC Executive Analytics:', error);
        res.status(500).json({ message: 'Error fetching executive dashboard stats' });
    }
};
