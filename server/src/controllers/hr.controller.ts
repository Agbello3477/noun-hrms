
import { Request, Response } from 'express';
import { Role, User, Cadre, Department } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { sendAccountCreatedNotification } from '../services/email.service';

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
        if (existing) return res.status(400).json({ message: 'Staff file with this email already exists. To recreate it, the existing file must first be deleted by HR.' });

        if (!stateOfOrigin || !lga) {
            return res.status(400).json({ message: 'State of Origin and LGA are required.' });
        }

        if (phone) {
            const existingPhone = await prisma.staffProfile.findFirst({ where: { phone } });
            if (existingPhone) {
                return res.status(400).json({ message: 'Staff file with this phone number already exists. To recreate it, the existing file must first be deleted by HR.' });
            }
        }

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

        const staffId = await generateStaffId();
        const defaultPassword = password || '123456789';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
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
                    mustChangePassword: true,
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

        // Send Notification asynchronously
        sendAccountCreatedNotification(email, phone || null, name || `${surname} ${otherNames}`, staffId).catch(err => {
            console.error('Failed to send account creation notification:', err);
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
        if (existing) return res.status(400).json({ message: 'Staff file with this email already exists. To recreate it, the existing file must first be deleted by HR.' });

        if (!stateOfOrigin || !lga) {
            return res.status(400).json({ message: 'State of Origin and LGA are required.' });
        }

        let staffId = manualStaffId;
        if (!staffId) {
            staffId = await generateStaffId();
        } else {
            const checkId = await prisma.staffProfile.findUnique({ where: { staffId } });
            if (checkId) return res.status(400).json({ message: 'Staff file with this Staff ID already exists. To recreate it, the existing file must first be deleted by HR.' });
        }

        if (phone) {
            const existingPhone = await prisma.staffProfile.findFirst({ where: { phone } });
            if (existingPhone) {
                return res.status(400).json({ message: 'Staff file with this phone number already exists. To recreate it, the existing file must first be deleted by HR.' });
            }
        }

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

        const defaultPassword = password || '123456789';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
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
                    mustChangePassword: true,
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

        // Send Notification asynchronously
        sendAccountCreatedNotification(email, phone || null, name || `${surname} ${otherNames}`, staffId).catch(err => {
            console.error('Failed to send account creation notification:', err);
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

        const whereProfile: any = {
            isDeleted: false
        };
        if (directorateId) whereProfile.unitId = String(directorateId);
        if (centerId) whereProfile.centerId = String(centerId);
        if (facultyId) whereProfile.unitId = String(facultyId);

        const users = await prisma.user.findMany({
            where: {
                role: { not: Role.SUPER_USER },
                staffProfile: whereProfile
            },
            include: {
                staffProfile: {
                    include: {
                        createdBy: { select: { name: true, email: true } }, // Fetch Creator Name
                        unit: true,
                        studyCenter: true,
                        queries: {
                            where: { status: 'OPEN' }
                        },
                        fileRequests: {
                            where: { status: 'APPROVED' }
                        },
                        leaves: {
                            where: { status: 'APPROVED' }
                        }
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
        let profile = await prisma.staffProfile.findFirst({
            where: { id, isDeleted: false },
            include: {
                user: true,
                unit: true,
                studyCenter: true,
                createdBy: { select: { name: true } }
            }
        });

        // If not found, try by Staff ID String
        if (!profile) {
            profile = await prisma.staffProfile.findFirst({
                where: { staffId: id, isDeleted: false },
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
            title: profile.title,
            phone: profile.phone,
            gender: profile.gender,
            stateOfOrigin: profile.stateOfOrigin,
            lga: profile.lga,
            address: profile.address,
            cadre: profile.cadre,
            level: profile.level,
            step: profile.step,
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

// Delete Staff File (Soft Delete with Password Verification)
export const deleteStaffFile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params; // Staff Profile ID or Staff ID
        const { password } = req.body;
        // @ts-ignore
        const requesterId = req.user?.id;

        if (!password) {
            return res.status(400).json({ message: 'Password is required to confirm deletion' });
        }

        // Fetch requester to verify password
        const requester = await prisma.user.findUnique({
            where: { id: requesterId }
        });

        if (!requester) {
            return res.status(404).json({ message: 'Requester account not found' });
        }

        // Verify password
        const isPasswordCorrect = await bcrypt.compare(password, requester.password);
        if (!isPasswordCorrect) {
            return res.status(401).json({ message: 'Incorrect password. Deletion cancelled.' });
        }

        let profile = await prisma.staffProfile.findFirst({
            where: {
                OR: [
                    { id },
                    { staffId: id }
                ]
            }
        });

        if (!profile) return res.status(404).json({ message: 'Staff file not found' });

        // Perform soft delete
        await prisma.$transaction(async (tx) => {
            await tx.staffProfile.update({
                where: { id: profile!.id },
                data: {
                    isDeleted: true,
                    deletedAt: new Date()
                }
            });

            await tx.user.update({
                where: { id: profile!.userId },
                data: {
                    isActive: false
                }
            });
        });

        res.json({ message: 'Staff file successfully archived' });
    } catch (error) {
        console.error('Delete Staff File Error', error);
        res.status(500).json({ message: 'Error archiving staff file' });
    }
};

// Get Archived Files (HR / Super Users only)
export const getArchivedFiles = async (req: Request, res: Response) => {
    try {
        const securityCode = req.headers['x-archive-code'] || req.query.code;
        if (securityCode !== 'NOUN2026') {
            return res.status(403).json({ message: 'Invalid archive security code' });
        }

        const archived = await prisma.staffProfile.findMany({
            where: { isDeleted: true },
            include: {
                user: true,
                unit: true,
                studyCenter: true
            },
            orderBy: { deletedAt: 'desc' }
        });

        res.json(archived);
    } catch (error) {
        console.error('Get Archived Files Error', error);
        res.status(500).json({ message: 'Error fetching archived files' });
    }
};

// Restore Staff File
export const restoreStaffFile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const securityCode = req.headers['x-archive-code'] || req.body.code;

        if (securityCode !== 'NOUN2026') {
            return res.status(403).json({ message: 'Invalid archive security code' });
        }

        const profile = await prisma.staffProfile.findFirst({
            where: {
                OR: [
                    { id },
                    { staffId: id }
                ]
            }
        });

        if (!profile) return res.status(404).json({ message: 'Staff file not found' });

        await prisma.$transaction(async (tx) => {
            await tx.staffProfile.update({
                where: { id: profile!.id },
                data: {
                    isDeleted: false,
                    deletedAt: null
                }
            });

            await tx.user.update({
                where: { id: profile!.userId },
                data: {
                    isActive: true
                }
            });
        });

        res.json({ message: 'Staff file restored successfully' });
    } catch (error) {
        console.error('Restore Staff File Error', error);
        res.status(500).json({ message: 'Error restoring staff file' });
    }
};
