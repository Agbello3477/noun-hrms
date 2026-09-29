import { Request, Response } from 'express';
import prisma from '../lib/prisma';

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
        });

        if (profile) {
          await tx.staffProfile.update({
            where: { id: profile.id },
            data: {
              ...(targetStationId ? { unitId: targetStationId } : {}),
              ...(targetCenterId ? { centerId: targetCenterId } : {}),
              lastPromotionDate: profile.lastPromotionDate,
            },
          });
        }
      }

      // 3. Append to immutable authorization audit trail
      await tx.authorizationAuditTrail.create({
        data: {
          entityType: 'STAFF_POSTING',
          entityId: posting.id,
          imputerId: posting.imputedById || posting.initiatedById,
          authorizerId,
          actionTaken: decision,
          remarks: remarks || 'Authorized by Registrar',
        },
      });

      return updatedPosting;
    });

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
