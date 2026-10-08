import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../prisma';
import {
  FileRequisitionStatus,
  FileRequisitionUrgency,
  FileRequestedFormat,
  FileCustodyAction,
  Role,
} from '@prisma/client';
import { notifyUser } from './notification.controller';
import { cacheInvalidationService } from '../services/cacheInvalidationService';

/**
 * Generate unique Requisition Number: NOUN/REQ/FILE/YYYY/NNNNN
 */
async function generateRequisitionNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.fileRequisition.count({
    where: {
      createdAt: {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
      },
    },
  });
  const seq = String(count + 1).padStart(5, '0');
  let reqNo = `NOUN/REQ/FILE/${year}/${seq}`;

  const exists = await prisma.fileRequisition.findUnique({
    where: { requisitionNumber: reqNo },
  });
  if (exists) {
    const salt = Math.floor(100 + Math.random() * 900);
    reqNo = `NOUN/REQ/FILE/${year}/${seq}-${salt}`;
  }
  return reqNo;
}

/**
 * Generate unique Dispatch Receipt Number: NOUN/DISPATCH/YYYY/NNNNN
 */
async function generateDispatchReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.fileRequisition.count({
    where: {
      dispatchReceiptNumber: { not: null },
    },
  });
  const seq = String(count + 1).padStart(5, '0');
  let receiptNo = `NOUN/DISPATCH/${year}/${seq}`;

  const exists = await prisma.fileRequisition.findUnique({
    where: { dispatchReceiptNumber: receiptNo },
  });
  if (exists) {
    const salt = Math.floor(100 + Math.random() * 900);
    receiptNo = `NOUN/DISPATCH/${year}/${seq}-${salt}`;
  }
  return receiptNo;
}

/**
 * Helper to get client IP and User Agent safely
 */
function getClientMeta(req: Request) {
  const ipAddress =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';
  const userAgent = (req.headers['user-agent'] as string) || 'Internal System';
  return { ipAddress, userAgent };
}

/**
 * Helper to notify users with given roles
 */
async function notifyRoleUsers(roles: Role[], title: string, message: string, link?: string) {
  try {
    const targetUsers = await prisma.user.findMany({
      where: { role: { in: roles }, isActive: true },
      select: { id: true },
      take: 20,
    });
    for (const u of targetUsers) {
      await notifyUser(u.id, title, message, 'INFO', link);
    }
  } catch (err) {
    console.error('Error notifying role users:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1: LODGE FILE REQUISITION & ELIGIBLE STAFF DIRECTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/registry/file-requests/eligible-staff
 * Returns auto-detected requesting department and staff options within requester's unit/study center/faculty
 */
export async function getEligibleStaffForRequisition(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const requester = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        staffProfile: {
          include: {
            unit: true,
            studyCenter: true,
          },
        },
      },
    });

    if (!requester) {
      return res.status(404).json({ success: false, error: 'User profile not found.' });
    }

    // Auto-detect Requesting Department / Unit
    let requestingDepartment = requester.staffProfile?.unit?.name ||
      requester.staffProfile?.studyCenter?.name ||
      requester.staffProfile?.department ||
      'National Open University of Nigeria';

    const unitId = requester.staffProfile?.unitId;
    const centerId = requester.staffProfile?.centerId;
    const userRole = requester.role;

    // Check if requester is Head of Unit (e.g., unit.headId === userId)
    let unitHeadUnits: string[] = [];
    if (unitId) {
      unitHeadUnits.push(unitId);
    }
    const headedUnits = await prisma.unit.findMany({
      where: { headId: userId },
      select: { id: true, name: true },
    });
    headedUnits.forEach((u) => {
      if (!unitHeadUnits.includes(u.id)) {
        unitHeadUnits.push(u.id);
      }
    });

    let staffList: any[] = [];

    // If unit or study center is defined for this leader/officer
    if (unitHeadUnits.length > 0) {
      staffList = await prisma.staffProfile.findMany({
        where: {
          unitId: { in: unitHeadUnits },
        },
        select: {
          id: true,
          staffId: true,
          rank: true,
          title: true,
          surname: true,
          otherNames: true,
          department: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          unit: {
            select: { id: true, name: true, type: true },
          },
          studyCenter: {
            select: { id: true, name: true },
          },
        },
        orderBy: {
          user: { name: 'asc' },
        },
      });
    } else if (centerId) {
      staffList = await prisma.staffProfile.findMany({
        where: {
          centerId: centerId,
        },
        select: {
          id: true,
          staffId: true,
          rank: true,
          title: true,
          surname: true,
          otherNames: true,
          department: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          unit: {
            select: { id: true, name: true, type: true },
          },
          studyCenter: {
            select: { id: true, name: true },
          },
        },
        orderBy: {
          user: { name: 'asc' },
        },
      });
    }

    // If staff list is empty or user is university-wide admin (HR_ADMIN, REGISTRY_ADMIN, REGISTRAR, VC, SUPER_USER)
    if (
      staffList.length === 0 ||
      ['HR_ADMIN', 'REGISTRY_ADMIN', 'REGISTRAR', 'DEPUTY_REGISTRAR', 'SUPER_USER', 'ADMIN', 'VICE_CHANCELLOR'].includes(userRole)
    ) {
      const allStaff = await prisma.staffProfile.findMany({
        take: 300,
        select: {
          id: true,
          staffId: true,
          rank: true,
          title: true,
          surname: true,
          otherNames: true,
          department: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          unit: {
            select: { id: true, name: true, type: true },
          },
          studyCenter: {
            select: { id: true, name: true },
          },
        },
        orderBy: {
          user: { name: 'asc' },
        },
      });
      if (staffList.length === 0) {
        staffList = allStaff;
      }
    }

    return res.status(200).json({
      success: true,
      requestingDepartment,
      unitScope: requester.staffProfile?.unit || requester.staffProfile?.studyCenter || null,
      staff: staffList,
    });
  } catch (err: any) {
    console.error('Error in getEligibleStaffForRequisition:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve eligible staff list.' });
  }
}

/**
 * POST /api/v1/registry/file-requests/lodge
 * Supports both single staff requisition and batch multi-staff requisitions
 */
export async function lodgeRequisition(req: Request, res: Response) {
  try {
    const requesterId = (req as any).user?.id;
    if (!requesterId) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const {
      staffProfileId,
      staffProfileIds: rawStaffProfileIds,
      requesterDepartment,
      purposeOfRequest,
      urgencyLevel = 'ROUTINE',
      requestedFileFormat = 'PHYSICAL_HARDCOPY',
      expectedReturnDate,
    } = req.body;

    const staffProfileIds: string[] =
      Array.isArray(rawStaffProfileIds) && rawStaffProfileIds.length > 0
        ? rawStaffProfileIds
        : staffProfileId
        ? [staffProfileId]
        : [];

    if (staffProfileIds.length === 0 || !requesterDepartment || !purposeOfRequest) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: at least one Subject Personnel Record, requesterDepartment, and purposeOfRequest are mandatory.',
      });
    }

    // Verify all target staff profiles exist
    const targetStaffProfiles = await prisma.staffProfile.findMany({
      where: { id: { in: staffProfileIds } },
      include: { user: { select: { name: true, email: true } } },
    });

    if (targetStaffProfiles.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Target staff record(s) could not be found.',
      });
    }

    const { ipAddress, userAgent } = getClientMeta(req);

    const createdRequisitions = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const targetStaff of targetStaffProfiles) {
        const requisitionNumber = await generateRequisitionNumber();
        const requisition = await tx.fileRequisition.create({
          data: {
            requisitionNumber,
            staffProfileId: targetStaff.id,
            requesterId,
            requesterDepartment,
            purposeOfRequest,
            urgencyLevel: urgencyLevel as FileRequisitionUrgency,
            requestedFileFormat: requestedFileFormat as FileRequestedFormat,
            expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
            status: FileRequisitionStatus.SUBMITTED,
          },
          include: {
            staffProfile: {
              select: {
                id: true,
                staffId: true,
                rank: true,
                department: true,
                user: { select: { name: true, email: true } },
              },
            },
            requester: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        });

        await tx.fileCustodyAuditTrail.create({
          data: {
            requisitionId: requisition.id,
            action: FileCustodyAction.REQUISITION_SUBMITTED,
            actorId: requesterId,
            details: `Requisition lodged for staff file: ${targetStaff.staffId || 'N/A'} (${targetStaff.user?.name || 'Staff'}). Urgency: ${urgencyLevel}. Format: ${requestedFileFormat}.`,
            ipAddress,
            userAgent,
            metadata: {
              purpose: purposeOfRequest,
              requesterDepartment,
              urgencyLevel,
              requestedFileFormat,
            },
          },
        });

        results.push(requisition);
      }
      return results;
    });

    // Alert Registry Records Desk
    const staffNames = targetStaffProfiles
      .map((s) => s.user?.name || s.staffId || 'Staff')
      .slice(0, 3)
      .join(', ');
    const countText =
      targetStaffProfiles.length > 1 ? ` (${targetStaffProfiles.length} staff files)` : '';

    notifyRoleUsers(
      [Role.REGISTRY_ADMIN, Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN],
      'New Personnel File Requisition Lodged',
      `File requisition lodged for ${staffNames}${countText} by ${requesterDepartment}.`,
      `/dashboard/registry/file-requests/inward`
    );

    await cacheInvalidationService.invalidateFileRequisitions();

    return res.status(201).json({
      success: true,
      data: createdRequisitions[0],
      requisitions: createdRequisitions,
      count: createdRequisitions.length,
      message: `${createdRequisitions.length} file requisition(s) successfully lodged and submitted to Registry Records desk.`,
    });
  } catch (error: any) {
    console.error('Error lodging file requisition:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An unexpected error occurred while lodging the file requisition.',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2: REGISTRY INTAKE & ACKNOWLEDGMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/registry/file-requests/:id/acknowledge
 */
export async function acknowledgeRequisition(req: Request, res: Response) {
  try {
    const actorId = (req as any).user?.id;
    const { id } = req.params;
    const rawAction = req.body.action || req.body.decision;
    const action = rawAction ? String(rawAction).trim().toUpperCase() : '';
    const registryFolioReference = req.body.registryFolioReference || req.body.folioReference || req.body.folio;
    const adminAcknowledgmentRemarks = req.body.adminAcknowledgmentRemarks || req.body.remarks || req.body.comment;

    if (!action || !['ACKNOWLEDGE', 'REJECT', 'ACKNOWLEDGED', 'REJECTED'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be either ACKNOWLEDGE or REJECT.',
      });
    }

    const normalizedAction = ['ACKNOWLEDGE', 'ACKNOWLEDGED'].includes(action) ? 'ACKNOWLEDGE' : 'REJECT';

    const requisition = await prisma.fileRequisition.findUnique({
      where: { id },
      include: {
        staffProfile: { include: { user: { select: { name: true, email: true } } } },
        requester: { select: { id: true, name: true, email: true } },
      },
    });

    if (!requisition) {
      return res.status(404).json({ success: false, error: 'File requisition not found.' });
    }

    if (requisition.status !== FileRequisitionStatus.SUBMITTED) {
      return res.status(400).json({
        success: false,
        error: `Cannot acknowledge requisition in status: ${requisition.status}. Must be SUBMITTED.`,
      });
    }

    const { ipAddress, userAgent } = getClientMeta(req);
    const year = new Date().getFullYear();

    if (normalizedAction === 'REJECT') {
      if (!adminAcknowledgmentRemarks) {
        return res.status(400).json({
          success: false,
          error: 'Rejection remarks are mandatory when rejecting a file requisition at Registry intake.',
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const item = await tx.fileRequisition.update({
          where: { id },
          data: {
            status: FileRequisitionStatus.REJECTED_BY_REGISTRY,
            acknowledgedById: actorId,
            acknowledgedAt: new Date(),
            adminAcknowledgmentRemarks,
          },
        });

        await tx.fileCustodyAuditTrail.create({
          data: {
            requisitionId: id,
            action: FileCustodyAction.REQUISITION_SUBMITTED, // Recorded in trail
            actorId,
            details: `Registry intake rejected requisition: ${adminAcknowledgmentRemarks}`,
            ipAddress,
            userAgent,
            metadata: { action: 'REJECT', remarks: adminAcknowledgmentRemarks },
          },
        });

        return item;
      });

      // Notify requester
      await notifyUser(
        requisition.requesterId,
        'File Requisition Rejected by Registry',
        `Your file requisition ${requisition.requisitionNumber} was rejected by Registry Records Desk: ${adminAcknowledgmentRemarks}`,
        'ERROR',
        `/registry/file-requests/my`
      );

      return res.status(200).json({
        success: true,
        data: updated,
        message: 'File requisition rejected at Registry intake.',
      });
    }

    // Action: ACKNOWLEDGE
    const assignedFolio =
      registryFolioReference?.trim() ||
      `NOUN/FOLIO/VAULT/${year}/${requisition.requisitionNumber.split('/').pop() || '001'}`;

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.fileRequisition.update({
        where: { id },
        data: {
          status: FileRequisitionStatus.ACKNOWLEDGED_PENDING_REGISTRAR,
          acknowledgedById: actorId,
          acknowledgedAt: new Date(),
          registryFolioReference: assignedFolio,
          adminAcknowledgmentRemarks: adminAcknowledgmentRemarks || 'Folio verified in Registry Vault.',
        },
      });

      await tx.fileCustodyAuditTrail.create({
        data: {
          requisitionId: id,
          action: FileCustodyAction.ACKNOWLEDGED_AND_FORWARDED,
          actorId,
          details: `Requisition acknowledged and vaulted under Folio [${assignedFolio}]. Forwarded to Registrar for release authorization.`,
          ipAddress,
          userAgent,
          metadata: {
            assignedFolio,
            remarks: adminAcknowledgmentRemarks,
          },
        },
      });

      return item;
    });

    // Notify Registrar
    notifyRoleUsers(
      [Role.REGISTRAR, Role.DEPUTY_REGISTRAR, Role.SUPER_USER, Role.ADMIN],
      'Executive Authorization Required: Personnel File Requisition',
      `File requisition ${requisition.requisitionNumber} (Folio ${assignedFolio}) for staff ${requisition.staffProfile?.user?.name || 'Staff'} awaits executive release authorization.`,
      `/registrar-cockpit/file-releases`
    );

    // Notify requester
    await notifyUser(
      requisition.requesterId,
      'File Requisition Acknowledged',
      `Your file requisition ${requisition.requisitionNumber} has been acknowledged by Registry (Folio: ${assignedFolio}) and forwarded to the Registrar for authorization.`,
      'INFO',
      `/registry/file-requests/my`
    );

    await cacheInvalidationService.invalidateFileRequisitions();

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'File requisition acknowledged, folio assigned, and forwarded to Registrar for executive authorization.',
    });
  } catch (error: any) {
    console.error('Error acknowledging requisition:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to acknowledge file requisition.',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 3: REGISTRAR EXECUTIVE AUTHORIZATION (WITH MAKER-CHECKER)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/registrar/file-requests/:id/authorize
 */
export async function registrarAuthorizeRequisition(req: Request, res: Response) {
  try {
    const actorId = (req as any).user?.id;
    const { id } = req.params;
    const rawAction = req.body.action || req.body.decision;
    const action = rawAction ? String(rawAction).trim().toUpperCase() : '';
    const rawRemarks = req.body.registrarRemarks || req.body.remarks || req.body.comment || '';
    const registrarRemarks = typeof rawRemarks === 'string' ? rawRemarks.trim() : '';

    if (!action || !['APPROVE', 'DECLINE', 'APPROVED', 'DECLINED', 'REJECT', 'REJECTED'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid decision action. Must be either APPROVE or DECLINE.',
      });
    }

    const normalizedAction = ['APPROVE', 'APPROVED'].includes(action) ? 'APPROVE' : 'DECLINE';

    const requisition = await prisma.fileRequisition.findUnique({
      where: { id },
      include: {
        staffProfile: {
          select: {
            id: true,
            userId: true,
            staffId: true,
            user: { select: { name: true, email: true } },
          },
        },
        requester: { select: { id: true, name: true, email: true } },
      },
    });

    if (!requisition) {
      return res.status(404).json({ success: false, error: 'File requisition not found.' });
    }

    if (requisition.status !== FileRequisitionStatus.ACKNOWLEDGED_PENDING_REGISTRAR) {
      return res.status(400).json({
        success: false,
        error: `Cannot authorize requisition in status: ${requisition.status}. Must be ACKNOWLEDGED_PENDING_REGISTRAR.`,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DUAL-CONTROL / MAKER-CHECKER STATUTORY GOVERNANCE ENFORCEMENT
    // ─────────────────────────────────────────────────────────────────────────
    // 1. Authorizer cannot be the requester who lodged the file request
    if (requisition.requesterId === actorId) {
      return res.status(403).json({
        success: false,
        error:
          'Maker-Checker Violation: Statutory regulations prohibit the requisition initiator from authorizing their own file request. A neutral authorized officer must conduct this determination.',
      });
    }

    // 2. Authorizer cannot be the subject whose confidential personnel file is being requested
    if (requisition.staffProfile.userId === actorId) {
      return res.status(403).json({
        success: false,
        error:
          'Maker-Checker Violation: Statutory regulations strictly prohibit an executive officer from authorizing the release of their own personnel dossier.',
      });
    }

    const { ipAddress, userAgent } = getClientMeta(req);

    if (normalizedAction === 'DECLINE') {
      if (!registrarRemarks?.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Statutory executive remarks are mandatory when declining a personnel file release.',
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const item = await tx.fileRequisition.update({
          where: { id },
          data: {
            status: FileRequisitionStatus.DECLINED_BY_REGISTRAR,
            authorizedById: actorId,
            authorizedAt: new Date(),
            registrarRemarks,
          },
        });

        await tx.fileCustodyAuditTrail.create({
          data: {
            requisitionId: id,
            action: FileCustodyAction.REGISTRAR_DECLINED,
            actorId,
            details: `Registrar declined file release: ${registrarRemarks}`,
            ipAddress,
            userAgent,
            metadata: { action: 'DECLINE', remarks: registrarRemarks },
          },
        });

        return item;
      });

      // Notify Registry & Requester
      notifyRoleUsers(
        [Role.REGISTRY_ADMIN, Role.HR_ADMIN],
        'File Release Request Declined by Registrar',
        `File requisition ${requisition.requisitionNumber} for ${requisition.staffProfile?.user?.name || 'Staff'} was declined by the Registrar.`,
        `/registry/file-requests/inward`
      );

      await notifyUser(
        requisition.requesterId,
        'File Release Requisition Declined',
        `Your requisition for file ${requisition.requisitionNumber} was declined by the Registrar: ${registrarRemarks}`,
        'ERROR',
        `/registry/file-requests/my`
      );

      return res.status(200).json({
        success: true,
        data: updated,
        message: 'File release requisition declined by Registrar.',
      });
    }

    // Action: APPROVE
    const dispatchReceiptNumber = requisition.dispatchReceiptNumber || (await generateDispatchReceiptNumber());
    let digitalAccessToken: string | null = requisition.digitalAccessToken;
    let digitalAccessExpiresAt: Date | null = requisition.digitalAccessExpiresAt;

    if (
      requisition.requestedFileFormat === FileRequestedFormat.DIGITAL_TRANSCRIPT ||
      requisition.requestedFileFormat === FileRequestedFormat.BOTH
    ) {
      if (!digitalAccessToken || !digitalAccessExpiresAt || digitalAccessExpiresAt < new Date()) {
        digitalAccessToken = crypto.randomBytes(32).toString('hex');
        digitalAccessExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.fileRequisition.update({
        where: { id },
        data: {
          status: FileRequisitionStatus.AUTHORIZED_BY_REGISTRAR,
          authorizedById: actorId,
          authorizedAt: new Date(),
          registrarRemarks: registrarRemarks || 'File release authorized by Registrar pursuant to institutional custody protocols.',
          dispatchReceiptNumber,
          digitalAccessToken,
          digitalAccessExpiresAt,
        },
      });

      await tx.fileCustodyAuditTrail.create({
        data: {
          requisitionId: id,
          action: FileCustodyAction.REGISTRAR_AUTHORIZED,
          actorId,
          details: `Executive release granted by Registrar. Remarks: ${registrarRemarks || 'Approved'}. ${
            digitalAccessToken ? `Digital access token generated valid until ${digitalAccessExpiresAt?.toISOString()}` : ''
          }`,
          ipAddress,
          userAgent,
          metadata: {
            action: 'APPROVE',
            remarks: registrarRemarks,
            dispatchReceiptNumber,
            hasDigitalToken: !!digitalAccessToken,
            digitalExpires: digitalAccessExpiresAt,
          },
        },
      });

      return item;
    });

    // Notify Registry Records Desk to prepare file for dispatch
    notifyRoleUsers(
      [Role.REGISTRY_ADMIN, Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN],
      'File Release Authorized - Ready for Dispatch',
      `File requisition ${requisition.requisitionNumber} for ${requisition.staffProfile?.user?.name || 'Staff'} has been authorized by the Registrar. Proceed with physical handover / digital release.`,
      `/dashboard/registry/file-requests/ready-for-dispatch`
    );

    // Notify requester
    await notifyUser(
      requisition.requesterId,
      'File Requisition Authorized by Registrar',
      `Your file requisition ${requisition.requisitionNumber} has been approved by the Registrar. You can now view your digital transcript or collect the file at Registry Vault.`,
      'SUCCESS',
      `/dashboard/services/file-requests`
    );

    await cacheInvalidationService.invalidateFileRequisitions();

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Personnel file release authorized by Registrar. Dispatched to Registry records desk for custody transfer.',
    });
  } catch (error: any) {
    console.error('Error authorizing requisition:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to authorize file requisition.',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 4: REGISTRY PHYSICAL DISPATCH & DIGITAL ACCESS RELEASE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/registry/file-requests/:id/dispatch
 */
export async function dispatchRequisition(req: Request, res: Response) {
  try {
    const actorId = (req as any).user?.id;
    const { id } = req.params;
    const { trackingNotes, digitalAccessHours = 48 } = req.body;

    const requisition = await prisma.fileRequisition.findUnique({
      where: { id },
      include: {
        staffProfile: { include: { user: { select: { name: true, email: true } } } },
        requester: { select: { id: true, name: true, email: true } },
      },
    });

    if (!requisition) {
      return res.status(404).json({ success: false, error: 'File requisition not found.' });
    }

    if (requisition.status !== FileRequisitionStatus.AUTHORIZED_BY_REGISTRAR) {
      return res.status(400).json({
        success: false,
        error: `Cannot dispatch file. Status must be AUTHORIZED_BY_REGISTRAR. Current: ${requisition.status}`,
      });
    }

    const dispatchReceiptNumber = await generateDispatchReceiptNumber();
    const { ipAddress, userAgent } = getClientMeta(req);

    // If digital transcript or both, generate secure single-session access token
    let digitalAccessToken: string | null = null;
    let digitalAccessExpiresAt: Date | null = null;

    if (
      requisition.requestedFileFormat === FileRequestedFormat.DIGITAL_TRANSCRIPT ||
      requisition.requestedFileFormat === FileRequestedFormat.BOTH
    ) {
      digitalAccessToken = crypto.randomBytes(32).toString('hex');
      const hours = Math.max(1, Math.min(168, Number(digitalAccessHours) || 48));
      digitalAccessExpiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.fileRequisition.update({
        where: { id },
        data: {
          status: FileRequisitionStatus.DISPATCHED_RELEASED,
          dispatchedById: actorId,
          dispatchedAt: new Date(),
          dispatchReceiptNumber,
          trackingNotes: trackingNotes || 'Physical / digital custody transferred under Registry supervision.',
          digitalAccessToken,
          digitalAccessExpiresAt,
        },
      });

      await tx.fileCustodyAuditTrail.create({
        data: {
          requisitionId: id,
          action: FileCustodyAction.FILE_DISPATCHED,
          actorId,
          details: `Custody released under Dispatch Receipt [${dispatchReceiptNumber}]. Format: ${requisition.requestedFileFormat}. ${
            digitalAccessToken ? `Digital access token generated valid until ${digitalAccessExpiresAt?.toISOString()}` : ''
          }`,
          ipAddress,
          userAgent,
          metadata: {
            dispatchReceiptNumber,
            trackingNotes,
            hasDigitalToken: !!digitalAccessToken,
            digitalExpires: digitalAccessExpiresAt,
          },
        },
      });

      return item;
    });

    // Notify requester
    await notifyUser(
      requisition.requesterId,
      'Personnel File Released & Dispatched',
      `File requisition ${requisition.requisitionNumber} has been released. Dispatch Receipt: ${dispatchReceiptNumber}.${
        digitalAccessToken ? ' Digital transcript viewer access is now active.' : ''
      }`,
      'SUCCESS',
      `/dashboard/services/file-requests`
    );

    await cacheInvalidationService.invalidateFileRequisitions();

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Personnel file successfully dispatched with custody receipt.',
    });
  } catch (error: any) {
    console.error('Error dispatching file:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to dispatch personnel file.',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 5: FILE RETURN & ARCHIVE CUSTODY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/registry/file-requests/:id/return
 */
export async function returnRequisition(req: Request, res: Response) {
  try {
    const actorId = (req as any).user?.id;
    const { id } = req.params;
    const { returnNotes } = req.body;

    const requisition = await prisma.fileRequisition.findUnique({
      where: { id },
      include: {
        staffProfile: { include: { user: { select: { name: true, email: true } } } },
        requester: { select: { id: true, name: true, email: true } },
      },
    });

    if (!requisition) {
      return res.status(404).json({ success: false, error: 'File requisition not found.' });
    }

    if (requisition.status !== FileRequisitionStatus.DISPATCHED_RELEASED) {
      return res.status(400).json({
        success: false,
        error: `Cannot log return for requisition in status: ${requisition.status}. Must be DISPATCHED_RELEASED.`,
      });
    }

    const { ipAddress, userAgent } = getClientMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.fileRequisition.update({
        where: { id },
        data: {
          status: FileRequisitionStatus.RETURNED_ARCHIVED,
          returnedAt: new Date(),
          receivingOfficerId: actorId,
          digitalAccessToken: null, // Revoke digital access token immediately
          digitalAccessExpiresAt: null,
        },
      });

      await tx.fileCustodyAuditTrail.create({
        data: {
          requisitionId: id,
          action: FileCustodyAction.FILE_RETURN_LOGGED,
          actorId,
          details: `Personnel file returned to Registry Vault and securely re-archived. Notes: ${
            returnNotes || 'File returned intact.'
          }`,
          ipAddress,
          userAgent,
          metadata: { returnNotes },
        },
      });

      return item;
    });

    // Notify requester
    await notifyUser(
      requisition.requesterId,
      'Personnel File Custody Closed',
      `File ${requisition.requisitionNumber} has been received back by Registry Archives and the custody docket is now formally closed.`,
      'INFO',
      `/dashboard/services/file-requests`
    );

    await cacheInvalidationService.invalidateFileRequisitions();

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Personnel file successfully returned, re-archived, and digital tokens revoked.',
    });
  } catch (error: any) {
    console.error('Error logging file return:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to log return of personnel file.',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY & WORKFLOW QUEUES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/registry/file-requests/inward
 * Intake queue for Registry Records Desk
 */
export async function getRegistryInwardQueue(req: Request, res: Response) {
  try {
    const { status, urgency, search } = req.query;

    const where: any = {};
    if (status) {
      where.status = status;
    } else {
      where.status = {
        in: [
          FileRequisitionStatus.SUBMITTED,
          FileRequisitionStatus.ACKNOWLEDGED_PENDING_REGISTRAR,
          FileRequisitionStatus.REJECTED_BY_REGISTRY,
        ],
      };
    }

    if (urgency) {
      where.urgencyLevel = urgency;
    }

    if (search) {
      const q = String(search).trim();
      where.OR = [
        { requisitionNumber: { contains: q, mode: 'insensitive' } },
        { registryFolioReference: { contains: q, mode: 'insensitive' } },
        { requesterDepartment: { contains: q, mode: 'insensitive' } },
        { staffProfile: { staffId: { contains: q, mode: 'insensitive' } } },
        { staffProfile: { user: { name: { contains: q, mode: 'insensitive' } } } },
        { requester: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const items = await prisma.fileRequisition.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        staffProfile: {
          select: {
            id: true,
            staffId: true,
            rank: true,
            surname: true,
            otherNames: true,
            title: true,
            department: true,
            unit: { select: { id: true, name: true } },
            studyCenter: { select: { id: true, name: true } },
            user: { select: { name: true, email: true } },
          },
        },
        requester: {
          select: { id: true, name: true, email: true, role: true },
        },
        acknowledgedBy: {
          select: { id: true, name: true },
        },
      },
    });

    return res.status(200).json({ success: true, data: items, count: items.length });
  } catch (error: any) {
    console.error('Error fetching registry inward queue:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch registry inward queue.' });
  }
}

/**
 * GET /api/v1/registrar/file-requests/pending
 * Pending queue for Registrar Executive Authorization
 */
export async function getRegistrarPendingQueue(req: Request, res: Response) {
  try {
    const { search } = req.query;
    const where: any = {
      status: FileRequisitionStatus.ACKNOWLEDGED_PENDING_REGISTRAR,
    };

    if (search) {
      const q = String(search).trim();
      where.OR = [
        { requisitionNumber: { contains: q, mode: 'insensitive' } },
        { registryFolioReference: { contains: q, mode: 'insensitive' } },
        { requesterDepartment: { contains: q, mode: 'insensitive' } },
        { staffProfile: { staffId: { contains: q, mode: 'insensitive' } } },
        { staffProfile: { user: { name: { contains: q, mode: 'insensitive' } } } },
        { requester: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const items = await prisma.fileRequisition.findMany({
      where,
      orderBy: [{ urgencyLevel: 'desc' }, { createdAt: 'asc' }],
      include: {
        staffProfile: {
          select: {
            id: true,
            staffId: true,
            rank: true,
            surname: true,
            otherNames: true,
            title: true,
            department: true,
            unit: { select: { id: true, name: true } },
            studyCenter: { select: { id: true, name: true } },
            userId: true,
            user: { select: { name: true, email: true } },
          },
        },
        requester: {
          select: { id: true, name: true, email: true, role: true },
        },
        acknowledgedBy: {
          select: { id: true, name: true },
        },
      },
    });

    return res.status(200).json({ success: true, data: items, count: items.length });
  } catch (error: any) {
    console.error('Error fetching registrar pending queue:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch registrar queue.' });
  }
}

/**
 * GET /api/v1/registry/file-requests/ready-for-dispatch
 * Approved requisitions waiting for physical handover or return
 */
export async function getReadyForDispatchQueue(req: Request, res: Response) {
  try {
    const { status, search } = req.query;
    const where: any = {};

    if (status) {
      where.status = status;
    } else {
      where.status = {
        in: [FileRequisitionStatus.AUTHORIZED_BY_REGISTRAR, FileRequisitionStatus.DISPATCHED_RELEASED],
      };
    }

    if (search) {
      const q = String(search).trim();
      where.OR = [
        { requisitionNumber: { contains: q, mode: 'insensitive' } },
        { dispatchReceiptNumber: { contains: q, mode: 'insensitive' } },
        { registryFolioReference: { contains: q, mode: 'insensitive' } },
        { staffProfile: { staffId: { contains: q, mode: 'insensitive' } } },
        { staffProfile: { user: { name: { contains: q, mode: 'insensitive' } } } },
        { requester: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const items = await prisma.fileRequisition.findMany({
      where,
      orderBy: { authorizedAt: 'desc' },
      include: {
        staffProfile: {
          select: {
            id: true,
            staffId: true,
            rank: true,
            department: true,
            user: { select: { name: true, email: true } },
          },
        },
        requester: {
          select: { id: true, name: true, email: true, role: true },
        },
        authorizedBy: {
          select: { id: true, name: true },
        },
        dispatchedBy: {
          select: { id: true, name: true },
        },
      },
    });

    return res.status(200).json({ success: true, data: items, count: items.length });
  } catch (error: any) {
    console.error('Error fetching ready for dispatch queue:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch dispatch queue.' });
  }
}

/**
 * GET /api/v1/registry/file-requests/my
 * Personal requisitions lodged by the logged-in user
 */
export async function getMyRequisitions(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const items = await prisma.fileRequisition.findMany({
      where: { requesterId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        staffProfile: {
          select: {
            id: true,
            staffId: true,
            rank: true,
            department: true,
            user: { select: { name: true, email: true } },
          },
        },
        authorizedBy: { select: { name: true } },
        dispatchedBy: { select: { name: true } },
      },
    });

    return res.status(200).json({ success: true, data: items, count: items.length });
  } catch (error: any) {
    console.error('Error fetching my file requisitions:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch your file requisitions.' });
  }
}

/**
 * GET /api/v1/registry/file-requests/:id
 * Single requisition details with complete chain of custody
 */
export async function getRequisitionById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const requisition = await prisma.fileRequisition.findUnique({
      where: { id },
      include: {
        staffProfile: {
          select: {
            id: true,
            staffId: true,
            rank: true,
            department: true,
            cadre: true,
            level: true,
            step: true,
            employmentCategory: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        requester: {
          select: { id: true, name: true, email: true, role: true },
        },
        acknowledgedBy: { select: { id: true, name: true } },
        authorizedBy: { select: { id: true, name: true } },
        dispatchedBy: { select: { id: true, name: true } },
        receivingOfficer: { select: { id: true, name: true } },
        custodyAuditTrail: {
          orderBy: { createdAt: 'asc' },
          include: {
            actor: { select: { id: true, name: true, role: true } },
          },
        },
      },
    });

    if (!requisition) {
      return res.status(404).json({ success: false, error: 'File requisition not found.' });
    }

    return res.status(200).json({ success: true, data: requisition });
  } catch (error: any) {
    console.error('Error fetching requisition by ID:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch requisition details.' });
  }
}

/**
 * GET /api/v1/registry/file-requests/audit-ledger
 * Full chain of custody audit ledger with CSV/JSON export
 */
export async function getCustodyAuditLedger(req: Request, res: Response) {
  try {
    const { status, action, format, startDate, endDate } = req.query;

    const where: any = {};
    if (status) {
      where.requisition = { status: status as FileRequisitionStatus };
    }
    if (action) {
      where.action = action as FileCustodyAction;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(String(startDate));
      if (endDate) where.createdAt.lte = new Date(String(endDate));
    }

    const audits = await prisma.fileCustodyAuditTrail.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        actor: { select: { name: true, email: true, role: true } },
        requisition: {
          include: {
            staffProfile: {
              select: {
                staffId: true,
                user: { select: { name: true } },
              },
            },
            requester: { select: { name: true, email: true } },
          },
        },
      },
    });

    // Check if CSV format requested
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="noun_file_custody_audit_ledger_${new Date().toISOString().slice(0, 10)}.csv"`
      );

      const headers = [
        'Timestamp',
        'Requisition No',
        'Subject Staff ID',
        'Subject Staff Name',
        'Action',
        'Actor Name',
        'Actor Role',
        'IP Address',
        'Details',
        'Status',
        'Dispatch Receipt No',
      ];
      const rows = audits.map((a) => [
        `"${a.createdAt.toISOString()}"`,
        `"${a.requisition?.requisitionNumber || 'N/A'}"`,
        `"${a.requisition?.staffProfile?.staffId || 'N/A'}"`,
        `"${a.requisition?.staffProfile?.user?.name || 'N/A'}"`,
        `"${a.action}"`,
        `"${a.actor?.name || 'System'}"`,
        `"${a.actor?.role || 'N/A'}"`,
        `"${a.ipAddress || 'N/A'}"`,
        `"${(a.details || '').replace(/"/g, '""')}"`,
        `"${a.requisition?.status || 'N/A'}"`,
        `"${a.requisition?.dispatchReceiptNumber || 'N/A'}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      return res.status(200).send(csvContent);
    }

    return res.status(200).json({ success: true, data: audits, count: audits.length });
  } catch (error: any) {
    console.error('Error fetching custody audit ledger:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch custody audit ledger.' });
  }
}

/**
 * GET /api/v1/registry/file-requests/:id/digital-view
 * Secure read-only single-session digital dossier viewer
 */
export async function getDigitalTranscript(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { token } = req.query;
    const currentUserId = (req as any).user?.id;
    const currentUserRole = (req as any).user?.role;

    const requisition = await prisma.fileRequisition.findUnique({
      where: { id },
      include: {
        staffProfile: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
                transferredStaff: {
                  orderBy: { createdAt: 'desc' },
                  take: 5,
                  select: {
                    id: true,
                    status: true,
                    effectiveDate: true,
                    reason: true,
                  },
                },
              },
            },
            unit: { select: { name: true, code: true, type: true } },
            studyCenter: { select: { name: true, code: true } },
          },
        },
      },
    });

    if (!requisition || !requisition.staffProfile) {
      return res.status(404).json({ success: false, error: 'File requisition or associated staff profile not found.' });
    }

    // Authorization check:
    // Can access if:
    // 1. Digital token matches AND not expired, OR
    // 2. Requester during active release, OR
    // 3. Registry Admin, Registrar, Super User
    const isTokenValid =
      token &&
      requisition.digitalAccessToken === token &&
      requisition.digitalAccessExpiresAt &&
      new Date() < requisition.digitalAccessExpiresAt;

    const isAuthorizedRole = [
      Role.ADMIN,
      Role.SUPER_USER,
      Role.VICE_CHANCELLOR,
      Role.REGISTRAR,
      Role.DEPUTY_REGISTRAR,
      Role.REGISTRY_ADMIN,
      Role.HR_ADMIN,
    ].includes(currentUserRole);

    const isApprovedRequester =
      requisition.requesterId === currentUserId &&
      [
        FileRequisitionStatus.AUTHORIZED_BY_REGISTRAR,
        FileRequisitionStatus.DISPATCHED_RELEASED,
      ].includes(requisition.status as any);

    if (!isTokenValid && !isAuthorizedRole && !isApprovedRequester) {
      return res.status(403).json({
        success: false,
        error:
          'Access Denied: Digital access token is missing, expired, or invalid. Personnel dossiers are confidential.',
      });
    }

    // Return sanitized digital transcript
    const profile = requisition.staffProfile;
    const user = profile.user;
    const sanitizedDossier = {
      requisitionNumber: requisition.requisitionNumber,
      dispatchReceiptNumber: requisition.dispatchReceiptNumber,
      tokenExpiresAt: requisition.digitalAccessExpiresAt,
      profile: {
        staffId: profile.staffId,
        name: user?.name,
        officialEmail: user?.email,
        title: profile.title,
        rank: profile.rank,
        level: profile.level,
        step: profile.step,
        cadre: profile.cadre,
        department: profile.department,
        unit: profile.unit?.name,
        studyCenter: profile.studyCenter?.name,
        employmentCategory: profile.employmentCategory,
        highestQualification: profile.highestQualification,
        dateOfFirstAppointment: profile.dateOfFirstAppointment,
        lastPromotionDate: profile.lastPromotionDate,
        statutoryRetirementDate: profile.statutoryRetirementDate,
        status: profile.status,
        recentPostings: user?.transferredStaff || [],
        disciplinaryClearance: profile.hasActiveDisciplinaryBlock ? 'ACTIVE_DISCIPLINARY_HOLD' : 'CLEARED',
      },
      retrievedAt: new Date().toISOString(),
    };

    return res.status(200).json({ success: true, data: sanitizedDossier });
  } catch (error: any) {
    console.error('Error fetching digital transcript:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve digital dossier.' });
  }
}
