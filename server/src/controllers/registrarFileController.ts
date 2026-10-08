import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import crypto from 'crypto';

export async function clearStaffFileHandler(req: Request, res: Response) {
  const authorizerId = (req as any).user.id;
  const profile = (req as any).verifiedRecord; // Loaded by enforceMakerChecker
  const { remarks } = req.body;

  try {
    const now = new Date();
    const digitalStamp = `NOUN-CLEARANCE-STAMP-${Date.now().toString(36).toUpperCase()}`;

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Update StaffProfile status
      const updatedProfile = await tx.staffProfile.update({
        where: { id: profile.id },
        data: {
          accountStatus: 'CLEARED_ACTIVE',
          isActivated: true,
          clearedAt: now,
          clearedById: authorizerId,
          clearanceRemarks: remarks || 'Officially cleared by Registrar',
        },
      });

      // 2. Activate User account
      if (profile.userId) {
        await tx.user.update({
          where: { id: profile.userId },
          data: {
            isActive: true,
          },
        });
      }

      // 3. Append to immutable authorization audit trail
      await tx.authorizationAuditTrail.create({
        data: {
          entityType: 'FILE_CREATION',
          entityId: profile.id,
          imputerId: profile.createdById || profile.userId,
          authorizerId,
          actionTaken: 'APPROVED',
          remarks: remarks || 'Staff file cleared and activated',
          digitalStampRef: digitalStamp,
          metadata: {
            staffId: profile.staffId,
          },
        },
      });

      return updatedProfile;
    });

    return res.status(200).json({
      success: true,
      message: 'Staff digital file successfully cleared and activated.',
      data: result,
    });
  } catch (error: any) {
    console.error('Error in clearStaffFileHandler:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process staff file clearance.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

export default clearStaffFileHandler;
