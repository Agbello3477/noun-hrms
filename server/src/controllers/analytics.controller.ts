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
        // @ts-ignore
        const requesterId = req.user?.id;
        // @ts-ignore
        const requesterRole = req.user?.role;
        const isGlobalAdmin = requesterRole === Role.SUPER_USER || requesterRole === Role.VICE_CHANCELLOR;

        let requesterProfile: { unitId: string | null; centerId: string | null; unit?: { id: string; name: string; type: string; code: string | null } | null; studyCenter?: { name: string } | null } | null = null;
        if (requesterId) {
            requesterProfile = await prisma.staffProfile.findUnique({
                where: { userId: requesterId },
                select: {
                    unitId: true,
                    centerId: true,
                    unit: { select: { id: true, name: true, type: true, code: true } },
                    studyCenter: { select: { name: true } }
                }
            });
        }

        const isHQAdmin = isGlobalAdmin || (
            (requesterRole === Role.HR_ADMIN || requesterRole === Role.ADMIN) && 
            !requesterProfile?.unitId && 
            !requesterProfile?.centerId
        );

        const cacheScope = isHQAdmin ? 'HQ_GLOBAL' : `${requesterRole}_U${requesterProfile?.unitId || 'NONE'}_C${requesterProfile?.centerId || 'NONE'}`;
        const CACHE_KEY = `hr:analytics:dashboard:${cacheScope}`;
        const cached = await redisService.get(CACHE_KEY);
        if (cached) {
            return res.json(cached);
        }

        // Parallelise all independent DB queries — eliminates sequential latency
        const today = new Date();

        let unitScopeFilter: any = undefined;
        if (!isHQAdmin && requesterProfile) {
            if (requesterProfile.unitId) {
                if (requesterProfile.unit?.type === 'FACULTY') {
                    const facultyCode = requesterProfile.unit.code || '';
                    const mapping: Record<string, string[]> = {
                        'FAC-SCIEN': ['DEP-CS', 'DEP-MTH'],
                        'FAC-LAW': ['DEP-LAW'],
                        'FAC-SOCIA': ['DEP-POL'],
                        'FAC-MANAG': ['DEP-ACC'],
                        'FAC-EDUCA': ['DEP-EDT'],
                        'FAC-HEALT': ['DEP-PBH'],
                        'FAC-AGRIC': ['DEP-AGR'],
                        'FAC-ARTS': ['DEP-ART'],
                        'FAC-COMPU': ['DEP-CMP']
                    };
                    const deptCodes = mapping[facultyCode] || [];
                    if (deptCodes.length > 0) {
                        const deptUnits = await prisma.unit.findMany({
                            where: { code: { in: deptCodes } },
                            select: { id: true }
                        });
                        unitScopeFilter = { unitId: { in: [requesterProfile.unitId, ...deptUnits.map(d => d.id)] } };
                    } else {
                        unitScopeFilter = { unitId: requesterProfile.unitId };
                    }
                } else {
                    unitScopeFilter = { unitId: requesterProfile.unitId };
                }
            } else if (requesterProfile.centerId) {
                unitScopeFilter = { centerId: requesterProfile.centerId };
            }
        }

        const staffProfileWhere = {
            isDeleted: false,
            ...(unitScopeFilter || {})
        };

        const [
            totalStaff,
            activeLeaves,
            genderDist,
            stateDist,
            activeLeavesList
        ] = await Promise.all([
            // 1. Total Workforce Count
            isHQAdmin ? prisma.user.count({
                where: { role: { not: 'SUPER_USER' } }
            }) : prisma.staffProfile.count({
                where: staffProfileWhere
            }),

            // 2. Leave Statistics — aggregate active leaves by type
            prisma.leaveRequest.groupBy({
                by: ['type'],
                where: {
                    status: LeaveStatus.APPROVED,
                    endDate: { gte: today },
                    ...(unitScopeFilter ? { staff: unitScopeFilter } : {})
                },
                _count: { _all: true }
            }),

            // 3. Gender Distribution
            prisma.staffProfile.groupBy({
                by: ['gender'],
                where: staffProfileWhere,
                _count: { _all: true }
            }),

            // 4. Geo-political Zone Distribution
            prisma.staffProfile.groupBy({
                by: ['stateOfOrigin'],
                where: staffProfileWhere,
                _count: { _all: true }
            }),

            // 5. Active leaves detail list — explicit select (no wide include)
            prisma.leaveRequest.findMany({
                where: {
                    status: LeaveStatus.APPROVED,
                    endDate: { gte: today },
                    ...(unitScopeFilter ? { staff: unitScopeFilter } : {})
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
            unitName: requesterProfile?.unit?.name || requesterProfile?.studyCenter?.name || null,
            isGlobalScope: isHQAdmin,
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
            select: {
                id: true,
                unitId: true,
                centerId: true,
                unit: { select: { id: true, type: true, code: true } }
            }
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

        let targetUnitIds: string[] = [];
        if (unitId) {
            targetUnitIds.push(unitId);
            if (managerProfile.unit?.type === 'FACULTY') {
                const facultyCode = managerProfile.unit.code || '';
                const mapping: Record<string, string[]> = {
                    'FAC-SCIEN': ['DEP-CS', 'DEP-MTH'],
                    'FAC-LAW': ['DEP-LAW'],
                    'FAC-SOCIA': ['DEP-POL'],
                    'FAC-MANAG': ['DEP-ACC'],
                    'FAC-EDUCA': ['DEP-EDT'],
                    'FAC-HEALT': ['DEP-PBH'],
                    'FAC-AGRIC': ['DEP-AGR'],
                    'FAC-ARTS': ['DEP-ART'],
                    'FAC-COMPU': ['DEP-CMP']
                };
                const deptCodes = mapping[facultyCode] || [];
                if (deptCodes.length > 0) {
                    const deptUnits = await prisma.unit.findMany({
                        where: { code: { in: deptCodes } },
                        select: { id: true }
                    });
                    targetUnitIds.push(...deptUnits.map(d => d.id));
                }
            }
        }

        const staffFilter = targetUnitIds.length > 0
            ? { unitId: { in: targetUnitIds } }
            : (centerId ? { centerId } : null);

        if (!staffFilter) {
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
                        isDeleted: false,
                        ...staffFilter
                    }
                }
            }),
            prisma.leaveRequest.count({
                where: {
                    status: LeaveStatus.APPROVED,
                    endDate: { gte: today },
                    staff: staffFilter
                }
            }),
            prisma.leaveRequest.count({
                where: {
                    status: LeaveStatus.PENDING,
                    staff: staffFilter
                }
            }),
            prisma.aperForm.count({
                where: {
                    status: AperStatus.SUBMITTED,
                    staff: staffFilter
                }
            }),
            prisma.staffQuery.count({
                where: {
                    status: 'OPEN',
                    staff: staffFilter
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

// GET /api/analytics/dashboard-bootstrap (Consolidated Single-Payload Bootstrap with RBAC Scoping)
export const getDashboardBootstrap = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const userId = user?.id;
        const userRole = user?.role;

        // Fetch User's Staff Profile ID, Unit, Center, and Department for strict RBAC scoping
        let profileId: string | null = null;
        let userUnitId: string | null = null;
        let userCenterId: string | null = null;
        let unitName = 'Registry / Headquarters';
        let unitType = 'HEADQUARTERS';
        let targetUnitIds: string[] = [];
        if (userId) {
            const profile = await prisma.staffProfile.findUnique({
                where: { userId },
                include: {
                    unit: { select: { id: true, name: true, type: true, code: true } },
                    studyCenter: { select: { id: true, name: true, code: true } }
                }
            });
            profileId = profile?.id || null;
            userUnitId = profile?.unitId || null;
            userCenterId = profile?.centerId || null;

            if (profile?.unit?.name) {
                unitName = profile.unit.name;
                unitType = profile.unit.type || 'DIRECTORATE';
            } else if (profile?.studyCenter?.name) {
                unitName = profile.studyCenter.name;
                unitType = 'STUDY_CENTER';
            } else if (profile?.department) {
                unitName = String(profile.department).replace(/_/g, ' ');
            }

            if (userUnitId) {
                targetUnitIds.push(userUnitId);
                if (profile?.unit?.type === 'FACULTY') {
                    const facultyCode = profile.unit.code || '';
                    const mapping: Record<string, string[]> = {
                        'FAC-SCIEN': ['DEP-CS', 'DEP-MTH'],
                        'FAC-LAW': ['DEP-LAW'],
                        'FAC-SOCIA': ['DEP-POL'],
                        'FAC-MANAG': ['DEP-ACC'],
                        'FAC-EDUCA': ['DEP-EDT'],
                        'FAC-HEALT': ['DEP-PBH'],
                        'FAC-AGRIC': ['DEP-AGR'],
                        'FAC-ARTS': ['DEP-ART'],
                        'FAC-COMPU': ['DEP-CMP']
                    };
                    const deptCodes = mapping[facultyCode] || [];
                    if (deptCodes.length > 0) {
                        const deptUnits = await prisma.unit.findMany({
                            where: { code: { in: deptCodes } },
                            select: { id: true }
                        });
                        targetUnitIds.push(...deptUnits.map(d => d.id));
                    }
                }
            }
        }

        const isGlobalHQAdmin = (
            userRole === Role.SUPER_USER || 
            userRole === Role.VICE_CHANCELLOR || 
            ((userRole === Role.ADMIN || userRole === Role.HR_ADMIN) && !userUnitId && !userCenterId)
        );
        const isRegistry = userRole === Role.HR_ADMIN || userRole === Role.SUPER_USER || userRole === Role.ADMIN || userRole === Role.VICE_CHANCELLOR;
        const isUnitManager = userRole === Role.STUDY_CENTER_MANAGER || userRole === Role.UNIT_HEAD || userRole === Role.UNIT_ADMIN;

        const unitScopeFilter = targetUnitIds.length > 0
            ? { unitId: { in: targetUnitIds } }
            : (userCenterId ? { centerId: userCenterId } : null);

        const hasUnitPlacement = Boolean(unitScopeFilter);

        const today = new Date();

        // Execute parallel non-blocking queries across all dashboard sections
        const [
            notificationsResult,
            leavesResult,
            memosResult,
            transfersResult,
            queriesResult,
            globalWorkforceResult,
            globalActiveLeavesResult,
            unitStaffCountResult,
            unitActiveLeavesResult,
            unitPendingLeavesResult,
            unitPendingAperResult,
            unitActiveQueriesResult
        ] = await Promise.allSettled([
            // 1. User Notifications
            userId ? prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 10
            }) : Promise.resolve([]),

            // 2. User Leaves
            profileId ? prisma.leaveRequest.findMany({
                where: { staffId: profileId },
                orderBy: { createdAt: 'desc' },
                take: 10
            }) : Promise.resolve([]),

            // 3. Memos (Timeline)
            prisma.memo.findMany({
                include: {
                    sender: { select: { name: true } },
                    recipient: { select: { name: true, staffProfile: { select: { staffId: true } } } }
                },
                orderBy: { createdAt: 'desc' },
                take: 10
            }),

            // 4. Transfers (Timeline)
            prisma.transferLog.findMany({
                include: { staff: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                take: 10
            }),

            // 5. Queries (Timeline)
            prisma.staffQuery.findMany({
                include: { staff: { select: { user: { select: { name: true } } } } },
                orderBy: { createdAt: 'desc' },
                take: 10
            }),

            // 6. Global Workforce count (HQ Admin only)
            isGlobalHQAdmin ? prisma.staffProfile.count({ where: { isDeleted: false } }) : Promise.resolve(0),

            // 7. Global Active leaves list (HQ Admin only)
            isGlobalHQAdmin ? prisma.leaveRequest.findMany({
                where: { status: LeaveStatus.APPROVED, endDate: { gte: today } },
                include: { staff: { select: { surname: true, otherNames: true, staffId: true, rank: true } } }
            }) : Promise.resolve([]),

            // 8. Directorate / Unit Staff Count
            hasUnitPlacement ? prisma.staffProfile.count({
                where: {
                    isDeleted: false,
                    ...unitScopeFilter
                }
            }) : Promise.resolve(1),

            // 9. Directorate / Unit Active Leaves
            hasUnitPlacement ? prisma.leaveRequest.count({
                where: {
                    status: LeaveStatus.APPROVED,
                    endDate: { gte: today },
                    staff: unitScopeFilter!
                }
            }) : Promise.resolve(0),

            // 10. Directorate / Unit Pending Leaves
            hasUnitPlacement ? prisma.leaveRequest.count({
                where: {
                    status: LeaveStatus.PENDING,
                    staff: unitScopeFilter!
                }
            }) : Promise.resolve(0),

            // 11. Directorate / Unit Pending APER
            hasUnitPlacement ? prisma.aperForm.count({
                where: {
                    status: AperStatus.SUBMITTED,
                    staff: unitScopeFilter!
                }
            }) : Promise.resolve(0),

            // 12. Directorate / Unit Active Queries
            hasUnitPlacement ? prisma.staffQuery.count({
                where: {
                    status: 'OPEN',
                    staff: unitScopeFilter!
                }
            }) : Promise.resolve(0)
        ]);

        const hotlines = {
            clinicEmergencyPhone: '+234 803 123 4567',
            securityControlRoomPhone: '+234 803 765 4321'
        };

        // Parse Notifications & Leaves
        const notifications = notificationsResult.status === 'fulfilled' ? notificationsResult.value : [];
        const unreadNotificationsCount = notifications.filter((n: any) => !n.isRead).length;
        const myLeaves = leavesResult.status === 'fulfilled' ? leavesResult.value : [];

        // Parse Timeline Activities
        const rawMemos = memosResult.status === 'fulfilled' ? memosResult.value : [];
        const rawTransfers = transfersResult.status === 'fulfilled' ? transfersResult.value : [];
        const rawQueries = queriesResult.status === 'fulfilled' ? queriesResult.value : [];

        const mappedMemos = rawMemos.map((m: any) => {
            const isDirect = !!m.recipient;
            return {
                id: `memo-${m.id}`,
                type: 'MEMO',
                title: isDirect ? `Direct Memo Sent to ${m.recipient?.name || 'Staff'}` : 'Memo Broadcast Sent',
                description: isDirect
                    ? `Direct memo: "${m.title}" sent to ${m.recipient?.name || 'Staff'} (${m.recipient?.staffProfile?.staffId || 'N/A'}) by ${m.sender?.name || 'Registry'}`
                    : `General memo: "${m.title}" broadcasted by ${m.sender?.name || 'Registry'}`,
                createdAt: m.createdAt,
                color: isDirect ? 'border-indigo-500 bg-indigo-50/40 text-indigo-700' : 'border-primary bg-primary/10 text-primary-dark'
            };
        });

        const mappedTransfers = rawTransfers.map((t: any) => ({
            id: `transfer-${t.id}`,
            type: 'TRANSFER',
            title: 'Staff Transfer Approved',
            description: `${t.staff?.name || 'Staff member'} transfer processed`,
            createdAt: t.createdAt,
            color: 'border-orange-500 bg-orange-50/40 text-orange-700'
        }));

        const mappedQueries = rawQueries.map((q: any) => ({
            id: `query-${q.id}`,
            type: 'QUERY',
            title: 'Disciplinary Query Issued',
            description: `Query "${q.title || 'Disciplinary query'}" issued to ${q.staff?.user?.name || 'Staff member'}`,
            createdAt: q.createdAt,
            color: 'border-blue-500 bg-blue-50/40 text-blue-700'
        }));

        const activities = [...mappedMemos, ...mappedTransfers, ...mappedQueries]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 15);

        // Parse Global vs Unit Stats
        const globalWorkforce = globalWorkforceResult.status === 'fulfilled' ? globalWorkforceResult.value : 0;
        const globalActiveLeaves = globalActiveLeavesResult.status === 'fulfilled' ? globalActiveLeavesResult.value : [];
        
        const unitStaffCount = unitStaffCountResult.status === 'fulfilled' ? unitStaffCountResult.value : 1;
        const unitActiveLeaves = unitActiveLeavesResult.status === 'fulfilled' ? unitActiveLeavesResult.value : 0;
        const unitPendingLeaves = unitPendingLeavesResult.status === 'fulfilled' ? unitPendingLeavesResult.value : 0;
        const unitPendingAper = unitPendingAperResult.status === 'fulfilled' ? unitPendingAperResult.value : 0;
        const unitActiveQueries = unitActiveQueriesResult.status === 'fulfilled' ? unitActiveQueriesResult.value : 0;

        const activeLeavesBreakdown: Record<string, number> = {
            annual: 0, study: 0, sick: 0, sabbatical: 0, maternity: 0, paternity: 0, withoutPay: 0
        };
        globalActiveLeaves.forEach((l: any) => {
            const key = (l.type || '').toLowerCase();
            if (activeLeavesBreakdown[key] !== undefined) {
                activeLeavesBreakdown[key]++;
            }
        });

        const unitStats = {
            totalStaff: unitStaffCount,
            activeLeaves: unitActiveLeaves,
            pendingLeaves: unitPendingLeaves,
            pendingAper: unitPendingAper,
            activeQueries: unitActiveQueries,
            unitName,
            unitType
        };

        const analytics = isGlobalHQAdmin ? {
            totalWorkforce: globalWorkforce,
            activeLeaves: activeLeavesBreakdown,
            activeLeavesList: globalActiveLeaves.slice(0, 10),
            isGlobalScope: true
        } : {
            totalWorkforce: unitStaffCount,
            unitName,
            activeLeaves: activeLeavesBreakdown,
            activeLeavesList: [],
            isGlobalScope: false
        };

        const managerStats = (isUnitManager || hasUnitPlacement) ? unitStats : null;

        const pendingActionsCount = isGlobalHQAdmin
            ? (rawQueries.filter((q: any) => q.status === 'OPEN').length + (globalActiveLeaves.length > 0 ? 1 : 0))
            : (unitPendingLeaves + unitPendingAper + unitActiveQueries);

        res.json({
            hotlines,
            notifications,
            unreadNotificationsCount,
            myLeaves,
            activities,
            analytics,
            managerStats,
            unitStats,
            isGlobalScope: isGlobalHQAdmin,
            unitName,
            pendingActionsCount
        });
    } catch (error: any) {
        console.error('Error executing dashboard bootstrap:', error);
        res.status(500).json({ message: 'Error bootstrapping dashboard' });
    }
};

/**
 * GET /api/analytics/sla-kpi
 * Computes institutional, unit-level, and personal SLA & KPI turnaround metrics:
 *  - Average Processing Time (hours & days)
 *  - % Processed Within SLA (Success Rate)
 *  - Overdue Bottleneck Rate (% Breached)
 *  - Categorical breakdowns for Leaves, File Requests, Official Applications, Queries
 */
export const getSlaKpiMetrics = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user as { id: string; role: Role; staffProfile?: { id: string; unitId?: string | null } };
        const { scope = 'auto', timeframe = '30d', unitId: requestedUnitId } = req.query as Record<string, string>;

        const isExecutive = [Role.HR_ADMIN, Role.SUPER_USER, Role.VICE_CHANCELLOR, Role.REGISTRAR, Role.ADMIN].includes(user?.role as any);
        const isUnitManager = [Role.UNIT_HEAD, Role.STUDY_CENTER_MANAGER, Role.UNIT_ADMIN].includes(user?.role as any);

        let effectiveScope = scope;
        if (scope === 'auto') {
            effectiveScope = isExecutive ? 'institutional' : isUnitManager ? 'unit' : 'personal';
        }

        // Timeframe filter calculation
        const now = new Date();
        let startDate: Date;
        if (timeframe === '7d') {
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (timeframe === '90d') {
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        } else if (timeframe === '365d') {
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        } else if (timeframe === 'all') {
            startDate = new Date(0);
        } else {
            // default 30d
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        // Determine user's staffProfile & unit
        const staff = await prisma.staffProfile.findFirst({
            where: { userId: user?.id },
            select: { id: true, unitId: true, centerId: true, unit: { select: { name: true } } }
        });

        const targetUnitId = requestedUnitId || (effectiveScope === 'unit' ? (staff?.unitId || staff?.centerId) : undefined);

        // Build Where clauses
        const leaveWhere: any = { createdAt: { gte: startDate } };
        const fileReqWhere: any = { createdAt: { gte: startDate } };
        const appWhere: any = { createdAt: { gte: startDate } };
        const queryWhere: any = { createdAt: { gte: startDate } };

        if (effectiveScope === 'personal' && staff) {
            leaveWhere.staffId = staff.id;
            fileReqWhere.OR = [{ staffId: staff.id }, { requesterId: user?.id }];
            appWhere.applicantId = user?.id;
            queryWhere.staffId = staff.id;
        } else if (effectiveScope === 'unit' && targetUnitId) {
            leaveWhere.staff = { OR: [{ unitId: targetUnitId }, { centerId: targetUnitId }] };
            fileReqWhere.staff = { OR: [{ unitId: targetUnitId }, { centerId: targetUnitId }] };
            queryWhere.staff = { OR: [{ unitId: targetUnitId }, { centerId: targetUnitId }] };
        }

        // Parallel queries
        const [leaves, fileRequests, applications, queries] = await Promise.all([
            prisma.leaveRequest.findMany({
                where: leaveWhere,
                select: {
                    id: true,
                    type: true,
                    status: true,
                    submittedAt: true,
                    expectedResolutionAt: true,
                    resolvedAt: true,
                    turnaroundTimeHours: true,
                    slaBreach: true,
                    staff: { select: { surname: true, otherNames: true, staffId: true } }
                }
            }),
            prisma.fileRequest.findMany({
                where: fileReqWhere,
                select: {
                    id: true,
                    status: true,
                    submittedAt: true,
                    expectedResolutionAt: true,
                    resolvedAt: true,
                    turnaroundTimeHours: true,
                    slaBreach: true,
                    staff: { select: { surname: true, otherNames: true, staffId: true } }
                }
            }),
            prisma.officialApplication.findMany({
                where: appWhere,
                select: {
                    id: true,
                    subject: true,
                    status: true,
                    submittedAt: true,
                    expectedResolutionAt: true,
                    resolvedAt: true,
                    turnaroundTimeHours: true,
                    slaBreach: true,
                    applicant: { select: { name: true, email: true } }
                }
            }),
            prisma.staffQuery.findMany({
                where: queryWhere,
                select: {
                    id: true,
                    title: true,
                    status: true,
                    createdAt: true,
                    responseDeadline: true,
                    slaBreached: true,
                    actionType: true,
                    staff: { select: { surname: true, otherNames: true, staffId: true } }
                }
            })
        ]);

        // Helper to process and normalize SLA items
        const processItems = (items: any[], typeName: string, titleFn: (i: any) => string, staffFn: (i: any) => string) => {
            return items.map(item => {
                const subAt = new Date(item.submittedAt || item.createdAt);
                const resAt = item.resolvedAt ? new Date(item.resolvedAt) : null;
                let turnaround = item.turnaroundTimeHours;
                if (!turnaround && resAt) {
                    turnaround = Math.max(0, parseFloat(((resAt.getTime() - subAt.getTime()) / (1000 * 60 * 60)).toFixed(1)));
                }

                // Check SLA breach
                const isBreached = item.slaBreach === true || item.slaBreached === true || (
                    !resAt && item.expectedResolutionAt && new Date() > new Date(item.expectedResolutionAt)
                ) || (
                    !resAt && item.responseDeadline && new Date() > new Date(item.responseDeadline)
                );

                const isResolved = Boolean(resAt) || ['APPROVED', 'REJECTED', 'CLOSED', 'ACKNOWLEDGED', 'FORWARDED_DIRECTORATE', 'DEFAULTED_UNANSWERED'].includes(item.status);

                return {
                    id: item.id,
                    category: typeName,
                    title: titleFn(item),
                    staffName: staffFn(item),
                    status: item.status,
                    submittedAt: subAt,
                    expectedResolutionAt: item.expectedResolutionAt || item.responseDeadline || null,
                    resolvedAt: resAt,
                    turnaroundHours: turnaround,
                    isBreached,
                    isResolved
                };
            });
        };

        const allProcessed = [
            ...processItems(leaves, 'Leave Application', (l) => `${l.type} Leave`, (l) => l.staff ? `${l.staff.surname} ${l.staff.otherNames}` : 'Staff'),
            ...processItems(fileRequests, 'Staff File Request', () => 'File Access Request', (f) => f.staff ? `${f.staff.surname} ${f.staff.otherNames}` : 'Staff'),
            ...processItems(applications, 'Official Registry Application', (a) => a.subject || 'Official Application', (a) => a.applicant?.name || 'Applicant'),
            ...processItems(queries, 'Disciplinary Action', (q) => q.title || `${q.actionType || 'Query'}`, (q) => q.staff ? `${q.staff.surname} ${q.staff.otherNames}` : 'Staff')
        ];

        const totalRequests = allProcessed.length;
        const totalResolved = allProcessed.filter(p => p.isResolved).length;
        const totalPending = totalRequests - totalResolved;

        const resolvedWithTurnaround = allProcessed.filter(p => p.turnaroundHours !== null && p.turnaroundHours !== undefined && p.turnaroundHours > 0);
        const avgTurnaroundHours = resolvedWithTurnaround.length > 0
            ? parseFloat((resolvedWithTurnaround.reduce((sum, p) => sum + p.turnaroundHours!, 0) / resolvedWithTurnaround.length).toFixed(1))
            : 0;

        const totalBreached = allProcessed.filter(p => p.isBreached).length;
        const resolvedWithinSla = allProcessed.filter(p => p.isResolved && !p.isBreached).length;

        const slaSuccessRate = totalResolved > 0
            ? parseFloat(((resolvedWithinSla / totalResolved) * 100).toFixed(1))
            : (totalRequests > 0 ? (totalBreached === 0 ? 100 : parseFloat((((totalRequests - totalBreached) / totalRequests) * 100).toFixed(1))) : 100);

        const overdueBottleneckRate = totalRequests > 0
            ? parseFloat(((totalBreached / totalRequests) * 100).toFixed(1))
            : 0;

        // Categorical summary
        const categories = ['Leave Application', 'Staff File Request', 'Official Registry Application', 'Disciplinary Action'].map(cat => {
            const catItems = allProcessed.filter(p => p.category === cat);
            const catResolved = catItems.filter(p => p.isResolved);
            const catBreached = catItems.filter(p => p.isBreached);
            const catWithTurnaround = catItems.filter(p => p.turnaroundHours !== null && p.turnaroundHours !== undefined && p.turnaroundHours > 0);
            const catAvgHours = catWithTurnaround.length > 0
                ? parseFloat((catWithTurnaround.reduce((sum, p) => sum + p.turnaroundHours!, 0) / catWithTurnaround.length).toFixed(1))
                : 0;
            const catSuccess = catResolved.length > 0
                ? parseFloat((((catResolved.length - catBreached.length) / catResolved.length) * 100).toFixed(1))
                : 100;

            return {
                category: cat,
                total: catItems.length,
                resolved: catResolved.length,
                pending: catItems.length - catResolved.length,
                breached: catBreached.length,
                avgHours: catAvgHours,
                avgDays: parseFloat((catAvgHours / 24).toFixed(1)),
                successRate: Math.max(0, catSuccess)
            };
        });

        // Recent Breached Bottlenecks
        const bottlenecks = allProcessed
            .filter(p => p.isBreached)
            .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
            .slice(0, 10);

        res.json({
            scope: effectiveScope,
            timeframe,
            unitName: staff?.unit?.name || 'All Units',
            metrics: {
                totalRequests,
                totalResolved,
                totalPending,
                averageProcessingTimeHours: avgTurnaroundHours,
                averageProcessingTimeDays: parseFloat((avgTurnaroundHours / 24).toFixed(1)),
                processedWithinSlaCount: resolvedWithinSla,
                slaSuccessRate,
                slaBreachCount: totalBreached,
                overdueBottleneckRate
            },
            categories,
            bottlenecks
        });
    } catch (error: any) {
        console.error('getSlaKpiMetrics error:', error);
        res.status(500).json({ message: 'Failed to compute SLA KPI metrics' });
    }
};

