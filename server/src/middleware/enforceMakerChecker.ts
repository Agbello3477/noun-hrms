import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export type EntityType = 
  | 'staffPosting'
  | 'staffProfile'
  | 'promotionOverride'
  | 'disciplinaryAction'
  | 'leaveApplication'
  | 'transferLog'
  | 'user';

interface MakerCheckerOptions {
  entityType: EntityType;
  paramKey?: string; // Route parameter containing entity ID (default: "id")
  imputerField?: string; // Field containing the creator's ID (default: "imputedById")
  statusField?: string; // Field tracking workflow status (default: "status")
  allowedStatuses?: string[]; // Statuses eligible for authorization
}

/**
 * Higher-order middleware to enforce dual-control (Maker-Checker).
 * Ensures authorizer !== imputer and verifies the record is awaiting review.
 */
export function enforceMakerChecker(options: MakerCheckerOptions) {
  const {
    entityType,
    paramKey = 'id',
    imputerField = 'imputedById',
    statusField = 'status',
    allowedStatuses = ['PENDING_REGISTRAR_AUTHORIZATION', 'PENDING_REGISTRAR_APPROVAL', 'PENDING_REGISTRAR_CLEARANCE', 'PENDING_REGISTRAR_OVERRIDE']
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentUserId = (req as any).user?.id;
      const currentUserRole = (req as any).user?.role;
      const targetId = req.params[paramKey];

      if (!currentUserId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required.'
        });
      }

      if (!targetId) {
        return res.status(400).json({
          success: false,
          error: `Missing target parameter :${paramKey} in request route.`
        });
      }

      // 1. Fetch the target record dynamically via Prisma model
      const delegate = (prisma as any)[entityType];
      if (!delegate || typeof delegate.findUnique !== 'function') {
        return res.status(500).json({
          success: false,
          error: `Invalid database entity type: ${entityType}`
        });
      }

      let record = await delegate.findUnique({
        where: { id: targetId },
      }).catch(() => null);

      // Flexible fallback for profiles or records queried by alternative unique identifiers (e.g. staffId or userId)
      if (!record && delegate.findFirst) {
        record = await delegate.findFirst({
          where: {
            OR: [
              { id: targetId },
              { staffId: targetId },
              { userId: targetId }
            ]
          }
        }).catch(() => null);
      }

      if (!record) {
        return res.status(404).json({
          success: false,
          error: `Record not found for ID: ${targetId}`
        });
      }

      // 2. Validate current workflow stage
      const currentStatus = record[statusField];
      if (allowedStatuses.length > 0 && !allowedStatuses.includes(currentStatus)) {
        return res.status(409).json({
          success: false,
          error: `Action disallowed. Record is currently '${currentStatus}', not pending authorization.`
        });
      }

      // 3. Strict Maker-Checker Rule: Imputer CANNOT be Authorizer
      const imputerId = record[imputerField] || record.initiatedById || record.createdById || record.imputedById || record.roleChangeRequestedById;

      if (!imputerId) {
        return res.status(500).json({
          success: false,
          error: 'Integrity Error: Record has no traceable imputer ID attached.'
        });
      }

      if (imputerId === currentUserId) {
        return res.status(403).json({
          success: false,
          code: 'ERR_MAKER_CHECKER_SELF_AUTHORIZATION',
          error: 'Dual-control violation: You cannot authorize or sign off on a transaction you created.'
        });
      }

      // 4. Attach verified record to request for downstream controller efficiency
      (req as any).verifiedRecord = record;

      next();
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Maker-Checker verification failed.',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  };
}

export default enforceMakerChecker;
