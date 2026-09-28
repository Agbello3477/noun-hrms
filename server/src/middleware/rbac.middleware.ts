import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

export enum Permission {
    CAN_IMPUTE_POSTING = 'CAN_IMPUTE_POSTING',
    CAN_AUTHORIZE_POSTING = 'CAN_AUTHORIZE_POSTING',
    CAN_IMPUTE_STAFF_FILE = 'CAN_IMPUTE_STAFF_FILE',
    CAN_CLEAR_STAFF_FILE = 'CAN_CLEAR_STAFF_FILE',
    CAN_REQUEST_PROMOTION_OVERRIDE = 'CAN_REQUEST_PROMOTION_OVERRIDE',
    CAN_APPROVE_PROMOTION_OVERRIDE = 'CAN_APPROVE_PROMOTION_OVERRIDE',
    CAN_ISSUE_DISCIPLINARY_QUERY = 'CAN_ISSUE_DISCIPLINARY_QUERY',
    CAN_RATIFY_DISCIPLINARY_SANCTION = 'CAN_RATIFY_DISCIPLINARY_SANCTION',
}

/**
 * Strict Dual-Control RBAC Permission Mapping:
 * An authorizer / principal officer (REGISTRAR, DEPUTY_REGISTRAR) NEVER has imputation rights.
 * An imputer / clerk (REGISTRY_ADMIN, HR_ADMIN) NEVER has authorization rights.
 */
export const ROLE_PERMISSIONS: Partial<Record<Role, Permission[]>> = {
    [Role.REGISTRY_ADMIN]: [
        Permission.CAN_IMPUTE_POSTING,
        Permission.CAN_IMPUTE_STAFF_FILE,
        Permission.CAN_REQUEST_PROMOTION_OVERRIDE,
        Permission.CAN_ISSUE_DISCIPLINARY_QUERY,
    ],
    [Role.HR_ADMIN]: [
        Permission.CAN_IMPUTE_POSTING,
        Permission.CAN_IMPUTE_STAFF_FILE,
        Permission.CAN_REQUEST_PROMOTION_OVERRIDE,
        Permission.CAN_ISSUE_DISCIPLINARY_QUERY,
    ],
    [Role.REGISTRAR]: [
        Permission.CAN_AUTHORIZE_POSTING,
        Permission.CAN_CLEAR_STAFF_FILE,
        Permission.CAN_APPROVE_PROMOTION_OVERRIDE,
        Permission.CAN_RATIFY_DISCIPLINARY_SANCTION,
    ],
    [Role.DEPUTY_REGISTRAR]: [
        Permission.CAN_AUTHORIZE_POSTING,
        Permission.CAN_CLEAR_STAFF_FILE,
        Permission.CAN_APPROVE_PROMOTION_OVERRIDE,
        Permission.CAN_RATIFY_DISCIPLINARY_SANCTION,
    ],
    [Role.SUPER_USER]: [
        // Note: Even SUPER_USER cannot self-authorize if they imputed a record.
        Permission.CAN_IMPUTE_POSTING,
        Permission.CAN_AUTHORIZE_POSTING,
        Permission.CAN_IMPUTE_STAFF_FILE,
        Permission.CAN_CLEAR_STAFF_FILE,
        Permission.CAN_REQUEST_PROMOTION_OVERRIDE,
        Permission.CAN_APPROVE_PROMOTION_OVERRIDE,
        Permission.CAN_ISSUE_DISCIPLINARY_QUERY,
        Permission.CAN_RATIFY_DISCIPLINARY_SANCTION,
    ],
    [Role.VICE_CHANCELLOR]: [
        Permission.CAN_AUTHORIZE_POSTING,
        Permission.CAN_CLEAR_STAFF_FILE,
        Permission.CAN_APPROVE_PROMOTION_OVERRIDE,
        Permission.CAN_RATIFY_DISCIPLINARY_SANCTION,
    ],
};

/**
 * Checks if a specific role possesses the requested permission.
 */
export const hasPermission = (role: Role | undefined, permission: Permission): boolean => {
    if (!role) return false;
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.includes(permission);
};

/**
 * Middleware factory requiring a specific atomic permission.
 */
export const requirePermission = (permission: Permission) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // @ts-ignore
        const user = req.user;
        if (!user || !user.role) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Explicit Authorizer vs Imputer separation check:
        // If an Authorizer attempts an imputation action, explicitly deny with 403
        if (
            (permission === Permission.CAN_IMPUTE_POSTING || permission === Permission.CAN_IMPUTE_STAFF_FILE) &&
            (user.role === Role.REGISTRAR || user.role === Role.DEPUTY_REGISTRAR)
        ) {
            return res.status(403).json({
                message: 'Forbidden: Authorizers and Principal Officers cannot impute or draft operational records. Dual-control governance violation.'
            });
        }

        // If an Imputer attempts an authorization action, explicitly deny with 403
        if (
            (permission === Permission.CAN_AUTHORIZE_POSTING || permission === Permission.CAN_CLEAR_STAFF_FILE || permission === Permission.CAN_APPROVE_PROMOTION_OVERRIDE) &&
            (user.role === Role.REGISTRY_ADMIN || user.role === Role.HR_ADMIN)
        ) {
            return res.status(403).json({
                message: 'Forbidden: Operational Imputers cannot authorize or clear records. Executive Registrar clearance required.'
            });
        }

        if (!hasPermission(user.role as Role, permission)) {
            return res.status(403).json({
                message: `Forbidden: Account does not hold the required '${permission}' privilege.`
            });
        }

        next();
    };
};

/**
 * Middleware requiring Imputer role (REGISTRY_ADMIN, HR_ADMIN).
 * Explicitly rejects REGISTRAR and DEPUTY_REGISTRAR.
 */
export const requireImputerRole = (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const role = req.user?.role;
    if (role === Role.REGISTRAR || role === Role.DEPUTY_REGISTRAR) {
        return res.status(403).json({
            message: 'Forbidden: Authorizers cannot impute operational records. Dual-control segregation enforced.'
        });
    }

    if (role === Role.REGISTRY_ADMIN || role === Role.HR_ADMIN || role === Role.SUPER_USER) {
        return next();
    }

    return res.status(403).json({
        message: 'Forbidden: Only Registry or HR Admins (Imputers) can perform this action.'
    });
};

/**
 * Middleware requiring Authorizer role (REGISTRAR, DEPUTY_REGISTRAR).
 * Explicitly rejects REGISTRY_ADMIN and HR_ADMIN.
 */
export const requireAuthorizerRole = (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const role = req.user?.role;
    if (role === Role.REGISTRY_ADMIN || role === Role.HR_ADMIN) {
        return res.status(403).json({
            message: 'Forbidden: Operational Imputers cannot authorize or clear records. Dual-control segregation enforced.'
        });
    }

    if (
        role === Role.REGISTRAR ||
        role === Role.DEPUTY_REGISTRAR ||
        role === Role.VICE_CHANCELLOR ||
        role === Role.SUPER_USER
    ) {
        return next();
    }

    return res.status(403).json({
        message: 'Forbidden: Only the Registrar, Deputy Registrar, or Vice Chancellor can authorize records.'
    });
};

/**
 * Immutable Dual-Control Constraint Check:
 * Enforces that authorizerId !== imputerId under all circumstances, even if the user is a SUPER_USER.
 */
export const validateDualControlSelfAuthorization = (imputerId: string | null | undefined, authorizerId: string): void => {
    if (imputerId && authorizerId && imputerId === authorizerId) {
        const error: any = new Error('Self-authorization is strictly prohibited. The creating officer cannot clear or sign off on their own record.');
        error.status = 403;
        error.statusCode = 403;
        throw error;
    }
};
