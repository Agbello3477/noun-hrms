import { Request, Response } from 'express';
import prisma from '../prisma';
import {
  emitApplicationStatusChanged,
  sendDirectorNotificationEmail,
  sendApplicantProgressEmail,
  sendRegistryAcknowledgmentReceiptEmail,
  sendRegistrarFinalDeterminationEmail,
} from '../services/docketNotification.service';
import { notifyUser } from './notification.controller';
import { cacheInvalidationService } from '../services/cacheInvalidationService';
import { ApplicationCategory, Role } from '@prisma/client';

export const ELIGIBLE_DIRECTOR_ROLES: Role[] = [
  Role.UNIT_HEAD,
  Role.STUDY_CENTER_MANAGER,
  Role.REGISTRAR,
  Role.DEPUTY_REGISTRAR,
  Role.SUPER_USER,
  Role.ADMIN,
  Role.VICE_CHANCELLOR,
  Role.CLINIC_HEAD,
  Role.SECURITY_HEAD,
];

/**
 * Generate unique Institutional Reference Number: NOUN/APP/YYYY/NNNNN
 */
async function generateReferenceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const count = await prisma.institutionalApplication.count({
        where: {
          createdAt: {
            gte: new Date(`${year}-01-01T00:00:00.000Z`),
          },
        },
      });
      const seq = String(count + 1 + attempt).padStart(5, '0');
      const salt = attempt > 0 ? `-${Math.floor(100 + Math.random() * 900)}` : '';
      const refNo = `NOUN/APP/${year}/${seq}${salt}`;

      const exists = await prisma.institutionalApplication.findUnique({
        where: { referenceNumber: refNo },
      });
      if (!exists) {
        return refNo;
      }
    } catch {
      break;
    }
  }
  return `NOUN/APP/${year}/${Date.now().toString().slice(-5)}-${Math.floor(100 + Math.random() * 900)}`;
}

/**
 * Generate unique Registry Docket Folio Number: NOUN/REG/FOLIO/YYYY/NNNNN
 */
async function generateDocketFolioNumber(): Promise<string> {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const count = await prisma.institutionalApplication.count({
        where: {
          registryDocketNumber: { not: null },
        },
      });
      const seq = String(count + 1 + attempt).padStart(5, '0');
      const salt = attempt > 0 ? `-${Math.floor(100 + Math.random() * 900)}` : '';
      const folio = `NOUN/REG/FOLIO/${year}/${seq}${salt}`;

      const exists = await prisma.institutionalApplication.findUnique({
        where: { registryDocketNumber: folio },
      });
      if (!exists) {
        return folio;
      }
    } catch {
      break;
    }
  }
  return `NOUN/REG/FOLIO/${year}/${Date.now().toString().slice(-5)}-${Math.floor(100 + Math.random() * 900)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1: STAFF SUBMISSION & REVISION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/applications/submit
 */
export async function submitApplication(req: Request, res: Response) {
  try {
    const callerId = (req as any).user?.id;
    const { subject, category, content, attachmentUrls, directorId: explicitDirectorId } = req.body;

    if (!callerId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please log in again.',
      });
    }

    if (!subject || !category || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: subject, category, and content are mandatory.',
      });
    }

    // Resolve Applicant User ID (ensuring it is a valid User foreign key)
    let resolvedApplicantId = callerId;
    let applicantUser = await prisma.user.findUnique({
      where: { id: resolvedApplicantId },
      include: {
        staffProfile: {
          include: { unit: true, studyCenter: true },
        },
      },
    });

    if (!applicantUser) {
      const applicantProfile = await prisma.staffProfile.findUnique({
        where: { id: callerId },
        include: {
          user: true,
          unit: true,
          studyCenter: true,
        },
      });
      if (applicantProfile?.user) {
        applicantUser = {
          ...applicantProfile.user,
          staffProfile: applicantProfile,
        } as any;
        resolvedApplicantId = applicantProfile.user.id;
      }
    }

    if (!applicantUser) {
      return res.status(401).json({
        success: false,
        error: 'Authenticated staff user record could not be found.',
      });
    }

    // Validate category enum or handle custom written category for regular staff
    const validCategories = [
      'POSTING_REQUEST',
      'CONCURRENCE',
      'STUDY_FELLOWSHIP',
      'SPECIAL_CLEARANCE',
      'GENERAL_MEMORANDUM',
      'ADMINISTRATIVE_APPEAL',
    ];
    let sanitizedCategory: ApplicationCategory = 'GENERAL_MEMORANDUM';
    let effectiveSubject = subject.trim();

    if (validCategories.includes(category)) {
      sanitizedCategory = category as ApplicationCategory;
    } else if (typeof category === 'string' && category.trim()) {
      sanitizedCategory = 'GENERAL_MEMORANDUM';
      if (!effectiveSubject.toLowerCase().includes(category.trim().toLowerCase())) {
        effectiveSubject = `[${category.trim()}] ${effectiveSubject}`;
      }
    }

    // Resolve designated Director / Directorate Head
    let resolvedDirectorId = explicitDirectorId || null;
    let directorUser: any = null;

    if (resolvedDirectorId) {
      directorUser = await prisma.user.findUnique({
        where: { id: resolvedDirectorId },
        include: { staffProfile: true },
      });

      if (!directorUser) {
        const dirProfile = await prisma.staffProfile.findUnique({
          where: { id: resolvedDirectorId },
          include: { user: true },
        });
        if (dirProfile?.user) {
          directorUser = dirProfile.user;
          resolvedDirectorId = dirProfile.user.id;
        }
      }
    }

    // Auto-resolve if not found or not provided
    if (!directorUser) {
      let callerProfile: any = applicantUser.staffProfile;
      if (!callerProfile || !callerProfile.unit) {
        callerProfile = await prisma.staffProfile.findUnique({
          where: { userId: resolvedApplicantId },
          include: { unit: true, studyCenter: true },
        });
      }

      if (callerProfile?.unit?.headId && callerProfile.unit.headId !== resolvedApplicantId) {
        let headUser = await prisma.user.findUnique({
          where: { id: callerProfile.unit.headId },
        });
        if (!headUser) {
          const headProf = await prisma.staffProfile.findUnique({
            where: { id: callerProfile.unit.headId },
            include: { user: true },
          });
          if (headProf?.user) {
            headUser = headProf.user;
          }
        }
        if (headUser && headUser.isActive) {
          directorUser = headUser;
          resolvedDirectorId = headUser.id;
        }
      }

      if (!directorUser && callerProfile?.unitId) {
        const unitLeader = await prisma.user.findFirst({
          where: {
            role: { in: ELIGIBLE_DIRECTOR_ROLES },
            staffProfile: { unitId: callerProfile.unitId },
            isActive: true,
            id: { not: resolvedApplicantId },
          },
        });
        if (unitLeader) {
          directorUser = unitLeader;
          resolvedDirectorId = unitLeader.id;
        } else {
          const staffLeader = await prisma.staffProfile.findFirst({
            where: {
              unitId: callerProfile.unitId,
              userId: { not: resolvedApplicantId },
              user: { isActive: true },
              OR: [
                { rank: { contains: 'Director', mode: 'insensitive' } },
                { rank: { contains: 'Dean', mode: 'insensitive' } },
                { rank: { contains: 'Head', mode: 'insensitive' } },
                { rank: { contains: 'HOD', mode: 'insensitive' } },
                { rank: { contains: 'Professor', mode: 'insensitive' } },
              ],
            },
            include: { user: true },
          });
          if (staffLeader?.user) {
            directorUser = staffLeader.user;
            resolvedDirectorId = staffLeader.user.id;
          }
        }
      }

      if (!directorUser && callerProfile?.centerId) {
        const centerManager = await prisma.user.findFirst({
          where: {
            role: { in: [Role.STUDY_CENTER_MANAGER, Role.UNIT_HEAD, Role.SUPER_USER, Role.ADMIN] },
            staffProfile: { centerId: callerProfile.centerId },
            isActive: true,
            id: { not: resolvedApplicantId },
          },
        });
        if (centerManager) {
          directorUser = centerManager;
          resolvedDirectorId = centerManager.id;
        }
      }

      if (!directorUser) {
        const leadershipUser = await prisma.user.findFirst({
          where: {
            role: { in: ELIGIBLE_DIRECTOR_ROLES },
            isActive: true,
            id: { not: resolvedApplicantId },
          },
        });
        if (leadershipUser) {
          directorUser = leadershipUser;
          resolvedDirectorId = leadershipUser.id;
        }
      }
    }

    if (!directorUser || !resolvedDirectorId) {
      return res.status(400).json({
        success: false,
        error: 'Could not resolve Designated Director or Unit Head. Please designate a Director from the list.',
      });
    }

    const referenceNumber = await generateReferenceNumber();
    const cleanAttachments = Array.isArray(attachmentUrls)
      ? attachmentUrls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
      : [];

    const result = await prisma.$transaction(async (tx) => {
      const app = await tx.institutionalApplication.create({
        data: {
          referenceNumber,
          applicantId: resolvedApplicantId,
          directorId: resolvedDirectorId!,
          subject: effectiveSubject,
          category: sanitizedCategory,
          content: content.trim(),
          attachmentUrls: cleanAttachments,
          status: 'SUBMITTED_TO_DIRECTOR',
          currentHolderRole: 'DIRECTOR',
        },
      });

      await tx.applicationRevisionHistory.create({
        data: {
          applicationId: app.id,
          actorId: resolvedApplicantId,
          stage: 'TIER_1_SUBMISSION',
          action: 'SUBMITTED',
          comments: 'Initial application submitted through Directorate for vetting',
          snapshotContent: content.trim(),
        },
      });

      return app;
    });

    // Asynchronous Real-Time Notification & Email (Non-blocking)
    const applicantName = applicantUser?.name || applicantUser?.email || 'Staff Member';
    const directorName = directorUser.name || directorUser.email || 'Director';

    try {
      if (resolvedDirectorId) {
        notifyUser(
          resolvedDirectorId,
          '📄 New Staff Application for Vetting',
          `${applicantName} has routed application ${referenceNumber} (${subject}) to your Directorate for review.`,
          'INFO',
          '/director/applications/pending'
        ).catch(() => {});
      }
    } catch (notifErr) {
      console.warn('[Docket] Notification error (non-fatal):', notifErr);
    }

    try {
      if (directorUser.email) {
        sendDirectorNotificationEmail(
          directorUser.email,
          directorName,
          applicantName,
          subject,
          referenceNumber,
          sanitizedCategory
        ).catch(() => {});
      }
    } catch (emailErr) {
      console.warn('[Docket] Email error (non-fatal):', emailErr);
    }

    try {
      emitApplicationStatusChanged({
        applicationId: result.id,
        refNo: referenceNumber,
        oldStatus: 'DRAFT',
        newStatus: 'SUBMITTED_TO_DIRECTOR',
        actorName: applicantName,
        remarks: 'Application submitted',
        actionUrl: '/director/applications/pending',
      });
    } catch (wsErr) {
      console.warn('[Docket] WebSocket emission warning:', wsErr);
    }

    try {
      await cacheInvalidationService.invalidateInstitutionalApplications();
    } catch (cacheErr) {
      console.warn('[Docket] Cache invalidation warning:', cacheErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Application successfully submitted and routed to Director.',
      data: result,
    });
  } catch (error: any) {
    console.error('Error in submitApplication:', error);
    return res.status(400).json({
      success: false,
      error: error?.message || 'Failed to submit institutional application.',
    });
  }
}

/**
 * PUT /api/v1/applications/:id/resubmit
 */
export async function resubmitApplication(req: Request, res: Response) {
  try {
    const applicantId = (req as any).user?.id;
    const { id } = req.params;
    const { content, attachmentUrls, applicantRemarks } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Revised content is required for resubmission.',
      });
    }

    const application = await prisma.institutionalApplication.findUnique({
      where: { id },
      include: { applicant: true, director: true },
    });

    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    if (application.applicantId !== applicantId) {
      return res.status(403).json({
        success: false,
        error: 'Only the original applicant can resubmit this application.',
      });
    }

    if (application.status !== 'RETURNED_FOR_REWRITE') {
      return res.status(409).json({
        success: false,
        error: `Cannot resubmit. Application is in status '${application.status}', not 'RETURNED_FOR_REWRITE'.`,
      });
    }

    const cleanAttachments = Array.isArray(attachmentUrls)
      ? attachmentUrls
      : application.attachmentUrls;

    const updated = await prisma.$transaction(async (tx) => {
      const app = await tx.institutionalApplication.update({
        where: { id },
        data: {
          content: content.trim(),
          attachmentUrls: cleanAttachments,
          status: 'SUBMITTED_TO_DIRECTOR',
          currentHolderRole: 'DIRECTOR',
        },
      });

      await tx.applicationRevisionHistory.create({
        data: {
          applicationId: app.id,
          actorId: applicantId,
          stage: 'TIER_1_RESUBMISSION',
          action: 'SUBMITTED',
          comments: applicantRemarks || 'Application resubmitted following Director critique',
          snapshotContent: content.trim(),
        },
      });

      return app;
    });

    const applicantName = application.applicant.name || 'Staff Member';
    const directorName = application.director.name || 'Director';

    notifyUser(
      application.directorId,
      '🔄 Resubmitted Application for Review',
      `${applicantName} has revised and resubmitted application ${application.referenceNumber}.`,
      'INFO',
      '/director/applications/pending'
    ).catch(() => {});

    if (application.director.email) {
      sendDirectorNotificationEmail(
        application.director.email,
        directorName,
        applicantName,
        application.subject,
        application.referenceNumber,
        application.category
      ).catch(() => {});
    }

    emitApplicationStatusChanged({
      applicationId: updated.id,
      refNo: updated.referenceNumber,
      oldStatus: 'RETURNED_FOR_REWRITE',
      newStatus: 'SUBMITTED_TO_DIRECTOR',
      actorName: applicantName,
      remarks: applicantRemarks || 'Revised by applicant',
      actionUrl: '/director/applications/pending',
    });

    await cacheInvalidationService.invalidateInstitutionalApplications();

    return res.status(200).json({
      success: true,
      message: 'Application successfully resubmitted to Directorate.',
      data: updated,
    });
  } catch (error: any) {
    console.error('Error in resubmitApplication:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to resubmit application.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2: DIRECTORATE VETTING & ACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /api/v1/applications/:id/director-action
 */
export async function directorAction(req: Request, res: Response) {
  try {
    const callerId = (req as any).user?.id;
    const callerRole = (req as any).user?.role;
    const { id } = req.params;
    const rawDecision = req.body.decision || req.body.action;
    const decision = rawDecision ? String(rawDecision).toUpperCase().trim() : '';
    const rawRemarks = req.body.directorRemarks || req.body.remarks || req.body.comment || '';
    const directorRemarks = typeof rawRemarks === 'string' ? rawRemarks.trim() : '';

    if (!['RECOMMEND', 'REWRITE', 'REJECT'].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: "Decision must be 'RECOMMEND', 'REWRITE', or 'REJECT'.",
      });
    }

    const application = await prisma.institutionalApplication.findUnique({
      where: { id },
      include: {
        applicant: {
          include: {
            staffProfile: {
              include: { unit: true, studyCenter: true },
            },
          },
        },
        director: true,
        revisions: true,
      },
    });

    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    // Guard: Caller must be the assigned director OR hold UNIT_HEAD/leadership role OR SUPER_USER
    let callerProfile = await prisma.staffProfile.findFirst({
      where: { OR: [{ userId: callerId }, { id: callerId }] },
      select: { id: true, userId: true, unitId: true, centerId: true },
    });

    const isDesignatedDirector =
      application.directorId === callerId ||
      (callerProfile && application.directorId === callerProfile.userId) ||
      (callerProfile && application.directorId === callerProfile.id) ||
      (callerProfile?.unitId && application.applicant?.staffProfile?.unitId === callerProfile.unitId) ||
      (callerProfile?.centerId && application.applicant?.staffProfile?.centerId === callerProfile.centerId);

    const hasDirectorPrivileges =
      callerRole === 'UNIT_HEAD' ||
      callerRole === 'STUDY_CENTER_MANAGER' ||
      callerRole === 'SUPER_USER' ||
      callerRole === 'ADMIN' ||
      callerRole === 'REGISTRAR' ||
      callerRole === 'DEPUTY_REGISTRAR' ||
      callerRole === 'CLINIC_HEAD' ||
      callerRole === 'SECURITY_HEAD' ||
      callerRole === 'VICE_CHANCELLOR';

    if (!isDesignatedDirector && !hasDirectorPrivileges) {
      return res.status(403).json({
        success: false,
        error: 'Only the designated Directorate Head or authorized Director may vet this application.',
      });
    }

    if (application.status !== 'SUBMITTED_TO_DIRECTOR') {
      return res.status(409).json({
        success: false,
        error: `Action disallowed. Application is currently '${application.status}', not awaiting director vetting.`,
      });
    }

    // Validation rules
    if (decision === 'REWRITE' && (!directorRemarks || !directorRemarks.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Mandatory critique/instructions in directorRemarks are required when returning for rewrite.',
      });
    }

    if (decision === 'REJECT' && (!directorRemarks || !directorRemarks.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Mandatory justification in directorRemarks is required when rejecting an application.',
      });
    }

    const now = new Date();
    let newStatus: any = 'RECOMMENDED_TO_REGISTRY';
    let newHolderRole: any = 'REGISTRY_ADMIN';
    let revisionAction: any = 'RECOMMENDED';

    if (decision === 'REWRITE') {
      newStatus = 'RETURNED_FOR_REWRITE';
      newHolderRole = 'STAFF';
      revisionAction = 'REWRITE_REQUESTED';
    } else if (decision === 'REJECT') {
      newStatus = 'REJECTED_BY_DIRECTOR';
      newHolderRole = 'STAFF';
      revisionAction = 'DECLINED';
    }

    const updated = await prisma.$transaction(async (tx) => {
      const app = await tx.institutionalApplication.update({
        where: { id },
        data: {
          status: newStatus,
          currentHolderRole: newHolderRole,
          directorRemarks: directorRemarks ? directorRemarks.trim() : null,
          directorRecommendedAt: decision === 'RECOMMEND' ? now : null,
        },
      });

      await tx.applicationRevisionHistory.create({
        data: {
          applicationId: app.id,
          actorId: callerId,
          stage: 'TIER_2_DIRECTOR_VETTING',
          action: revisionAction,
          comments: directorRemarks ? directorRemarks.trim() : 'Endorsed & recommended by Director',
          snapshotContent: app.content,
        },
      });

      // If rejected by Director, auto-archive copy immediately to Registry Master Archive
      if (decision === 'REJECT') {
        const fullAudit = {
          applicationId: app.id,
          referenceNumber: app.referenceNumber,
          applicant: { id: application.applicant.id, name: application.applicant.name, email: application.applicant.email },
          director: { id: application.director.id, name: application.director.name, remarks: directorRemarks },
          finalStatus: 'REJECTED_BY_DIRECTOR',
          rejectionTimestamp: now.toISOString(),
          history: application.revisions,
        };

        await tx.registryApplicationArchive.create({
          data: {
            applicationId: app.id,
            archivedDocketNumber: app.referenceNumber,
            finalStatus: 'REJECTED_BY_DIRECTOR',
            fullAuditCopy: fullAudit,
          },
        });
      }

      return app;
    });

    const applicantName = application.applicant.name || 'Staff Member';
    const directorName = (req as any).user?.name || application.director.name || 'Director';

    // Dispatches
    notifyUser(
      application.applicantId,
      decision === 'RECOMMEND'
        ? '✅ Application Recommended by Director'
        : decision === 'REWRITE'
        ? '⚠️ Revision Requested on Application'
        : '❌ Application Rejected by Director',
      `Director ${directorName} has ${decision.toLowerCase()}ed your application (${application.referenceNumber}).`,
      decision === 'RECOMMEND' ? 'SUCCESS' : decision === 'REWRITE' ? 'WARNING' : 'ERROR',
      '/portal/applications/my-applications'
    ).catch(() => {});

    if (application.applicant.email) {
      sendApplicantProgressEmail(
        application.applicant.email,
        applicantName,
        application.referenceNumber,
        newStatus,
        directorRemarks
      ).catch(() => {});
    }

    emitApplicationStatusChanged({
      applicationId: updated.id,
      refNo: updated.referenceNumber,
      oldStatus: application.status,
      newStatus,
      actorName: directorName,
      remarks: directorRemarks,
      actionUrl: '/portal/applications/my-applications',
    });

    await cacheInvalidationService.invalidateInstitutionalApplications();

    return res.status(200).json({
      success: true,
      message: `Application successfully ${decision.toLowerCase()}ed by Director.`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error in directorAction:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process Director vetting action.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 3: REGISTRY INWARD DESK (DOCKETING & ACKNOWLEDGMENT)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /api/v1/applications/:id/registry-acknowledge
 */
export async function registryAcknowledge(req: Request, res: Response) {
  try {
    const clerkId = (req as any).user?.id;
    const clerkRole = (req as any).user?.role;
    const { id } = req.params;
    const { customFolioNumber, remarks } = req.body;

    // Guard: REGISTRY_ADMIN, HR_ADMIN, or SUPER_USER
    const allowedRoles = ['REGISTRY_ADMIN', 'HR_ADMIN', 'SUPER_USER'];
    if (!allowedRoles.includes(clerkRole)) {
      return res.status(403).json({
        success: false,
        error: 'Only Registry Inward Desk Officers (Registry/HR Admins) may acknowledge and docket applications.',
      });
    }

    const application = await prisma.institutionalApplication.findUnique({
      where: { id },
      include: { applicant: true, director: true },
    });

    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    if (application.status !== 'RECOMMENDED_TO_REGISTRY') {
      return res.status(409).json({
        success: false,
        error: `Cannot docket. Application status is currently '${application.status}', not 'RECOMMENDED_TO_REGISTRY'.`,
      });
    }

    const folioNumber = customFolioNumber ? customFolioNumber.trim() : await generateDocketFolioNumber();
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const app = await tx.institutionalApplication.update({
        where: { id },
        data: {
          registryDocketNumber: folioNumber,
          registryClerkId: clerkId,
          registryAcknowledgedAt: now,
          status: 'DOCKETED_PENDING_REGISTRAR',
          currentHolderRole: 'REGISTRAR',
        },
      });

      await tx.applicationRevisionHistory.create({
        data: {
          applicationId: app.id,
          actorId: clerkId,
          stage: 'TIER_3_REGISTRY_DOCKET',
          action: 'DOCKET_ACKNOWLEDGED',
          comments: remarks
            ? `Docketed under Folio: ${folioNumber} (${remarks})`
            : `Officially docketed and stamped under Folio: ${folioNumber}`,
          snapshotContent: app.content,
        },
      });

      return app;
    });

    const applicantName = application.applicant.name || 'Staff Member';
    const directorName = application.director.name || 'Director';

    // Dual Acknowledgment: in-app notifications
    notifyUser(
      application.applicantId,
      '📬 Registry Docket Folio Issued',
      `Your application (${application.referenceNumber}) has been formally docketed under Folio ${folioNumber} and queued for the Registrar.`,
      'INFO',
      '/portal/applications/my-applications'
    ).catch(() => {});

    notifyUser(
      application.directorId,
      '📬 Registry Docket Folio Issued',
      `Application (${application.referenceNumber}) from ${applicantName} has been docketed under Folio ${folioNumber} and queued for the Registrar.`,
      'INFO',
      '/director/applications/pending'
    ).catch(() => {});

    // Dual Acknowledgment: automated institutional emails
    if (application.applicant.email) {
      sendRegistryAcknowledgmentReceiptEmail(
        application.applicant.email,
        applicantName,
        applicantName,
        application.referenceNumber,
        folioNumber,
        application.subject
      ).catch(() => {});
    }

    if (application.director.email) {
      sendRegistryAcknowledgmentReceiptEmail(
        application.director.email,
        directorName,
        applicantName,
        application.referenceNumber,
        folioNumber,
        application.subject
      ).catch(() => {});
    }

    emitApplicationStatusChanged({
      applicationId: updated.id,
      refNo: updated.referenceNumber,
      oldStatus: 'RECOMMENDED_TO_REGISTRY',
      newStatus: 'DOCKETED_PENDING_REGISTRAR',
      actorName: 'Registry Inward Desk',
      remarks: `Folio stamped: ${folioNumber}`,
      actionUrl: '/registrar-cockpit/applications',
    });

    await cacheInvalidationService.invalidateInstitutionalApplications();

    return res.status(200).json({
      success: true,
      message: `Application successfully docketed under Folio ${folioNumber} and forwarded to Registrar.`,
      data: updated,
      docketNumber: folioNumber,
    });
  } catch (error: any) {
    console.error('Error in registryAcknowledge:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to acknowledge and docket application.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 4: REGISTRAR FINAL DETERMINATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /api/v1/applications/:id/registrar-decision
 */
export async function registrarDecision(req: Request, res: Response) {
  try {
    const registrarId = (req as any).user?.id;
    const registrarRole = (req as any).user?.role;
    const { id } = req.params;
    const { decision, registrarRemarks } = req.body;

    if (!['APPROVED', 'DECLINED'].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: "Decision must be 'APPROVED' or 'DECLINED'.",
      });
    }

    if (!registrarRemarks || !registrarRemarks.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Mandatory executive remarks are required for Registrar final determination.',
      });
    }

    // Role Guard: REGISTRAR, DEPUTY_REGISTRAR, or SUPER_USER
    const allowedRoles = ['REGISTRAR', 'DEPUTY_REGISTRAR', 'SUPER_USER'];
    if (!allowedRoles.includes(registrarRole)) {
      return res.status(403).json({
        success: false,
        error: 'Only the University Registrar or authorized Deputy Registrar can make final determinations.',
      });
    }

    const application = await prisma.institutionalApplication.findUnique({
      where: { id },
      include: {
        applicant: { include: { staffProfile: true } },
        director: true,
        revisions: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    // Strict Maker-Checker: Registrar cannot be the applicant
    if (application.applicantId === registrarId) {
      return res.status(403).json({
        success: false,
        code: 'ERR_MAKER_CHECKER_SELF_AUTHORIZATION',
        error: 'Dual-control violation: You cannot decide or authoritatively sign off on an application you created.',
      });
    }

    if (application.status !== 'DOCKETED_PENDING_REGISTRAR') {
      return res.status(409).json({
        success: false,
        error: `Action disallowed. Application is in status '${application.status}', not awaiting Registrar decision.`,
      });
    }

    const now = new Date();
    const isApproved = decision === 'APPROVED';
    const newStatus: any = isApproved ? 'APPROVED_BY_REGISTRAR' : 'DECLINED_BY_REGISTRAR';
    const finalArchiveStatus: any = isApproved ? 'APPROVED' : 'DECLINED';
    const docketFolio = application.registryDocketNumber || application.referenceNumber;

    const updated = await prisma.$transaction(async (tx) => {
      const app = await tx.institutionalApplication.update({
        where: { id },
        data: {
          registrarId,
          registrarRemarks: registrarRemarks.trim(),
          registrarDecidedAt: now,
          status: newStatus,
          currentHolderRole: 'REGISTRAR',
        },
      });

      await tx.applicationRevisionHistory.create({
        data: {
          applicationId: app.id,
          actorId: registrarId,
          stage: 'TIER_4_REGISTRAR_DECISION',
          action: isApproved ? 'APPROVED' : 'DECLINED',
          comments: registrarRemarks.trim(),
          snapshotContent: app.content,
        },
      });

      // Permanent Master Archiving
      const fullAuditCopy = {
        applicationId: app.id,
        referenceNumber: app.referenceNumber,
        registryDocketNumber: docketFolio,
        subject: app.subject,
        category: app.category,
        content: app.content,
        attachmentUrls: app.attachmentUrls,
        applicant: {
          id: application.applicant.id,
          name: application.applicant.name,
          email: application.applicant.email,
          staffId: application.applicant.staffProfile?.staffId,
          rank: application.applicant.staffProfile?.rank,
        },
        director: {
          id: application.director.id,
          name: application.director.name,
          remarks: app.directorRemarks,
          recommendedAt: app.directorRecommendedAt,
        },
        registry: {
          clerkId: app.registryClerkId,
          acknowledgedAt: app.registryAcknowledgedAt,
        },
        registrar: {
          registrarId,
          decision,
          remarks: registrarRemarks.trim(),
          decidedAt: now,
        },
        finalStatus: finalArchiveStatus,
        history: application.revisions,
        digitalStamp: `NOUN-REG-SEAL-${Date.now().toString(36).toUpperCase()}`,
      };

      await tx.registryApplicationArchive.create({
        data: {
          applicationId: app.id,
          archivedDocketNumber: docketFolio,
          finalStatus: finalArchiveStatus,
          fullAuditCopy,
        },
      });

      return app;
    });

    const applicantName = application.applicant.name || 'Staff Member';
    const directorName = application.director.name || 'Director';

    // Broadcast Decision: in-app notifications
    notifyUser(
      application.applicantId,
      isApproved ? '🎉 Application Approved by Registrar' : '📋 Application Decision from Registrar',
      `The University Registrar has ${decision.toLowerCase()} your application (${application.referenceNumber}).`,
      isApproved ? 'SUCCESS' : 'WARNING',
      '/portal/applications/my-applications'
    ).catch(() => {});

    notifyUser(
      application.directorId,
      `📋 Registrar Decision on Staff Application`,
      `Registrar has ${decision.toLowerCase()} application (${application.referenceNumber}) from ${applicantName}.`,
      isApproved ? 'SUCCESS' : 'INFO',
      '/director/applications/pending'
    ).catch(() => {});

    // Broadcast Decision: formal executive decision emails
    if (application.applicant.email) {
      sendRegistrarFinalDeterminationEmail(
        application.applicant.email,
        applicantName,
        applicantName,
        application.referenceNumber,
        docketFolio,
        decision,
        registrarRemarks
      ).catch(() => {});
    }

    if (application.director.email) {
      sendRegistrarFinalDeterminationEmail(
        application.director.email,
        directorName,
        applicantName,
        application.referenceNumber,
        docketFolio,
        decision,
        registrarRemarks
      ).catch(() => {});
    }

    emitApplicationStatusChanged({
      applicationId: updated.id,
      refNo: updated.referenceNumber,
      oldStatus: 'DOCKETED_PENDING_REGISTRAR',
      newStatus,
      actorName: 'University Registrar',
      remarks: registrarRemarks,
      actionUrl: '/portal/applications/my-applications',
    });

    await cacheInvalidationService.invalidateInstitutionalApplications();

    return res.status(200).json({
      success: true,
      message: `Registrar determination successfully recorded as ${decision} and permanently archived.`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error in registrarDecision:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to record Registrar final determination.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY & QUEUE FETCH HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/applications/my-applications
 */
export async function getMyApplications(req: Request, res: Response) {
  try {
    const callerId = (req as any).user?.id;
    const { status, category } = req.query;

    let applicantUserIds = [callerId];
    const staffProfile = await prisma.staffProfile.findFirst({
      where: { OR: [{ userId: callerId }, { id: callerId }] },
      select: { id: true, userId: true },
    });
    if (staffProfile) {
      if (staffProfile.userId) applicantUserIds.push(staffProfile.userId);
      if (staffProfile.id) applicantUserIds.push(staffProfile.id);
    }
    applicantUserIds = Array.from(new Set(applicantUserIds.filter(Boolean)));

    const whereClause: any = {
      applicantId: { in: applicantUserIds },
    };
    if (status) whereClause.status = status;
    if (category) whereClause.category = category;

    const applications = await prisma.institutionalApplication.findMany({
      where: whereClause,
      include: {
        applicant: {
          select: {
            id: true,
            name: true,
            email: true,
            staffProfile: {
              select: {
                id: true,
                staffId: true,
                surname: true,
                otherNames: true,
                title: true,
                rank: true,
                department: true,
                unit: { select: { id: true, name: true } },
                studyCenter: { select: { id: true, name: true } },
              },
            },
          },
        },
        director: {
          select: {
            id: true,
            name: true,
            email: true,
            staffProfile: {
              select: {
                id: true,
                surname: true,
                otherNames: true,
                title: true,
                rank: true,
                department: true,
                unit: { select: { id: true, name: true } },
                studyCenter: { select: { id: true, name: true } },
              },
            },
          },
        },
        revisions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ success: true, data: applications, applications });
  } catch (error: any) {
    console.error('Error in getMyApplications:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch applications.' });
  }
}

/**
 * GET /api/v1/applications/director-queue
 */
export async function getDirectorQueue(req: Request, res: Response) {
  try {
    const callerId = (req as any).user?.id;
    const callerRole = (req as any).user?.role;
    const { status } = req.query;

    let directorUserIds = [callerId];
    const directorProfile = await prisma.staffProfile.findFirst({
      where: { OR: [{ userId: callerId }, { id: callerId }] },
      select: { id: true, userId: true, unitId: true, centerId: true },
    });
    if (directorProfile) {
      if (directorProfile.userId) directorUserIds.push(directorProfile.userId);
      if (directorProfile.id) directorUserIds.push(directorProfile.id);
    }
    directorUserIds = Array.from(new Set(directorUserIds.filter(Boolean)));

    const statusFilter = (status as any) || 'SUBMITTED_TO_DIRECTOR';

    let whereClause: any;
    if (callerRole === 'SUPER_USER' || callerRole === 'ADMIN' || callerRole === 'VICE_CHANCELLOR') {
      whereClause = {
        status: statusFilter,
        OR: [
          { directorId: { in: directorUserIds } },
          { directorId: { not: '' } },
          ...(directorProfile?.unitId ? [{ applicant: { staffProfile: { unitId: directorProfile.unitId } } }] : []),
        ],
      };
    } else {
      whereClause = {
        status: statusFilter,
        OR: [
          { directorId: { in: directorUserIds } },
          ...(directorProfile?.unitId ? [{ applicant: { staffProfile: { unitId: directorProfile.unitId } } }] : []),
          ...(directorProfile?.centerId ? [{ applicant: { staffProfile: { centerId: directorProfile.centerId } } }] : []),
        ],
      };
    }

    const applications = await prisma.institutionalApplication.findMany({
      where: whereClause,
      include: {
        applicant: {
          select: {
            id: true,
            name: true,
            email: true,
            staffProfile: {
              select: {
                id: true,
                staffId: true,
                surname: true,
                otherNames: true,
                title: true,
                rank: true,
                department: true,
                unit: { select: { id: true, name: true } },
                studyCenter: { select: { id: true, name: true } },
              },
            },
          },
        },
        director: {
          select: {
            id: true,
            name: true,
            email: true,
            staffProfile: {
              select: {
                id: true,
                surname: true,
                otherNames: true,
                title: true,
                rank: true,
                department: true,
                unit: { select: { id: true, name: true } },
              },
            },
          },
        },
        revisions: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ success: true, data: applications, applications });
  } catch (error: any) {
    console.error('Error in getDirectorQueue:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch Director queue.' });
  }
}

/**
 * GET /api/v1/applications/registry-queue
 */
export async function getRegistryQueue(req: Request, res: Response) {
  try {
    const { filter } = req.query; // 'pending' (recommended), 'docketed', or 'all'

    const whereClause: any = {};
    if (filter === 'pending') {
      whereClause.status = 'RECOMMENDED_TO_REGISTRY';
    } else if (filter === 'docketed') {
      whereClause.status = 'DOCKETED_PENDING_REGISTRAR';
    } else {
      whereClause.status = {
        in: ['RECOMMENDED_TO_REGISTRY', 'DOCKETED_PENDING_REGISTRAR', 'APPROVED_BY_REGISTRAR', 'DECLINED_BY_REGISTRAR'],
      };
    }

    const applications = await prisma.institutionalApplication.findMany({
      where: whereClause,
      include: {
        applicant: {
          select: {
            id: true,
            name: true,
            email: true,
            staffProfile: { select: { staffId: true, rank: true, surname: true, otherNames: true, title: true } },
          },
        },
        director: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.status(200).json({ success: true, data: applications, applications });
  } catch (error: any) {
    console.error('Error in getRegistryQueue:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch Registry queue.' });
  }
}

/**
 * GET /api/v1/applications/registrar-queue
 */
export async function getRegistrarQueue(req: Request, res: Response) {
  try {
    const applications = await prisma.institutionalApplication.findMany({
      where: { status: 'DOCKETED_PENDING_REGISTRAR' },
      include: {
        applicant: {
          select: {
            id: true,
            name: true,
            email: true,
            staffProfile: {
              select: {
                id: true,
                staffId: true,
                rank: true,
                surname: true,
                otherNames: true,
                title: true,
                highestQualification: true,
                unit: { select: { id: true, name: true } },
              },
            },
          },
        },
        director: { select: { id: true, name: true, email: true } },
        revisions: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.status(200).json({ success: true, data: applications, applications });
  } catch (error: any) {
    console.error('Error in getRegistrarQueue:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch Registrar queue.' });
  }
}

/**
 * GET /api/v1/applications/archive
 */
export async function getMasterArchive(req: Request, res: Response) {
  try {
    const { category, finalStatus, academicYear, search } = req.query;

    const whereClause: any = {};
    if (finalStatus) whereClause.finalStatus = finalStatus;

    if (academicYear) {
      const year = parseInt(String(academicYear), 10);
      if (!isNaN(year)) {
        whereClause.archivedAt = {
          gte: new Date(`${year}-01-01T00:00:00.000Z`),
          lte: new Date(`${year}-12-31T23:59:59.999Z`),
        };
      }
    }

    const archives = await prisma.registryApplicationArchive.findMany({
      where: whereClause,
      include: {
        application: {
          select: {
            id: true,
            referenceNumber: true,
            registryDocketNumber: true,
            subject: true,
            category: true,
            applicant: { select: { id: true, name: true, email: true } },
            director: { select: { id: true, name: true, email: true } },
            createdAt: true,
            directorRemarks: true,
            registrarRemarks: true,
          },
        },
      },
      orderBy: { archivedAt: 'desc' },
    });

    // Optional category & search filter in memory if nested
    let results = archives;
    if (category) {
      results = results.filter((item) => item.application.category === category);
    }
    if (search) {
      const term = String(search).toLowerCase();
      results = results.filter(
        (item) =>
          item.archivedDocketNumber.toLowerCase().includes(term) ||
          item.application.subject.toLowerCase().includes(term) ||
          item.application.applicant.name?.toLowerCase().includes(term)
      );
    }

    return res.status(200).json({ success: true, data: results, archives: results, applications: results });
  } catch (error: any) {
    console.error('Error in getMasterArchive:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch Registry archive.' });
  }
}

/**
 * GET /api/v1/applications/directors
 */
export async function getEligibleDirectors(req: Request, res: Response) {
  try {
    const callerId = (req as any).user?.id;
    const rawDirectors = await prisma.user.findMany({
      where: {
        role: { in: ELIGIBLE_DIRECTOR_ROLES },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        staffProfile: {
          select: {
            rank: true,
            title: true,
            surname: true,
            otherNames: true,
            department: true,
            unit: { select: { id: true, name: true, type: true } },
            studyCenter: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const formatDirectorName = (d: any) => {
      const p = d.staffProfile;
      if (p?.title && p?.surname) {
        const full = [p.title, p.surname, p.otherNames].filter(Boolean).join(' ').trim();
        if (full) return full;
      }
      if (p?.title && d.name && !d.name.toLowerCase().startsWith(p.title.toLowerCase())) {
        return `${p.title} ${d.name}`.trim();
      }
      return d.name || d.email;
    };

    const directorsMap = new Map<string, any>();
    for (const d of rawDirectors) {
      directorsMap.set(d.id, {
        id: d.id,
        name: formatDirectorName(d),
        rawName: d.name,
        email: d.email,
        role: d.role,
        unit: d.staffProfile?.unit?.name || d.staffProfile?.studyCenter?.name || d.staffProfile?.department || 'Directorate',
        staffProfile: d.staffProfile,
      });
    }

    // Include staff members with leadership ranks
    const staffLeaders = await prisma.staffProfile.findMany({
      where: {
        user: { isActive: true },
        OR: [
          { rank: { contains: 'Director', mode: 'insensitive' } },
          { rank: { contains: 'Dean', mode: 'insensitive' } },
          { rank: { contains: 'Head', mode: 'insensitive' } },
          { rank: { contains: 'HOD', mode: 'insensitive' } },
        ],
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        unit: { select: { id: true, name: true, type: true } },
        studyCenter: { select: { id: true, name: true } },
      },
    });

    for (const sp of staffLeaders) {
      if (sp.user && !directorsMap.has(sp.user.id)) {
        directorsMap.set(sp.user.id, {
          id: sp.user.id,
          name: formatDirectorName({ ...sp.user, staffProfile: sp }),
          rawName: sp.user.name,
          email: sp.user.email,
          role: sp.user.role,
          unit: sp.unit?.name || sp.studyCenter?.name || sp.department || 'Directorate',
          staffProfile: sp,
        });
      }
    }

    const directors = Array.from(directorsMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    let designatedDirector: any = null;
    if (callerId) {
      let callerProfile = await prisma.staffProfile.findUnique({
        where: { userId: callerId },
        include: {
          unit: true,
          studyCenter: true,
        },
      });

      if (!callerProfile) {
        callerProfile = await prisma.staffProfile.findUnique({
          where: { id: callerId },
          include: {
            unit: true,
            studyCenter: true,
          },
        });
      }

      if (!callerProfile) {
        const callerUser = await prisma.user.findUnique({
          where: { id: callerId },
          include: {
            staffProfile: {
              include: {
                unit: true,
                studyCenter: true,
              },
            },
          },
        });
        if (callerUser?.staffProfile) {
          callerProfile = callerUser.staffProfile;
        }
      }

      // 1. Direct unit head via unit.headId (may be User.id or StaffProfile.id)
      if (callerProfile?.unit?.headId && callerProfile.unit.headId !== callerId) {
        let headUser = await prisma.user.findUnique({
          where: { id: callerProfile.unit.headId },
          include: {
            staffProfile: {
              include: { unit: true, studyCenter: true },
            },
          },
        });

        if (!headUser) {
          const headProfile = await prisma.staffProfile.findUnique({
            where: { id: callerProfile.unit.headId },
            include: {
              user: true,
              unit: true,
              studyCenter: true,
            },
          });
          if (headProfile?.user) {
            headUser = {
              ...headProfile.user,
              staffProfile: headProfile,
            } as any;
          }
        }

        if (headUser && headUser.id !== callerId && headUser.isActive) {
          const formatted = formatDirectorName(headUser);
          designatedDirector = {
            id: headUser.id,
            name: formatted,
            email: headUser.email,
            unit: callerProfile.unit.name,
            role: headUser.role,
            title: headUser.staffProfile?.title,
            rank: headUser.staffProfile?.rank,
            reason: `Designated Unit Head for ${callerProfile.unit.name}`,
          };
        }
      }

      // 2. Unit Leadership by unitId
      if (!designatedDirector && callerProfile?.unitId) {
        const unitLeader = await prisma.user.findFirst({
          where: {
            role: { in: ELIGIBLE_DIRECTOR_ROLES },
            staffProfile: { unitId: callerProfile.unitId },
            isActive: true,
            id: { not: callerId },
          },
          include: {
            staffProfile: {
              include: { unit: true, studyCenter: true },
            },
          },
        });

        if (unitLeader) {
          const formatted = formatDirectorName(unitLeader);
          designatedDirector = {
            id: unitLeader.id,
            name: formatted,
            email: unitLeader.email,
            unit: callerProfile.unit?.name || unitLeader.staffProfile?.unit?.name || 'Unit',
            role: unitLeader.role,
            title: unitLeader.staffProfile?.title,
            rank: unitLeader.staffProfile?.rank,
            reason: `Head / Director of ${callerProfile.unit?.name || 'Unit'}`,
          };
        } else {
          const leaderProfile = await prisma.staffProfile.findFirst({
            where: {
              unitId: callerProfile.unitId,
              userId: { not: callerId },
              user: { isActive: true },
              OR: [
                { rank: { contains: 'Director', mode: 'insensitive' } },
                { rank: { contains: 'Dean', mode: 'insensitive' } },
                { rank: { contains: 'Head', mode: 'insensitive' } },
                { rank: { contains: 'HOD', mode: 'insensitive' } },
                { rank: { contains: 'Professor', mode: 'insensitive' } },
              ],
            },
            include: { user: true, unit: true, studyCenter: true },
          });
          if (leaderProfile?.user) {
            const formatted = formatDirectorName({ ...leaderProfile.user, staffProfile: leaderProfile });
            designatedDirector = {
              id: leaderProfile.user.id,
              name: formatted,
              email: leaderProfile.user.email,
              unit: callerProfile.unit?.name || leaderProfile.unit?.name || 'Unit',
              role: leaderProfile.user.role,
              title: leaderProfile.title,
              rank: leaderProfile.rank,
              reason: `Head / Director of ${callerProfile.unit?.name || 'Unit'}`,
            };
          }
        }
      }

      // 3. Study Center Manager
      if (!designatedDirector && callerProfile?.centerId && callerProfile?.studyCenter) {
        const centerManager = await prisma.user.findFirst({
          where: {
            role: { in: [Role.STUDY_CENTER_MANAGER, Role.UNIT_HEAD, Role.SUPER_USER, Role.ADMIN] },
            staffProfile: { centerId: callerProfile.centerId },
            isActive: true,
            id: { not: callerId },
          },
          include: {
            staffProfile: {
              include: { studyCenter: true, unit: true },
            },
          },
        });
        if (centerManager) {
          const formatted = formatDirectorName(centerManager);
          designatedDirector = {
            id: centerManager.id,
            name: formatted,
            email: centerManager.email,
            unit: callerProfile.studyCenter.name,
            role: centerManager.role,
            title: centerManager.staffProfile?.title,
            rank: centerManager.staffProfile?.rank,
            reason: `Study Centre Director for ${callerProfile.studyCenter.name}`,
          };
        }
      }

      // 4. Department leadership match
      if (!designatedDirector && callerProfile?.department) {
        const deptLeader = await prisma.user.findFirst({
          where: {
            role: { in: ELIGIBLE_DIRECTOR_ROLES },
            staffProfile: { department: callerProfile.department },
            isActive: true,
            id: { not: callerId },
          },
          include: {
            staffProfile: {
              include: { unit: true, studyCenter: true },
            },
          },
        });
        if (deptLeader) {
          const formatted = formatDirectorName(deptLeader);
          designatedDirector = {
            id: deptLeader.id,
            name: formatted,
            email: deptLeader.email,
            unit: callerProfile.department,
            role: deptLeader.role,
            title: deptLeader.staffProfile?.title,
            rank: deptLeader.staffProfile?.rank,
            reason: `Department Head for ${callerProfile.department}`,
          };
        }
      }

      // 5. Name match across loaded directors list
      if (!designatedDirector && directors.length > 0) {
        const unitMatch = directors.find((d) =>
          d.id !== callerId &&
          callerProfile?.unit?.name &&
          d.unit?.toLowerCase() === callerProfile.unit.name.toLowerCase()
        );
        if (unitMatch) {
          designatedDirector = {
            id: unitMatch.id,
            name: unitMatch.name,
            email: unitMatch.email,
            unit: unitMatch.unit,
            role: unitMatch.role,
            reason: `Designated Head for ${unitMatch.unit}`,
          };
        } else {
          const fallback = directors.find((d) => d.id !== callerId);
          if (fallback) {
            designatedDirector = {
              id: fallback.id,
              name: fallback.name,
              email: fallback.email,
              unit: fallback.unit,
              role: fallback.role,
              reason: 'Institutional Leadership',
            };
          }
        }
      }
    }

    return res.status(200).json({ 
      success: true, 
      directors, 
      data: directors,
      designatedDirector 
    });
  } catch (error: any) {
    console.error('Error in getEligibleDirectors:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch directors.' });
  }
}

/**
 * GET /api/v1/applications/:id
 */
export async function getApplicationById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const application = await prisma.institutionalApplication.findUnique({
      where: { id },
      include: {
        applicant: {
          select: {
            id: true,
            name: true,
            email: true,
            staffProfile: {
              select: {
                id: true,
                staffId: true,
                rank: true,
                level: true,
                step: true,
                highestQualification: true,
                department: true,
                unit: { select: { id: true, name: true } },
                studyCenter: { select: { id: true, name: true } },
              },
            },
          },
        },
        director: { select: { id: true, name: true, email: true } },
        registrar: { select: { id: true, name: true, email: true } },
        registryClerk: { select: { id: true, name: true, email: true } },
        revisions: {
          include: { actor: { select: { id: true, name: true, email: true, role: true } } },
          orderBy: { createdAt: 'desc' },
        },
        archive: true,
      },
    });

    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    return res.status(200).json({ success: true, data: application });
  } catch (error: any) {
    console.error('Error in getApplicationById:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch application details.' });
  }
}
