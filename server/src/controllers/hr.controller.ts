
import { Request, Response } from 'express';
import { PrismaClient, Role, User, Cadre, Department } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Helper to generate next Staff ID
const generateStaffId = async (): Promise<string> => {
    return await prisma.$transaction(async (tx) => {
        let seq = await tx.systemSequence.findUnique({ where: { key: 'STAFF_ID' } });

        if (!seq) {
            seq = await tx.systemSequence.create({ data: { key: 'STAFF_ID', current: 1000 } });
        } else {
            seq = await tx.systemSequence.update({
                where: { key: 'STAFF_ID' },
                data: { current: { increment: 1 } }
            });
        }

        // Format: NOUN/01000 (padding to 5 digits as per requirement "start from 01000")
        // Requirement said "start issuing staff Id from 01000". 
        // We start at 1000. 
        // Padding logic: String(seq.current).padStart(5, '0') -> "01000"
        return `NOUN/${String(seq.current).padStart(5, '0')}`;
    });
};

export const createStaffFile = async (req: Request, res: Response) => {
    try {
        const {
            email, name, password, // User basics
            surname, otherNames, title, phone, gender,
            stateOfOrigin, lga, address,
            role, cadre, level, step,
            centerId, unitId,
            programmeId, facilitatorInfo
        } = req.body;

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(400).json({ message: 'Email already exists' });

        const staffId = await generateStaffId();
        const hashedPassword = await bcrypt.hash(password || 'password123', 10);
        const resolvedRole = (role && Object.values(Role).includes(role)) ? role : Role.STAFF;
        const resolvedCadre = (cadre && Object.values(Cadre).includes(cadre)) ? cadre : undefined;

        // @ts-ignore
        const currentUserId = req.user?.id;

        await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    role: resolvedRole,
                    staffProfile: {
                        create: {
                            surname, otherNames, title,
                            staffId,
                            phone, gender, stateOfOrigin, lga, address,
                            level, step, cadre: resolvedCadre,
                            centerId: centerId || undefined,
                            unitId: unitId || undefined,
                            programmeId: programmeId || undefined,
                            facilitatorInfo: facilitatorInfo || undefined,
                            createdById: currentUserId // Link Creator
                        }
                    }
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: currentUserId,
                    action: 'CREATE_FILE',
                    resource: 'STAFF',
                    details: JSON.stringify({ newStaffId: staffId, name: user.name }),
                    ipAddress: req.ip
                }
            });
        });

        res.status(201).json({ message: 'Staff file created successfully', staffId });
    } catch (error) {
        console.error('Create Staff File Error', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const addExistingFile = async (req: Request, res: Response) => {
    try {
        const {
            email, name, password,
            surname, otherNames, title, phone, gender,
            stateOfOrigin, lga, address,
            role, cadre, level, step,
            centerId, unitId,
            programmeId, facilitatorInfo,
            manualStaffId
        } = req.body;

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(400).json({ message: 'Email already exists' });

        let staffId = manualStaffId;
        if (!staffId) {
            staffId = await generateStaffId();
        } else {
            const checkId = await prisma.staffProfile.findUnique({ where: { staffId } });
            if (checkId) return res.status(400).json({ message: 'Staff ID already exists' });
        }

        const hashedPassword = await bcrypt.hash(password || 'password123', 10);
        const resolvedRole = (role && Object.values(Role).includes(role)) ? role : Role.STAFF;
        const resolvedCadre = (cadre && Object.values(Cadre).includes(cadre)) ? cadre : undefined;
        // @ts-ignore
        const currentUserId = req.user?.id;

        await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    role: resolvedRole,
                    staffProfile: {
                        create: {
                            surname, otherNames, title,
                            staffId,
                            phone, gender, stateOfOrigin, lga, address,
                            level, step, cadre: resolvedCadre,
                            centerId: centerId || undefined,
                            unitId: unitId || undefined,
                            programmeId: programmeId || undefined,
                            facilitatorInfo: facilitatorInfo || undefined,
                            createdById: currentUserId
                        }
                    }
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: currentUserId,
                    action: 'ADD_EXISTING_FILE',
                    resource: 'STAFF',
                    details: JSON.stringify({ staffId, name: user.name }),
                    ipAddress: req.ip
                }
            });
        });

        res.status(201).json({ message: 'Existing staff file added', staffId });
    } catch (error) {
        console.error('Add Existing File Error', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getJobFiles = async (req: Request, res: Response) => {
    try {
        const { directorateId, centerId, facultyId } = req.query;

        const where: any = {};
        if (directorateId) where.staffProfile = { ...where.staffProfile, unitId: String(directorateId) };
        if (centerId) where.staffProfile = { ...where.staffProfile, centerId: String(centerId) };
        if (facultyId) where.staffProfile = { ...where.staffProfile, unitId: String(facultyId) };

        const users = await prisma.user.findMany({
            where: {
                role: { not: Role.SUPER_USER },
                staffProfile: where.staffProfile
            },
            include: {
                staffProfile: {
                    include: {
                        createdBy: { select: { name: true, email: true } }, // Fetch Creator Name
                        unit: true,
                        studyCenter: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(users);
    } catch (error) {
        console.error('Get Job Files Error', error);
        res.status(500).json({ message: 'Error fetching files' });
    }
}

// Get Single Staff File
export const getStaffFile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params; // Staff Profile ID or StaffID String? Let's check both

        // Attempt to find by Profile ID first (UUID)
        let profile = await prisma.staffProfile.findUnique({
            where: { id },
            include: {
                user: true,
                unit: true,
                studyCenter: true,
                createdBy: { select: { name: true } }
            }
        });

        // If not found, try by Staff ID String
        if (!profile) {
            profile = await prisma.staffProfile.findUnique({
                where: { staffId: id },
                include: {
                    user: true,
                    unit: true,
                    studyCenter: true,
                    createdBy: { select: { name: true } }
                }
            });
        }

        if (!profile) return res.status(404).json({ message: 'Staff file not found' });

        // Flatten for frontend consistency if needed, or return as is
        res.json({
            id: profile.id, // Profile ID
            userId: profile.userId,
            name: profile.user.name,
            email: profile.user.email,
            staffId: profile.staffId,
            role: profile.user.role,
            unit: profile.unit,
            studyCenter: profile.studyCenter,
            createdAt: profile.createdAt,
            createdBy: profile.createdBy
        });

    } catch (error) {
        console.error('Get Staff File Error', error);
        res.status(500).json({ message: 'Error fetching staff file' });
    }
};
