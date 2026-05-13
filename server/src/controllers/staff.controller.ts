
import { Request, Response } from 'express';
import { PrismaClient, Role, Cadre } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { StorageService } from '../services/storage.service';


const prisma = new PrismaClient();

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
        if (!staff) return res.status(404).json({ message: 'Staff not found' });
        res.json(staff);
    } catch (error) {
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

        // Default password
        const defaultPassword = 'password123';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        const fullName = `${surname} ${otherNames}`;

        const resolvedRole = (role && Object.values(Role).includes(role)) ? role : Role.STAFF;
        const resolvedCadre = (cadre && Object.values(Cadre).includes(cadre)) ? cadre : undefined;

        console.log('Creating staff Phase 3:', { email, staffId, resolvedRole });

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: fullName,
                role: resolvedRole,
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
                        unitId: unitId || undefined,
                        centerId: centerId || undefined,

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
                        studyCenter: true
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

        if (!isSelf && !isAdmin) {
            return res.status(403).json({ message: 'Unauthorized to update this profile' });
        }

        const {
            surname, otherNames, phone, stateOfOrigin, lga, address,
            level, step, cadre, gender
        } = req.body;

        let passportUrl = undefined;
        if (file) {
            passportUrl = await StorageService.uploadFile(file);
        }

        await prisma.staffProfile.upsert({
            where: { userId: user.id },
            create: {
                userId: user.id,
                surname, otherNames, phone, stateOfOrigin, lga, address,
                level, step, cadre: cadre || undefined, gender,
                passportUrl
            },
            update: {
                surname, otherNames, phone, stateOfOrigin, lga, address,
                level, step, cadre: cadre || undefined, gender,
                ...(passportUrl ? { passportUrl } : {})
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
