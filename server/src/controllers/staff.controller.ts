
import { Request, Response } from 'express';
import { Role, Cadre } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { StorageService } from '../services/storage.service';
import prisma from '../prisma';
import { sendAccountCreatedNotification } from '../services/email.service';

export const getAllStaff = async (req: Request, res: Response) => {
    try {
        const staff = await prisma.user.findMany({
            where: {
                isActive: true
            },
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
            }
        });
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
        const isAdmin = [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN].includes(requesterRole as any);

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

        res.json(staff);
    } catch (error) {
        console.error('getStaffById error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}

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

        // 1. Check duplicate email
        const existingEmail = await prisma.user.findUnique({ where: { email } });
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

        console.log('Creating staff Phase 3:', { email, staffId, resolvedRole, finalUnitId, finalCenterId });

        const user = await prisma.user.create({
            data: {
                email,
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
        sendAccountCreatedNotification(email, phone || null, fullName, staffId).catch(err => {
            console.error('Failed to send account creation notification:', err);
        });

        res.status(201).json({ message: 'Staff created successfully', user });

    } catch (error: any) {
        // Log to file
        const logPath = path.join(__dirname, '../../error.log');
        const logMsg = `${new Date().toISOString()} - Create Staff Phase 3 Error: ${error.message}\nStack: ${error.stack}\n\n`;
        try { fs.appendFileSync(logPath, logMsg); } catch (e) { }

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
        const isAdmin = [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN].includes(updaterRole as any);

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
            surname, otherNames, phone, stateOfOrigin, lga, address,
            level, step, cadre, gender,
            role, unitId, centerId, rank
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

        await prisma.staffProfile.upsert({
            where: { userId: user.id },
            create: {
                userId: user.id,
                surname, otherNames, phone, stateOfOrigin, lga, address,
                level, step, cadre: resolvedCadre, gender,
                passportUrl,
                rank: rank || undefined,
                unitId: (isAdmin && unitId && unitId !== 'null' && unitId !== '') ? unitId : null,
                centerId: (isAdmin && centerId && centerId !== 'null' && centerId !== '') ? centerId : null
            },
            update: {
                surname, otherNames, phone, stateOfOrigin, lga, address,
                level, step, cadre: resolvedCadre, gender,
                rank: rank !== undefined ? rank : undefined,
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
