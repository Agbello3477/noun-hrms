import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

/**
 * Role-based authorization middleware.
 * Ensures the authenticated user's role is in the list of allowed roles.
 */
export function requireRole(allowedRoles: string[] | Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;

    if (!userRole) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Access restricted to roles [${allowedRoles.join(', ')}]. Current role: '${userRole}'.`
      });
    }

    next();
  };
}

export default requireRole;
