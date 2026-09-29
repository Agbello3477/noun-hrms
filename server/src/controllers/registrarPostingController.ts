import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { redisService } from '../services/redis.service';

export async function authorizeStaffPostingHandler(req: Request, res: Response) {
  const authorizerId = (req as any).user.id;
  const posting = (req as any).verifiedRecord; // Loaded by middleware
  const { decision, remarks } = req.body; // decision: 'APPROVED' | 'REJECTED'

  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({ error: "Decision must be 'APPROVED' or 'REJECTED'." });
  }

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Update the posting order
      const postingDelegate = tx.staffPosting || tx.transferLog;
      const updatedPosting = await postingDelegate.update({
        where: { id: posting.id },
        data: {
          status: decision === 'APPROVED' ? 'AUTHORIZED' : 'REJECTED',
          authorizedById: authorizerId,
          authorizedAt: new Date(),
          authorizationRemarks: remarks || null,
          isEffective: decision === 'APPROVED',
          applied: decision === 'APPROVED'
        },
      });

      // 2. If approved, update the staff member's live station
      if (decision === 'APPROVED') {
        const targetStationId = posting.destinationStationId || posting.newUnitId;
        const targetCenterId = posting.destinationCenterId || posting.newCenterId;

        // Support lookup by profile id or user id
        const profile = await tx.staffProfile.findFirst({
          where: {
            OR: [
              { id: posting.staffId },
              { userId: posting.staffId }
            ]
          }
        }).catch(() => null);

        if (profile) {
          const updateData: any = {};
          if (targetStationId) {
            const unitExists = tx.unit?.findUnique 
              ? await tx.unit.findUnique({ where: { id: targetStationId } }).catch(() => null)
              : { id: targetStationId };
            if (unitExists) {
              updateData.unitId = unitExists.id;
            }
          }
          if (targetCenterId && targetCenterId !== targetStationId) {
            const centerExists = tx.studyCenter?.findUnique 
              ? await tx.studyCenter.findUnique({ where: { id: targetCenterId } }).catch(() => null)
              : { id: targetCenterId };
            if (centerExists) {
              updateData.centerId = centerExists.id;
            }
          }
          if (Object.keys(updateData).length > 0) {
            await tx.staffProfile.update({
              where: { id: profile.id },
              data: updateData,
            });
          }
        }
      }

      // 3. Append to immutable authorization audit trail (safely handled)
      try {
        await tx.authorizationAuditTrail.create({
          data: {
            entityType: 'STAFF_POSTING',
            entityId: posting.id,
            imputerId: posting.imputedById || posting.initiatedById || authorizerId,
            authorizerId,
            actionTaken: decision,
            remarks: remarks || (decision === 'APPROVED' ? 'Authorized by Registrar' : 'Rejected by Registrar'),
          },
        });
      } catch (auditErr) {
        console.warn('authorizationAuditTrail notice:', auditErr);
      }

      return updatedPosting;
    });

    // Invalidate caches
    await Promise.all([
      redisService.clearPattern('staff:*'),
      redisService.clearPattern('registrar:*'),
      redisService.clearPattern('analytics:*')
    ]).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `Staff posting order successfully ${decision.toLowerCase()}.`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error in authorizeStaffPostingHandler:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process staff posting authorization.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

export default authorizeStaffPostingHandler;
