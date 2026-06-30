
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role, Cadre } from '@prisma/client';
import { redisService } from '../services/redis.service';
import prisma from '../prisma';

// Memory fallback for lockouts and failure counts if Redis is offline
const memoryLockoutStore = new Map<string, number>(); // email -> lockedUntil timestamp
const memoryFailureStore = new Map<string, number>(); // email -> count

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

        const resolvedRole = (role && Object.values(Role).includes(role)) ? role : Role.STAFF;
        
        let resolvedCadre: Cadre | undefined = undefined;
        if (cadre) {
            if (cadre === 'NON_ACADEMIC' || cadre === 'SENIOR') {
                resolvedCadre = Cadre.ADMINISTRATIVE;
            } else if (Object.values(Cadre).includes(cadre as any)) {
                resolvedCadre = cadre as Cadre;
            }
        }

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
export const applyPendingTransfers = async (userId: string) => {
    try {
        const pendingTransfers = await prisma.transferLog.findMany({
            where: {
                staffId: userId,
                applied: false,
                createdAt: {
                    lte: new Date(Date.now() - 48 * 60 * 60 * 1000) // 48 hours ago
                }
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        for (const log of pendingTransfers) {
            if (!log.newCenterId) continue;

            const isUnit = await prisma.unit.findUnique({
                where: { id: log.newCenterId }
            });

            if (isUnit) {
                await prisma.staffProfile.update({
                    where: { userId },
                    data: {
                        unitId: log.newCenterId,
                        centerId: null
                    }
                });
            } else {
                const isCenter = await prisma.studyCenter.findUnique({
                    where: { id: log.newCenterId }
                });
                if (isCenter) {
                    await prisma.staffProfile.update({
                        where: { userId },
                        data: {
                            centerId: log.newCenterId,
                            unitId: null
                        }
                    });
                }
            }

            await prisma.transferLog.update({
                where: { id: log.id },
                data: { applied: true }
            });
        }
    } catch (error) {
        console.error('Error applying pending transfers:', error);
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body; // email field holds either email or staffId from UI
        console.log('Login attempt for:', email);

        const identifier = String(email).trim().toLowerCase();
        const lockoutKey = `login:lockout:${identifier}`;
        const failureKey = `login:failures:${identifier}`;

        const isRedisActive = (redisService as any).isEnabled && (redisService as any).client;
        let lockedTimeLeft = 0;

        if (isRedisActive) {
            try {
                const ttl = await redisService.ttl(lockoutKey);
                if (ttl > 0) {
                    lockedTimeLeft = ttl;
                }
            } catch (err) {
                console.error('Redis check lockout error:', err);
            }
        }

        if (lockedTimeLeft <= 0) {
            // Check memory store
            const lockedUntil = memoryLockoutStore.get(identifier);
            if (lockedUntil && Date.now() < lockedUntil) {
                lockedTimeLeft = Math.ceil((lockedUntil - Date.now()) / 1000);
            }
        }

        if (lockedTimeLeft > 0) {
            return res.status(423).json({
                message: `This account has been temporarily locked due to too many failed login attempts. Please try again after ${Math.ceil(lockedTimeLeft / 60)} minutes.`,
                retryAfterSeconds: lockedTimeLeft
            });
        }

        const handleLoginFailure = async () => {
            let failures = 0;
            if (isRedisActive) {
                try {
                    failures = await redisService.incr(failureKey, 900); // 15 minutes window
                } catch (err) {
                    console.error('Redis incr failure error:', err);
                }
            }

            if (failures === 0) {
                // Fallback to memory count
                const count = (memoryFailureStore.get(identifier) || 0) + 1;
                memoryFailureStore.set(identifier, count);
                failures = count;
            }

            if (failures >= 5) {
                const lockoutSeconds = 900; // 15 minutes
                if (isRedisActive) {
                    try {
                        await redisService.set(lockoutKey, 'locked', lockoutSeconds);
                        await redisService.del(failureKey);
                    } catch (err) {
                        console.error('Redis set lockout error:', err);
                    }
                }
                memoryLockoutStore.set(identifier, Date.now() + (lockoutSeconds * 1000));
                memoryFailureStore.delete(identifier);

                return res.status(423).json({
                    message: 'Too many failed login attempts. This account has been temporarily locked for 15 minutes.',
                    retryAfterSeconds: lockoutSeconds
                });
            }

            return res.status(401).json({ message: 'Incorrect Password or Email' });
        };

        // Find user by either email or staffProfile.staffId with deep profile relations
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email },
                    { staffProfile: { staffId: email } }
                ]
            },
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
            return await handleLoginFailure();
        }

        if (!user.isActive) {
            console.log(`User ${user.email} is inactive.`);
            return res.status(403).json({ message: 'Account is deactivated' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        console.log(`Password match check for ${user.email}:`, isMatch);

        if (!isMatch) {
            return await handleLoginFailure();
        }

        // Clear failures and lockout on successful login
        if (isRedisActive) {
            try {
                await redisService.del(failureKey);
                await redisService.del(lockoutKey);
            } catch (err) {
                console.error('Redis clear credentials error:', err);
            }
        }
        memoryFailureStore.delete(identifier);
        memoryLockoutStore.delete(identifier);

        // Apply pending transfers
        await applyPendingTransfers(user.id);

        // Re-fetch updated user profile
        const updatedUser = await prisma.user.findUnique({
            where: { id: user.id },
            include: {
                staffProfile: {
                    include: {
                        studyCenter: true,
                        unit: true
                    }
                }
            }
        });

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Log Login Event (Phase 3 Requirement)
        try {
            await prisma.auditLog.create({
                data: {
                    userId: updatedUser.id,
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
            { id: updatedUser.id, role: updatedUser.role },
            process.env.JWT_SECRET as string,
            { expiresIn: '1d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                role: updatedUser.role,
                isActive: updatedUser.isActive,
                mustChangePassword: updatedUser.mustChangePassword,
                staffProfile: updatedUser.staffProfile
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

        // Apply pending transfers
        await applyPendingTransfers(userId);

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
            data: {
                password: hashedPassword,
                mustChangePassword: false
            }
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
