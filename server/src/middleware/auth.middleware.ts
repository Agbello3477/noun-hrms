import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

interface AuthRequest extends Request {
    user?: {
        id: string;
        role: Role;
    };
}


export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; role: Role };
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
