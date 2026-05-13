
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient, Role, Cadre } from '@prisma/client';

const prisma = new PrismaClient();

export const register = async (req: Request, res: Response) => {
    try {
        const {
            email, password, name, role,
            // Profile Fields
            surname, otherNames, title,
            staffId, phone,
            stateOfOrigin, lga, address,
            level, step, cadre, gender,
            // Organization
            centerId, unitId,
            // Phase 9
            programmeId, facilitatorInfo
        } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        if (staffId) {
            const existingStaffId = await prisma.staffProfile.findUnique({
                where: { staffId }
            });
            if (existingStaffId) {
                return res.status(400).json({ message: 'Staff ID is already in use by another user' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Use user provided role if valid, else default to STAFF
        const resolvedRole = (role && Object.values(Role).includes(role)) ? role : Role.STAFF;
        const resolvedCadre = (cadre && Object.values(Cadre).includes(cadre)) ? cadre : undefined;

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: resolvedRole,
                staffProfile: {
                    create: {
                        surname,
                        otherNames,
                        title,
                        staffId,
                        phone,
                        gender,
                        stateOfOrigin,
                        lga,
                        address,
                        level,
                        step,
                        cadre: resolvedCadre,
                        centerId: centerId || undefined,
                        unitId: unitId || undefined,
                        programmeId: programmeId || undefined,
                        facilitatorInfo: facilitatorInfo || undefined
                    }
                }
            },
            include: {
                staffProfile: true
            }
        });

        // Audit Log
        try {
            await prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'REGISTER',
                    resource: 'AUTH',
                    details: JSON.stringify({ email: user.email, method: 'SELF_SERVICE' }),
                    ipAddress: req.ip || '0.0.0.0'
                }
            });
        } catch (e) { }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET as string,
            { expiresIn: '1d' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        console.log('Login Request Body:', req.body);
        const { email, password } = req.body;

        // Find user with deep profile relations
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                staffProfile: {
                    include: {
                        studyCenter: true,
                        unit: true
                    }
                }
            }
        });

        console.log('User found:', user ? user.email : 'NOT FOUND');

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (!user.isActive) {
            console.log(`User ${user.email} is inactive.`);
            return res.status(403).json({ message: 'Account is deactivated' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        console.log(`Password match check for ${user.email}:`, isMatch);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Log Login Event (Phase 3 Requirement)
        try {
            await prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'LOGIN',
                    resource: 'AUTH',
                    details: JSON.stringify({ ip: req.ip, userAgent: req.headers['user-agent'] }),
                    ipAddress: req.ip || '0.0.0.0'
                }
            });
        } catch (e) {
            console.error('Failed to log login event:', e);
        }

        // Generate token
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET as string,
            { expiresIn: '1d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                isActive: user.isActive,
                staffProfile: user.staffProfile
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getMe = async (req: Request, res: Response) => {
    try {
        // @ts-ignore - user is attached by middleware
        const userId = req.user?.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                createdAt: true,
                staffProfile: {
                    include: {
                        studyCenter: true,
                        unit: true
                    }
                }
            },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const validatePassword = async (req: Request, res: Response) => {
    try {
        const { password } = req.body;
        // @ts-ignore
        const userId = req.user.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Incorrect password' });
        }

        res.json({ message: 'Password validated' });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const changePassword = async (req: Request, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;
        // @ts-ignore
        const userId = req.user.id;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Incorrect current password' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        // Audit
        await prisma.auditLog.create({
            data: {
                userId,
                action: 'CHANGE_PASSWORD',
                resource: 'AUTH',
                details: 'User changed password',
                ipAddress: req.ip
            }
        });

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            // For security, do not reveal if user exists
            return res.json({ message: 'If account exists, reset instructions sent.' });
        }

        // Mock Email Sending (Phase 12 MVP)
        // In prod, generate token, save to DB, send email
        console.log(`[FORGOT_PASSWORD] Reset request for ${email}. Mock email sent.`);

        res.json({ message: 'If account exists, reset instructions sent.' });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
