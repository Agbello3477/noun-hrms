import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import prisma from '../prisma';
import { redisService } from '../services/redis.service';

interface AuthRequest extends Request {
    user?: {
        id: string;
        role: Role;
        iat?: number;
    };
}


export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; role: Role; iat?: number; isTemp2FA?: boolean };
        
        if (decoded.isTemp2FA) {
            return res.status(403).json({ message: 'Temporary tokens cannot be used for standard API access' });
        }
        
        // ─── Token Revocation Check ─────────────────────────────────────────
        // If the account was archived (retired/resigned/fired/deceased), the
        // tokenInvalidatedAt timestamp is set. Any token issued BEFORE that
        // timestamp is considered revoked, even if it hasn't expired yet.
        // Redis Session Cache check
        const sessionKey = `user:session:${decoded.id}`;
        let cachedSession = await redisService.get<{ isActive: boolean; tokenInvalidatedAt: string | null }>(sessionKey);
        
        let user;
        if (cachedSession) {
            user = {
                isActive: cachedSession.isActive,
                tokenInvalidatedAt: cachedSession.tokenInvalidatedAt ? new Date(cachedSession.tokenInvalidatedAt) : null
            };
        } else {
            user = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: { isActive: true, tokenInvalidatedAt: true }
            });
            if (user) {
                await redisService.set(sessionKey, {
                    isActive: user.isActive,
                    tokenInvalidatedAt: user.tokenInvalidatedAt ? user.tokenInvalidatedAt.toISOString() : null
                }, 600); // 10 minutes cache TTL
            }
        }

        if (!user) {
            return res.status(401).json({ message: 'Account not found' });
        }

        if (!user.isActive) {
            return res.status(401).json({ 
                message: 'Your account has been deactivated. Please contact HR for assistance.',
                code: 'ACCOUNT_DEACTIVATED'
            });
        }

        if (user.tokenInvalidatedAt && decoded.iat) {
            const invalidatedAt = Math.floor(user.tokenInvalidatedAt.getTime() / 1000);
            if (decoded.iat < invalidatedAt) {
                return res.status(401).json({ 
                    message: 'Your session has been revoked. Please log in again.',
                    code: 'SESSION_REVOKED'
                });
            }
        }
        // ────────────────────────────────────────────────────────────────────

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};

export const requireRole = (roles: (Role | string)[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }
        // SUPER_USER and ADMIN roles bypass all route-based restrictions globally
        if (req.user.role === Role.SUPER_USER || req.user.role === Role.ADMIN || roles.includes(req.user.role)) {
            return next();
        }
        return res.status(403).json({ message: 'Insufficient permissions' });
    };
};
