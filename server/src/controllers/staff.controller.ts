
import { Request, Response } from 'express';
import { Role, Cadre } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { StorageService } from '../services/storage.service';
import prisma from '../prisma';
import { sendAccountCreatedNotification } from '../services/email.service';
import { redisService } from '../services/redis.service';

export const getAllStaff = async (req: Request, res: Response) => {
    try {
        const { status, page, limit, search, role, cadre, location } = req.query;

        // Redis cache check
        const cacheKey = `staff:all:${JSON.stringify(req.query)}`;
        const cached = await redisService.get<any>(cacheKey);
        if (cached) {
            res.setHeader('X-Total-Count', cached.total.toString());
            res.setHeader('X-Total-Pages', cached.pages.toString());
            res.setHeader('X-Current-Page', cached.page.toString());
            
            if (req.query.paginated === 'true') {
                return res.json({
                    data: cached.data,
                    total: cached.total,
                    page: cached.page,
                    pages: cached.pages
                });
            }
            return res.json(cached.data);
        }

        let statuses: string[] = [];
        if (status) {
            if (Array.isArray(status)) {
                statuses = status.map(s => String(s).toUpperCase());
            } else {
                statuses = String(status).split(',').map(s => s.trim().toUpperCase());
            }
        }

        let whereClause: any = {};

        // Search filter (name, email, staffId)
        if (search) {
            whereClause.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { email: { contains: String(search), mode: 'insensitive' } },
                {
                    staffProfile: {
                        staffId: { contains: String(search), mode: 'insensitive' }
                    }
                }
            ];
        }

        let profileFilters: any = {};

        // Role Scoping & Placement Boundaries
        // @ts-ignore
        const requesterId = req.user?.id;
        // @ts-ignore
        const requesterRole = req.user?.role;
        const isHQAdmin = [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR].includes(requesterRole as any);

        if (!isHQAdmin) {
            if ([Role.UNIT_HEAD, Role.UNIT_ADMIN, Role.STUDY_CENTER_MANAGER].includes(requesterRole as any)) {
                const headProfile = await prisma.staffProfile.findUnique({
                    where: { userId: requesterId },
                    select: { unitId: true, centerId: true }
                });

                if (headProfile) {
                    if (requesterRole === Role.STUDY_CENTER_MANAGER && headProfile.centerId) {
                        profileFilters.centerId = headProfile.centerId;
                    } else if ((requesterRole === Role.UNIT_HEAD || requesterRole === Role.UNIT_ADMIN) && headProfile.unitId) {
                        profileFilters.unitId = headProfile.unitId;
                    }
                } else {
                    return res.json([]);
                }
            } else {
                return res.status(403).json({ message: 'Unauthorized: You do not have permission to list staff members.' });
            }
        }

        if (statuses.length > 0) {
            profileFilters.status = { in: statuses as any };
        } else {
            // Default to only ACTIVE-like status if none specified
            whereClause.isActive = true;
            profileFilters.isDeleted = false;
        }

        if (cadre) {
            profileFilters.cadre = cadre as any;
        }

        if (location) {
            profileFilters.OR = [
                { unitId: String(location) },
                { centerId: String(location) }
            ];
        }

        // Only assign staffProfile to whereClause if there are filters inside it
        if (Object.keys(profileFilters).length > 0) {
            whereClause.staffProfile = profileFilters;
        }

        if (role) {
            // Check custom role mappings or exact match
            if (role === 'DIRECTOR') {
                whereClause.role = 'UNIT_HEAD';
                whereClause.staffProfile = {
                    ...whereClause.staffProfile,
                    rank: { equals: 'Director', mode: 'insensitive' }
                };
            } else if (role === 'DEAN') {
                whereClause.role = 'UNIT_HEAD';
                whereClause.staffProfile = {
                    ...whereClause.staffProfile,
                    rank: { equals: 'Dean', mode: 'insensitive' }
                };
            } else if (role === 'UNIT_HEAD') {
                whereClause.role = 'UNIT_HEAD';
                whereClause.staffProfile = {
                    ...whereClause.staffProfile,
                    rank: { notIn: ['Director', 'Dean'] }
                };
            } else if (role === 'HEAD_OF_ADMIN') {
                whereClause.role = 'UNIT_ADMIN';
                whereClause.staffProfile = {
                    ...whereClause.staffProfile,
                    rank: { equals: 'Head of Admin', mode: 'insensitive' }
                };
            } else {
                whereClause.role = role as any;
            }
        }

        const total = await prisma.user.count({ where: whereClause });

        const pageNum = page ? parseInt(String(page)) : 1;
        const limitNum = limit ? parseInt(String(limit)) : 10000; // default large if not paginated
        const skip = (pageNum - 1) * limitNum;

        const staff = await prisma.user.findMany({
            where: whereClause,
            include: {
                staffProfile: {
                    include: {
                        studyCenter: true,
                        unit: true
                    }
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            skip,
            take: limitNum
        });

        const totalPages = Math.ceil(total / limitNum);

        // Cache in Redis
        const cacheData = {
            data: staff,
            total,
            page: pageNum,
            pages: totalPages
        };
        await redisService.set(cacheKey, cacheData, 300); // Cache for 5 mins

        // Set pagination headers for backwards compatibility
        res.setHeader('X-Total-Count', total.toString());
        res.setHeader('X-Total-Pages', totalPages.toString());
        res.setHeader('X-Current-Page', pageNum.toString());

        // Also if client explicitly wants paginated JSON format
        if (req.query.paginated === 'true') {
            return res.json({
                data: staff,
                total,
                page: pageNum,
                pages: totalPages
            });
        }

        // Default returns raw array (maintaining compatibility with existing endpoints)
        res.json(staff);
    } catch (error) {
        console.error('Get all staff error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getStaffById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const requesterId = req.user?.id;
        // @ts-ignore
        const requesterRole = req.user?.role;

        const staff = await prisma.user.findUnique({
            where: { id },
            include: {
                staffProfile: {
                    include: {
                        studyCenter: true,
                        unit: true
                    }
                }
            }
        });
        if (!staff || (staff.staffProfile && staff.staffProfile.isDeleted)) return res.status(404).json({ message: 'Staff not found' });

        const isSelf = requesterId === staff.id;
        const isAdmin = [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR].includes(requesterRole as any);

        if (!isSelf && !isAdmin) {
            // Check if they are a manager/unit admin
            if ([Role.UNIT_HEAD, Role.STUDY_CENTER_MANAGER, Role.UNIT_ADMIN].includes(requesterRole as any)) {
                const headProfile = await prisma.staffProfile.findUnique({
                    where: { userId: requesterId },
                    select: { unitId: true, centerId: true }
                });
                if (!headProfile) {
                    return res.status(403).json({ message: 'Unauthorized: You do not have a staff profile' });
                }

                const targetProfile = staff.staffProfile;
                const matchesCurrentPlacement = targetProfile && (
                    (headProfile.unitId && targetProfile.unitId === headProfile.unitId) ||
                    (headProfile.centerId && targetProfile.centerId === headProfile.centerId)
                );

                if (!matchesCurrentPlacement) {
                    // Check if there is a transfer log from the manager's unit/center
                    const managerPlacements = [
                        ...(headProfile.unitId ? [headProfile.unitId] : []),
                        ...(headProfile.centerId ? [headProfile.centerId] : [])
                    ];
                    const wasTransferred = await prisma.transferLog.findFirst({
                        where: {
                            staffId: staff.id,
                            oldCenterId: { in: managerPlacements }
                        }
                    });
                    if (!wasTransferred) {
                        return res.status(403).json({ message: 'Unauthorized: Staff is not in your unit/center' });
                    }
                }
            } else {
                return res.status(403).json({ message: 'Unauthorized to view this profile' });
            }
        }

        // Check if the staff member is currently on active approved leave
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activeLeave = staff.staffProfile ? await prisma.leaveRequest.findFirst({
            where: {
                staffId: staff.staffProfile.id,
                status: 'APPROVED',
                endDate: { gte: today }
            },
            select: {
                id: true,
                type: true,
                startDate: true,
                endDate: true,
                durationDays: true,
                reason: true
            }
        }) : null;

        res.json({
            ...staff,
            activeLeave
        });
    } catch (error) {
        console.error('getStaffById error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const createStaff = async (req: Request, res: Response) => {
    try {
        /*
            Phase 3 Payload:
            surname, otherNames, email, role,
            staffId, level, step, cadre,
            phone, stateOfOrigin, lga, address,
            unitId (for HQ), centerId (for Study Center)
        */
        const {
            surname, otherNames, email, role,
            staffId, level, step, cadre,
            phone, stateOfOrigin, lga, address,
            unitId, centerId,
            // Phase 9
            programmeId, facilitatorInfo
        } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required.' });
        }
        const normalizedEmail = email.trim().toLowerCase();

        if (!stateOfOrigin || !lga) {
            return res.status(400).json({ message: 'State of Origin and LGA are required.' });
        }

        // 1. Check duplicate email
        const existingEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existingEmail) {
            return res.status(400).json({ message: 'Staff file with this email already exists. To recreate it, the existing file must first be deleted by HR.' });
        }

        // 2. Check duplicate staffId if provided
        if (staffId) {
            const existingId = await prisma.staffProfile.findUnique({ where: { staffId } });
            if (existingId) {
                return res.status(400).json({ message: 'Staff file with this Staff ID already exists. To recreate it, the existing file must first be deleted by HR.' });
            }
        }

        // 3. Check duplicate phone if provided
        if (phone) {
            const existingPhone = await prisma.staffProfile.findFirst({ where: { phone } });
            if (existingPhone) {
                return res.status(400).json({ message: 'Staff file with this phone number already exists. To recreate it, the existing file must first be deleted by HR.' });
            }
        }

        // 4. Check duplicate name combination
        if (surname && otherNames) {
            const existingName = await prisma.staffProfile.findFirst({
                where: {
                    surname: { equals: surname.trim(), mode: 'insensitive' },
                    otherNames: { equals: otherNames.trim(), mode: 'insensitive' }
                }
            });
            if (existingName) {
                return res.status(400).json({ message: 'Staff file with this name already exists. To recreate it, the existing file must first be deleted by HR.' });
            }
        }

        // Default password
        const defaultPassword = '123456789';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        const fullName = `${surname} ${otherNames}`;

        const resolvedRole = (role && Object.values(Role).includes(role)) ? role : Role.STAFF;
        let resolvedCadre: Cadre | undefined = undefined;
        if (cadre) {
            if (cadre === 'NON_ACADEMIC' || cadre === 'SENIOR') {
                resolvedCadre = Cadre.ADMINISTRATIVE;
            } else if (Object.values(Cadre).includes(cadre as any)) {
                resolvedCadre = cadre as Cadre;
            }
        }

        const creatorId = (req as any).user?.id;
        const creatorRole = (req as any).user?.role;
        const isHQAdmin = [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN].includes(creatorRole as any);

        let finalUnitId = unitId;
        let finalCenterId = centerId;

        if (!isHQAdmin && (creatorRole === Role.UNIT_HEAD || creatorRole === Role.STUDY_CENTER_MANAGER || creatorRole === Role.UNIT_ADMIN)) {
            const headProfile = await prisma.staffProfile.findUnique({
                where: { userId: creatorId },
                select: { unitId: true, centerId: true }
            });
            if (!headProfile) {
                return res.status(403).json({ message: 'Creator does not have a staff profile' });
            }
            finalUnitId = headProfile.unitId || undefined;
            finalCenterId = headProfile.centerId || undefined;
        }

        console.log('Creating staff Phase 3:', { email: normalizedEmail, staffId, resolvedRole, finalUnitId, finalCenterId });

        const user = await prisma.user.create({
            data: {
                email: normalizedEmail,
                password: hashedPassword,
                name: fullName,
                role: resolvedRole,
                mustChangePassword: true,
                staffProfile: {
                    create: {
                        surname,
                        otherNames,
                        staffId,
                        level,
                        step,
                        cadre: resolvedCadre,
                        phone,
                        stateOfOrigin,
                        lga,
                        address,
                        // Link either Unit OR Center (or both if applicable, but usually mutually exclusive)
                        unitId: finalUnitId || undefined,
                        centerId: finalCenterId || undefined,
                        // Phase 9: Academic & Facilitator
                        programmeId: programmeId || undefined,
                        facilitatorInfo: facilitatorInfo || undefined
                    },
                },
            },
            include: {
                staffProfile: true,
            },
        });

        // Log Creation
        try {
            // @ts-ignore
            const creatorId = (req as any).user?.id || 'SYSTEM';

            await prisma.auditLog.create({
                data: {
                    userId: creatorId,
                    action: 'CREATE_STAFF',
                    resource: 'USER',
                    details: JSON.stringify({ newStaffId: user.id, email: user.email }),
                }
            });
        } catch (e) { }

        // Send Notification asynchronously
        sendAccountCreatedNotification(normalizedEmail, phone || null, fullName, staffId).catch(err => {
            console.error('Failed to send account creation notification:', err);
        });

        await redisService.clearPattern('staff:all:*');
        res.status(201).json({ message: 'Staff created successfully', user });

    } catch (error: any) {
        // Log to file
        const logPath = path.join(__dirname, '../../error.log');
        const logMsg = `${new Date().toISOString()} - Create Staff Phase 3 Error: ${error.message}\nStack: ${error.stack}\n\n`;
        try { await fs.promises.appendFile(logPath, logMsg); } catch (e) { }

        console.error('Create staff error:', error);

        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'Email or Staff ID already exists' });
        }
        res.status(500).json({ message: `Internal server error: ${error.message}` });
    }
};

export const getUnitStaff = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user.id;

        // 1. Get current user's profile to find their Unit/Center
        const headProfile = await prisma.staffProfile.findUnique({
            where: { userId },
            select: { unitId: true, centerId: true }
        });

        if (!headProfile || (!headProfile.unitId && !headProfile.centerId)) {
            return res.status(403).json({ message: 'You differ not appear to belong to a Unit or Center.' });
        }

        // 2. Fetch staff belonging to that Unit or Center
        const staff = await prisma.user.findMany({
            where: {
                isActive: true,
                staffProfile: {
                    OR: [
                        ...(headProfile.unitId ? [{ unitId: headProfile.unitId }] : []),
                        ...(headProfile.centerId ? [{ centerId: headProfile.centerId }] : [])
                    ]
                }
            },
            include: {
                staffProfile: {
                    include: {
                        unit: true,
                        studyCenter: true,
                        leaves: {
                            where: { status: 'APPROVED' }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(staff);

    } catch (error) {
        console.error('Get unit staff error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};


interface AuthRequest extends Request {
    user?: { id: string; role: string };
}



export const updateStaff = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const updaterId = req.user?.id;
        const updaterRole = req.user?.role;
        const file = req.file;

        let targetUserId = id;
        if (id === 'me') {
            targetUserId = updaterId!;
        }

        let user = await prisma.user.findUnique({
            where: { id: targetUserId },
            include: { staffProfile: true }
        });

        if (!user) return res.status(404).json({ message: 'User not found' });

        const isSelf = updaterId === user.id;
        const isAdmin = [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR].includes(updaterRole as any);

        let isManager = false;
        if ([Role.UNIT_HEAD, Role.STUDY_CENTER_MANAGER, Role.UNIT_ADMIN].includes(updaterRole as any)) {
            const headProfile = await prisma.staffProfile.findUnique({
                where: { userId: updaterId },
                select: { unitId: true, centerId: true }
            });
            if (headProfile) {
                const targetProfile = user.staffProfile;
                if (targetProfile) {
                    isManager = !!(
                        (headProfile.unitId && targetProfile.unitId === headProfile.unitId) ||
                        (headProfile.centerId && targetProfile.centerId === headProfile.centerId)
                    );
                }
            }
        }

        if (!isSelf && !isAdmin && !isManager) {
            return res.status(403).json({ message: 'Unauthorized to update this profile' });
        }

        const {
            surname, otherNames, title, phone, stateOfOrigin, lga, address,
            level, step, cadre, gender,
            role, unitId, centerId, rank,
            dateOfBirth, dateOfFirstAppointment, status
        } = req.body;

        let resolvedCadre: Cadre | undefined = undefined;
        if (cadre) {
            if (cadre === 'NON_ACADEMIC' || cadre === 'SENIOR') {
                resolvedCadre = Cadre.ADMINISTRATIVE;
            } else if (Object.values(Cadre).includes(cadre as any)) {
                resolvedCadre = cadre as Cadre;
            }
        }

        let passportUrl = undefined;
        if (file) {
            passportUrl = await StorageService.uploadFile(file);
        }

        // Handle administrator-only fields
        if (isAdmin && role) {
            await prisma.user.update({
                where: { id: user.id },
                data: { role: role as Role }
            });
        }

        const parseDate = (val: any) => {
            if (!val || val === 'null' || val === '') return null;
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
        };

        const dob = parseDate(dateOfBirth);
        const apptDate = parseDate(dateOfFirstAppointment);

        // Status update logic with archiving cascade
        let finalStatus = user.staffProfile?.status;
        let finalIsActive = user.isActive;
        let finalIsDeleted = user.staffProfile?.isDeleted || false;
        let finalDeletedAt = user.staffProfile?.deletedAt || null;
        let finalTokenInvalidatedAt = user.tokenInvalidatedAt;

        if (isAdmin && status) {
            const upperStatus = status.toUpperCase();
            if (['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'RETIRED', 'DECEASED', 'RESIGNED', 'FIRED'].includes(upperStatus)) {
                finalStatus = upperStatus as any;
                if (['RETIRED', 'DECEASED', 'RESIGNED', 'FIRED'].includes(upperStatus)) {
                    finalIsActive = false;
                    finalIsDeleted = true;
                    finalDeletedAt = new Date();
                    finalTokenInvalidatedAt = new Date(); // Revokes existing tokens
                } else {
                    // Changing back to ACTIVE, ON_LEAVE, SUSPENDED restores user access
                    finalIsActive = true;
                    finalIsDeleted = false;
                    finalDeletedAt = null;
                }
            }
        }

        // Update User isActive and tokenInvalidatedAt if changed
        if (finalIsActive !== user.isActive || finalTokenInvalidatedAt !== user.tokenInvalidatedAt) {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    isActive: finalIsActive,
                    tokenInvalidatedAt: finalTokenInvalidatedAt
                }
            });
        }

        // Upsert staff profile
        await prisma.staffProfile.upsert({
            where: { userId: user.id },
            create: {
                userId: user.id,
                surname, otherNames, title, phone, stateOfOrigin, lga, address,
                level, step, cadre: resolvedCadre, gender,
                passportUrl,
                rank: rank || undefined,
                dateOfBirth: dob,
                dateOfFirstAppointment: apptDate,
                status: finalStatus,
                isDeleted: finalIsDeleted,
                deletedAt: finalDeletedAt,
                unitId: (isAdmin && unitId && unitId !== 'null' && unitId !== '') ? unitId : null,
                centerId: (isAdmin && centerId && centerId !== 'null' && centerId !== '') ? centerId : null
            },
            update: {
                surname, otherNames, title: title !== undefined ? title : undefined, phone, stateOfOrigin, lga, address,
                level, step, cadre: resolvedCadre, gender,
                rank: rank !== undefined ? rank : undefined,
                dateOfBirth: dob !== undefined ? dob : undefined,
                dateOfFirstAppointment: apptDate !== undefined ? apptDate : undefined,
                status: finalStatus,
                isDeleted: finalIsDeleted,
                deletedAt: finalDeletedAt,
                ...(passportUrl ? { passportUrl } : {}),
                ...(isAdmin ? {
                    unitId: unitId !== undefined ? (unitId === '' || unitId === 'null' ? null : unitId) : undefined,
                    centerId: centerId !== undefined ? (centerId === '' || centerId === 'null' ? null : centerId) : undefined
                } : {})
            }
        });

        if (surname || otherNames) {
            await prisma.user.update({
                where: { id: user.id },
                data: { name: `${surname || ''} ${otherNames || ''}`.trim() }
            });
        }

        // Log archiving in audit trail
        if (finalIsDeleted && !(user.staffProfile?.isDeleted)) {
            try {
                await prisma.auditLog.create({
                    data: {
                        userId: updaterId || 'SYSTEM',
                        action: 'ARCHIVE_STAFF',
                        resource: 'USER',
                        details: JSON.stringify({ archivedStaffId: user.id, status: finalStatus }),
                    }
                });
            } catch (e) {}
        }

        // System Override Control Log (Phase 3 compliance requirement)
        if (isAdmin) {
            const profile = user.staffProfile;
            const overrides: any = {};
            
            if (rank !== undefined && rank !== profile?.rank) overrides.rank = { old: profile?.rank, new: rank };
            if (finalStatus !== undefined && finalStatus !== profile?.status) overrides.status = { old: profile?.status, new: finalStatus };
            if (level !== undefined && level !== profile?.level) overrides.level = { old: profile?.level, new: level };
            if (step !== undefined && step !== profile?.step) overrides.step = { old: profile?.step, new: step };
            if (dob && dob.getTime() !== profile?.dateOfBirth?.getTime()) overrides.dateOfBirth = { old: profile?.dateOfBirth, new: dob };
            if (apptDate && apptDate.getTime() !== profile?.dateOfFirstAppointment?.getTime()) overrides.dateOfFirstAppointment = { old: profile?.dateOfFirstAppointment, new: apptDate };
            
            if (Object.keys(overrides).length > 0) {
                try {
                    const reason = req.body.overrideReason || 'Manual Administrator profile modification override';
                    await prisma.auditLog.create({
                        data: {
                            userId: updaterId || 'SYSTEM',
                            action: 'MANUAL_OVERRIDE',
                            resource: 'STAFF_PROFILE',
                            details: JSON.stringify({
                                targetUserId: user.id,
                                overrides,
                                reason
                            }),
                            ipAddress: req.ip
                        }
                    });
                } catch (e) {
                    console.error('Failed to write override audit log:', e);
                }
            }
        }

        await redisService.clearPattern('staff:all:*');
        await redisService.del(`user:session:${user.id}`);
        res.json({ message: 'Profile updated successfully', passportUrl });

    } catch (error) {
        console.error('Update Staff Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const getAcademicStaff = async (req: Request, res: Response) => {
    try {
        const staff = await prisma.user.findMany({
            where: {
                isActive: true,
                staffProfile: {
                    cadre: 'ACADEMIC'
                }
            },
            select: {
                id: true,
                name: true,
                staffProfile: {
                    select: { id: true, level: true }
                }
            },
            orderBy: { name: 'asc' }
        });
        res.json(staff);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching academic staff' });
    }
};

export const getTransferredStaff = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user.id;

        // 1. Get current user's profile to find their Unit/Center
        const headProfile = await prisma.staffProfile.findUnique({
            where: { userId },
            select: { unitId: true, centerId: true }
        });

        if (!headProfile || (!headProfile.unitId && !headProfile.centerId)) {
            return res.status(403).json({ message: 'You do not appear to belong to a Unit or Center.' });
        }

        const currentUnitId = headProfile.unitId;
        const currentCenterId = headProfile.centerId;
        const managerPlacements = [
            ...(currentUnitId ? [currentUnitId] : []),
            ...(currentCenterId ? [currentCenterId] : [])
        ];

        // 2. Fetch staff belonging to that Unit or Center formerly (transferred out)
        const staff = await prisma.user.findMany({
            where: {
                isActive: true,
                staffProfile: {
                    NOT: {
                        OR: [
                            ...(currentUnitId ? [{ unitId: currentUnitId }] : []),
                            ...(currentCenterId ? [{ centerId: currentCenterId }] : [])
                        ]
                    }
                },
                transferredStaff: {
                    some: {
                        oldCenterId: {
                            in: managerPlacements
                        }
                    }
                }
            },
            include: {
                staffProfile: {
                    include: {
                        unit: true,
                        studyCenter: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        res.json(staff);

    } catch (error) {
        console.error('Get transferred staff error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const uploadSignature = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user?.id;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: 'No signature file provided' });
        }

        // Upload signature file using StorageService
        const signatureUrl = await StorageService.uploadFile(file);

        // Update VC's StaffProfile
        await prisma.staffProfile.update({
            where: { userId },
            data: { signatureUrl }
        });

        res.json({
            message: 'Signature uploaded successfully',
            signatureUrl
        });
    } catch (error: any) {
        console.error('Upload signature error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  PROMOTION MONITORING MODULE
// ─────────────────────────────────────────────────────────────────────────────
import { runPromotionJob } from '../jobs/promotionCron';

/**
 * GET /api/staff/promotions/due
 * Returns paginated list of PromotionLog entries for the current year.
 * ACCESS: HR_ADMIN, VICE_CHANCELLOR, SUPER_USER
 */
export const getDueForPromotion = async (req: Request, res: Response) => {
    // @ts-ignore
    const requesterRole = req.user?.role as Role;
    const allowed: Role[] = [Role.HR_ADMIN, Role.VICE_CHANCELLOR, Role.SUPER_USER, Role.ADMIN];
    if (!allowed.includes(requesterRole)) {
        return res.status(403).json({ message: 'Forbidden: Insufficient privileges to view promotion records.' });
    }

    try {
        const { search = '', year, page = '1', limit = '20' } = req.query;
        const calendarYear = year ? parseInt(String(year)) : new Date().getFullYear();
        const skip = (parseInt(String(page)) - 1) * parseInt(String(limit));
        const take = parseInt(String(limit));

        const where: any = { calendarYear };
        if (search) {
            where.staffProfile = {
                OR: [
                    { surname:   { contains: String(search), mode: 'insensitive' } },
                    { otherNames:{ contains: String(search), mode: 'insensitive' } },
                    { staffId:   { contains: String(search), mode: 'insensitive' } },
                    { rank:      { contains: String(search), mode: 'insensitive' } },
                ]
            };
        }

        const [logs, total] = await Promise.all([
            prisma.promotionLog.findMany({
                where,
                skip,
                take,
                orderBy: { cronExecutedAt: 'desc' },
                include: {
                    staffProfile: {
                        select: {
                            staffId:       true,
                            surname:       true,
                            otherNames:    true,
                            title:         true,
                            rank:          true,
                            level:         true,
                            step:          true,
                            cadre:         true,
                            department:    true,
                            isDueForPromotion: true,
                            promotionFlaggedAt: true,
                            dateOfLastPromotion: true,
                            unit:          { select: { name: true } },
                            studyCenter:   { select: { name: true } },
                            user:          { select: { email: true } },
                        }
                    }
                }
            }),
            prisma.promotionLog.count({ where })
        ]);

        res.json({
            data: logs,
            total,
            page:  parseInt(String(page)),
            pages: Math.ceil(total / take),
            year:  calendarYear,
        });
    } catch (error) {
        console.error('getDueForPromotion error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * PUT /api/staff/promotions/flag/:profileId
 * Toggle isDueForPromotion on a StaffProfile. Also updates currentRank snapshot.
 * ACCESS: HR_ADMIN, SUPER_USER
 */
export const flagForPromotion = async (req: Request, res: Response) => {
    // @ts-ignore
    const requesterRole = req.user?.role as Role;
    // @ts-ignore
    const requesterId   = req.user?.id as string;
    const allowed: Role[] = [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN];
    if (!allowed.includes(requesterRole)) {
        return res.status(403).json({ message: 'Forbidden: Only Registry HR Admins can flag staff for promotion.' });
    }

    const { profileId } = req.params;
    const { isDue }: { isDue: boolean } = req.body;

    try {
        const profile = await prisma.staffProfile.findUnique({
            where: { id: profileId },
            select: { id: true, rank: true, staffId: true, surname: true, otherNames: true }
        });
        if (!profile) return res.status(404).json({ message: 'Staff profile not found.' });

        const updated = await prisma.staffProfile.update({
            where: { id: profileId },
            data: {
                isDueForPromotion:   isDue,
                currentRank:         profile.rank || null,
                promotionFlaggedAt:  isDue ? new Date() : null,
                promotionFlaggedById: isDue ? requesterId : null,
            }
        });

        const staffName = `${profile.surname || ''} ${profile.otherNames || ''}`.trim();
        const action = isDue ? 'flagged as DUE for promotion' : 'cleared from promotion list';
        console.log(`[PROMOTION] ${staffName} (${profile.staffId}) was ${action} by user ${requesterId}`);

        res.json({ message: `Staff member ${action} successfully.`, profile: updated });
    } catch (error) {
        console.error('flagForPromotion error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * POST /api/staff/promotions/run-cron
 * Manually triggers the promotion cron (for testing / on-demand runs).
 * ACCESS: SUPER_USER only
 */
export const manualRunPromotionCron = async (req: Request, res: Response) => {
    // @ts-ignore
    const requesterRole = req.user?.role as Role;
    if (requesterRole !== Role.SUPER_USER) {
        return res.status(403).json({ message: 'Forbidden: SUPER_USER access only.' });
    }

    try {
        console.log('[PROMOTION_CRON] Manual execution triggered via API...');
        const result = await runPromotionJob('MANUAL');
        res.json({
            message: 'Promotion job executed successfully.',
            result,
        });
    } catch (error) {
        console.error('manualRunPromotionCron error:', error);
        res.status(500).json({ message: 'Failed to run promotion job.' });
    }
};

/**
 * POST /api/staff/retirement/run-cron
 * Manually triggers the retirement cron (for testing / on-demand runs).
 * ACCESS: SUPER_USER or HR_ADMIN
 */
export const manualRunRetirementCron = async (req: any, res: any) => {
    const requesterRole = req.user?.role;
    if (requesterRole !== 'SUPER_USER' && requesterRole !== 'HR_ADMIN') {
        return res.status(403).json({ message: 'Forbidden: SUPER_USER or HR_ADMIN access only.' });
    }

    try {
        const { runRetirementJob } = require('../jobs/retirementCron');
        console.log('[RETIREMENT_CRON] Manual execution triggered via API...');
        const result = await runRetirementJob('MANUAL');
        res.json({
            message: 'Retirement job executed successfully.',
            result,
        });
    } catch (error) {
        console.error('manualRunRetirementCron error:', error);
        res.status(500).json({ message: 'Failed to run retirement job.' });
    }
};

/**
 * Delete all staff that do not have an ID number.
 * ACCESS: SUPER_USER only
 */
export const deleteStaffNoId = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const requesterRole = req.user?.role;
        if (![Role.SUPER_USER, Role.ADMIN, Role.HR_ADMIN].includes(requesterRole as any)) {
            return res.status(403).json({ message: 'Forbidden: Administrative access only.' });
        }

        // Find staff profiles with null or empty staffId
        const profilesNoId = await prisma.staffProfile.findMany({
            where: {
                OR: [
                    { staffId: null },
                    { staffId: '' }
                ]
            },
            select: {
                id: true,
                userId: true,
                surname: true,
                otherNames: true
            }
        });

        // Find users with role STAFF who have no staffProfile at all
        const staffUsersNoProfile = await prisma.user.findMany({
            where: {
                role: Role.STAFF,
                staffProfile: null
            },
            select: {
                id: true,
                email: true,
                name: true
            }
        });

        const profileIds = profilesNoId.map(p => p.id);
        const userIds = [
            ...profilesNoId.map(p => p.userId),
            ...staffUsersNoProfile.map(u => u.id)
        ];

        const details = {
            profilesFound: profilesNoId.map(p => ({ id: p.id, name: `${p.surname} ${p.otherNames}` })),
            usersFound: staffUsersNoProfile.map(u => ({ id: u.id, name: u.name, email: u.email })),
        };

        if (profileIds.length === 0 && userIds.length === 0) {
            return res.json({ message: 'No staff members found without an ID number.', details });
        }

        // Run deletion queries for all relations
        await prisma.$transaction([
            // 1. ProjectMembers
            prisma.projectMember.deleteMany({ where: { staffId: { in: profileIds } } }),
            
            // 2. ProjectMessage
            prisma.projectMessage.deleteMany({ where: { senderId: { in: userIds } } }),
            
            // 3. UploadedProjectFile
            prisma.uploadedProjectFile.deleteMany({ where: { uploaderId: { in: profileIds } } }),
            
            // 4. DocumentTrail — delete trails for docs owned by or uploaded by these profiles
            prisma.documentTrail.deleteMany({
                where: {
                    document: {
                        OR: [
                            { ownerId: { in: profileIds } },
                            { uploadedById: { in: profileIds } }
                        ]
                    }
                }
            }),

            // 5. Document
            prisma.document.deleteMany({
                where: {
                    OR: [
                        { ownerId: { in: profileIds } },
                        { uploadedById: { in: profileIds } }
                    ]
                }
            }),

            // 6. LeaveRequest
            prisma.leaveRequest.deleteMany({ where: { staffId: { in: profileIds } } }),

            // 7. StaffQuery
            prisma.staffQuery.deleteMany({ where: { staffId: { in: profileIds } } }),

            // 8. TransferLog
            prisma.transferLog.deleteMany({ where: { staffId: { in: profileIds } } }),

            // 9. AperForm
            prisma.aperForm.deleteMany({ where: { staffId: { in: profileIds } } }),

            // 10. Publication
            prisma.publication.deleteMany({ where: { staffId: { in: profileIds } } }),

            // 11. TeachingAllocation
            prisma.teachingAllocation.deleteMany({ where: { staffId: { in: profileIds } } }),

            // 12. PromotionLog
            prisma.promotionLog.deleteMany({ where: { staffProfileId: { in: profileIds } } }),

            // 13. RetirementLog
            prisma.retirementLog.deleteMany({ where: { staffProfileId: { in: profileIds } } }),

            // 14. MemoResponse
            prisma.memoResponse.deleteMany({ where: { staffId: { in: userIds } } }),

            // 15. Memo
            prisma.memo.deleteMany({
                where: {
                    OR: [
                        { senderId: { in: userIds } },
                        { recipientId: { in: userIds } }
                    ]
                }
            }),

            // 16. Attendance
            prisma.attendance.deleteMany({ where: { userId: { in: userIds } } }),

            // 17. Notification
            prisma.notification.deleteMany({ where: { userId: { in: userIds } } }),

            // 18. FcmToken
            prisma.fcmToken.deleteMany({ where: { userId: { in: userIds } } }),

            // 19. SecurityGearLoan
            prisma.securityGearLoan.deleteMany({ where: { officerId: { in: userIds } } }),

            // 20. SecurityRoster
            prisma.securityRoster.deleteMany({ where: { userId: { in: userIds } } }),

            // 21. SecurityIncident
            prisma.securityIncident.deleteMany({
                where: {
                    OR: [
                        { reporterId: { in: userIds } },
                        { assignedToId: { in: userIds } }
                    ]
                }
            }),

            // 22. ClinicPatientFile
            prisma.clinicPatientFile.deleteMany({ where: { userId: { in: userIds } } }),

            // 23. StaffProfile
            prisma.staffProfile.deleteMany({ where: { id: { in: profileIds } } }),

            // 24. User
            prisma.user.deleteMany({ where: { id: { in: userIds } } })
        ]);

        // Invalidate Redis caches
        await redisService.clearPattern('staff:all:*');
        for (const uid of userIds) {
            await redisService.del(`user:session:${uid}`);
        }

        res.json({
            message: `Successfully deleted ${profileIds.length} profiles and ${userIds.length} users with no staff ID number.`,
            details
        });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Failed to delete staff with no ID', error: err.message });
    }
};

