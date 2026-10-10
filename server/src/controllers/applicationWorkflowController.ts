import { Request, Response } from 'express';
import prisma from '../prisma';
import {
  emitApplicationStatusChanged,
  sendDirectorNotificationEmail,
  sendApplicantProgressEmail,
  sendRegistryAcknowledgmentReceiptEmail,
  sendRegistrarFinalDeterminationEmail,
  sendRegistryInwardDeskNotificationEmail,
} from '../services/docketNotification.service';
import { notifyUser } from './notification.controller';
import { cacheInvalidationService } from '../services/cacheInvalidationService';
import { StorageService } from '../services/storage.service';
import { resolveStaffDirector } from '../services/leaveEntitlement.service';
import { resolveFacultyStaffHierarchy } from '../services/facultyStaffRouting.service';
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
 * Generate unique Institutional Reference Number: NOUN/YYYY/NNNNN
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
      const refNo = `NOUN/${year}/${seq}${salt}`;

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
  return `NOUN/${year}/${Date.now().toString().slice(-5)}-${Math.floor(100 + Math.random() * 900)}`;
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
 * POST /api/v1/applications/upload-attachment
 * Allows any authenticated staff to upload supporting documents for applications
 */
export async function uploadApplicationAttachment(req: Request, res: Response) {
  try {
    const callerId = (req as any).user?.id;
    if (!callerId) {
      return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file provided for attachment upload.' });
    }

    const url = await StorageService.uploadFile(file, 'applications');

    return res.status(201).json({
      success: true,
      url,
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    });
  } catch (error: any) {
    console.error('Error in uploadApplicationAttachment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload attachment file.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

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

    // Check if applicant is faculty staff to enforce statutory routing (Through HOD, Through Dean)
    const facultyHierarchy = await resolveFacultyStaffHierarchy(resolvedApplicantId);
    if (facultyHierarchy?.isFacultyStaff) {
      if (!facultyHierarchy.isCallerHod && !facultyHierarchy.isCallerDean && facultyHierarchy.hod) {
        resolvedDirectorId = facultyHierarchy.hod.id;
      } else if (facultyHierarchy.isCallerHod && facultyHierarchy.dean) {
        resolvedDirectorId = facultyHierarchy.dean.id;
      }
    }

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
      const resolvedDirect = await resolveStaffDirector(resolvedApplicantId);
      if (resolvedDirect.length > 0) {
        resolvedDirectorId = resolvedDirect[0].id;
        directorUser = await prisma.user.findUnique({
          where: { id: resolvedDirectorId },
          include: { staffProfile: true },
        });
      }
    }

    if (!directorUser || !resolvedDirectorId) {
      return res.status(400).json({
        success: false,
        error: 'Could not resolve your Designated Director or Unit Head. Please select your Director from the list.',
      });
    }

    const referenceNumber = await generateReferenceNumber();

    // Process attachments: direct file uploads + provided attachment URLs
    const cleanAttachments: string[] = [];

    // 1. Direct files from Multer (upload.array or upload.single)
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      for (const f of req.files as Express.Multer.File[]) {
        const fileUrl = await StorageService.uploadFile(f, 'applications');
        if (fileUrl) cleanAttachments.push(fileUrl);
      }
    } else if (req.file) {
      const fileUrl = await StorageService.uploadFile(req.file, 'applications');
      if (fileUrl) cleanAttachments.push(fileUrl);
    }

    // 2. Provided attachmentUrls (array, JSON string, or single string)
    if (attachmentUrls) {
      if (Array.isArray(attachmentUrls)) {
        for (const url of attachmentUrls) {
          if (typeof url === 'string' && url.trim().length > 0) {
            cleanAttachments.push(url.trim());
          }
        }
      } else if (typeof attachmentUrls === 'string') {
        try {
          const parsed = JSON.parse(attachmentUrls);
          if (Array.isArray(parsed)) {
            for (const url of parsed) {
              if (typeof url === 'string' && url.trim().length > 0) {
                cleanAttachments.push(url.trim());
              }
            }
          } else if (typeof parsed === 'string' && parsed.trim().length > 0) {
            cleanAttachments.push(parsed.trim());
          }
        } catch {
          if (attachmentUrls.trim().length > 0) {
            cleanAttachments.push(attachmentUrls.trim());
          }
        }
      }
    }

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

      let initialComments = 'Initial application submitted through Directorate for vetting';
      if (facultyHierarchy?.isFacultyStaff) {
        if (!facultyHierarchy.isCallerHod && !facultyHierarchy.isCallerDean) {
          initialComments = `Submitted to Registrar through HOD (${facultyHierarchy.hod?.name || 'HOD'}) and through Dean (${facultyHierarchy.dean?.name || 'Dean'})`;
        } else if (facultyHierarchy.isCallerHod) {
          initialComments = `Submitted by HOD to Registrar through Dean (${facultyHierarchy.dean?.name || 'Dean'})`;
        }
      }

      await tx.applicationRevisionHistory.create({
        data: {
          applicationId: app.id,
          actorId: resolvedApplicantId,
          stage: 'TIER_1_SUBMISSION',
          action: 'SUBMITTED',
          comments: initialComments,
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

    // Process attachments: direct file uploads + provided attachment URLs
    const cleanAttachments: string[] = [];

    // 1. Direct files from Multer
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      for (const f of req.files as Express.Multer.File[]) {
        const fileUrl = await StorageService.uploadFile(f, 'applications');
        if (fileUrl) cleanAttachments.push(fileUrl);
      }
    } else if (req.file) {
      const fileUrl = await StorageService.uploadFile(req.file, 'applications');
      if (fileUrl) cleanAttachments.push(fileUrl);
    }

    // 2. Provided attachmentUrls (array, JSON string, or single string)
    if (attachmentUrls) {
      if (Array.isArray(attachmentUrls)) {
        for (const url of attachmentUrls) {
          if (typeof url === 'string' && url.trim().length > 0) {
            cleanAttachments.push(url.trim());
          }
        }
      } else if (typeof attachmentUrls === 'string') {
        try {
          const parsed = JSON.parse(attachmentUrls);
          if (Array.isArray(parsed)) {
            for (const url of parsed) {
              if (typeof url === 'string' && url.trim().length > 0) {
                cleanAttachments.push(url.trim());
              }
            }
          } else if (typeof parsed === 'string' && parsed.trim().length > 0) {
            cleanAttachments.push(parsed.trim());
          }
        } catch {
          if (attachmentUrls.trim().length > 0) {
            cleanAttachments.push(attachmentUrls.trim());
          }
        }
      }
    } else if (cleanAttachments.length === 0 && application.attachmentUrls) {
      cleanAttachments.push(...application.attachmentUrls);
    }

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

    const callerProfile = await prisma.staffProfile.findFirst({
      where: { OR: [{ userId: callerId }, { id: callerId }] },
      include: { unit: true, studyCenter: true },
    });

    // Strict Maker-Checker: Caller cannot vet their own application
    if (application.applicantId === callerId || (callerProfile && application.applicantId === callerProfile.userId)) {
      return res.status(403).json({
        success: false,
        code: 'ERR_MAKER_CHECKER_SELF_AUTHORIZATION',
        error: 'Dual-control violation: You cannot vet or endorse an application you created.',
      });
    }

    // Guard: Caller must be the assigned director, the Head of the applicant's Unit/Faculty/Center, or Central Executive
    const isCentralExecutive = ['SUPER_USER', 'VICE_CHANCELLOR', 'REGISTRAR', 'DEPUTY_REGISTRAR', 'ADMIN'].includes(callerRole);

    let isAuthorizedJurisdiction =
      application.directorId === callerId ||
      (callerProfile && application.directorId === callerProfile.userId) ||
      (callerProfile && application.directorId === callerProfile.id);

    if (!isAuthorizedJurisdiction && callerProfile && application.applicant?.staffProfile) {
      const applicantProfile = application.applicant.staffProfile;
      if (callerProfile.centerId && applicantProfile.centerId && callerProfile.centerId === applicantProfile.centerId) {
        isAuthorizedJurisdiction = true;
      } else if (callerProfile.unitId && applicantProfile.unitId && callerProfile.unitId === applicantProfile.unitId) {
        isAuthorizedJurisdiction = true;
      } else {
        const callerHeadedUnits = await prisma.unit.findMany({
          where: {
            OR: [
              { headId: callerId },
              ...(callerProfile.id ? [{ headId: callerProfile.id }] : []),
            ],
          },
          select: { id: true, code: true, type: true },
        });

        const headedUnitIds = callerHeadedUnits.map((u) => u.id);
        if (applicantProfile.unitId && headedUnitIds.includes(applicantProfile.unitId)) {
          isAuthorizedJurisdiction = true;
        } else {
          // Check faculty departmental mappings
          const allHeadedOrAssigned = [
            ...(callerProfile.unitId ? [{ id: callerProfile.unitId, code: (callerProfile as any).unit?.code, type: (callerProfile as any).unit?.type }] : []),
            ...callerHeadedUnits,
          ];

          for (const u of allHeadedOrAssigned) {
            if (u.type === 'FACULTY' || (u.code && u.code.startsWith('FAC-'))) {
              const facultyDeptMapping: Record<string, string[]> = {
                'FAC-SCIEN': ['DEP-CS', 'DEP-MTH'],
                'FAC-LAW': ['DEP-LAW'],
                'FAC-SOCIA': ['DEP-POL', 'DEP-ECO', 'DEP-SOC'],
                'FAC-MANAG': ['DEP-ACC', 'DEP-BUS', 'DEP-PAD'],
                'FAC-EDUCA': ['DEP-EDT', 'DEP-EDU'],
                'FAC-HEALT': ['DEP-PBH', 'DEP-NUR'],
                'FAC-AGRIC': ['DEP-AGR'],
                'FAC-ARTS': ['DEP-ART', 'DEP-ENG', 'DEP-HIS'],
                'FAC-COMPU': ['DEP-CMP'],
              };
              const deptCodes = facultyDeptMapping[u.code || ''] || [];
              if (deptCodes.length > 0) {
                const childUnits = await prisma.unit.findMany({
                  where: { code: { in: deptCodes } },
                  select: { id: true },
                });
                const childUnitIds = childUnits.map((cu) => cu.id);
                if (applicantProfile.unitId && childUnitIds.includes(applicantProfile.unitId)) {
                  isAuthorizedJurisdiction = true;
                  break;
                }
              }
            }
          }
        }
      }
    }

    if (!isAuthorizedJurisdiction && !isCentralExecutive) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN_ORGANIZATIONAL_SCOPE',
        message: "You do not have jurisdiction over this staff member's administrative unit.",
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

    // Resolve faculty hierarchy to enforce statutory routing (HOD -> Dean -> Registry)
    const facultyHierarchy = await resolveFacultyStaffHierarchy(application.applicantId);
    const isHodRecommendationToDean =
      decision === 'RECOMMEND' &&
      facultyHierarchy?.isFacultyStaff &&
      facultyHierarchy.hod &&
      facultyHierarchy.dean &&
      (application.directorId === facultyHierarchy.hod.id || callerId === facultyHierarchy.hod.id) &&
      facultyHierarchy.hod.id !== facultyHierarchy.dean.id;

    const now = new Date();
    let newStatus: any = 'RECOMMENDED_TO_REGISTRY';
    let newHolderRole: any = 'REGISTRY_ADMIN';
    let revisionAction: any = 'RECOMMENDED';
    let revisionStage: any = facultyHierarchy?.isFacultyStaff ? 'TIER_2_DEAN_RECOMMENDATION' : 'TIER_2_DIRECTOR_VETTING';
    let nextDirectorId = application.directorId;

    if (decision === 'REWRITE') {
      newStatus = 'RETURNED_FOR_REWRITE';
      newHolderRole = 'STAFF';
      revisionAction = 'REWRITE_REQUESTED';
      revisionStage = 'TIER_2_DIRECTOR_VETTING';
    } else if (decision === 'REJECT') {
      newStatus = 'REJECTED_BY_DIRECTOR';
      newHolderRole = 'STAFF';
      revisionAction = 'DECLINED';
      revisionStage = 'TIER_2_DIRECTOR_VETTING';
    } else if (isHodRecommendationToDean) {
      newStatus = 'SUBMITTED_TO_DIRECTOR';
      newHolderRole = 'DIRECTOR';
      revisionAction = 'RECOMMENDED';
      revisionStage = 'TIER_1B_HOD_RECOMMENDATION';
      nextDirectorId = facultyHierarchy.dean!.id;
    }

    const updated = await prisma.$transaction(async (tx) => {
      let finalRemarks = directorRemarks ? directorRemarks.trim() : null;
      if (isHodRecommendationToDean) {
        finalRemarks = directorRemarks ? `[HOD Recommendation] ${directorRemarks.trim()}` : '[HOD Recommended to Dean]';
      } else if (decision === 'RECOMMEND' && facultyHierarchy?.isFacultyStaff) {
        finalRemarks = application.directorRemarks
          ? `${application.directorRemarks}\n[Dean Recommendation] ${directorRemarks ? directorRemarks.trim() : 'Recommended to Registry'}`
          : (directorRemarks ? `[Dean Recommendation] ${directorRemarks.trim()}` : '[Dean Recommended to Registry]');
      }

      const app = await tx.institutionalApplication.update({
        where: { id },
        data: {
          directorId: nextDirectorId,
          status: newStatus,
          currentHolderRole: newHolderRole,
          directorRemarks: finalRemarks,
          directorRecommendedAt: decision === 'RECOMMEND' ? now : null,
        },
      });

      let revisionComments = directorRemarks ? directorRemarks.trim() : 'Endorsed & recommended by Director';
      if (isHodRecommendationToDean) {
        revisionComments = directorRemarks
          ? `HOD Recommendation forwarded to Dean: ${directorRemarks.trim()}`
          : `Recommended by HOD (${facultyHierarchy?.hod?.name || 'HOD'}) and forwarded to Dean (${facultyHierarchy?.dean?.name || 'Dean'})`;
      } else if (decision === 'RECOMMEND' && facultyHierarchy?.isFacultyStaff) {
        revisionComments = directorRemarks
          ? `Dean Recommendation to Registry: ${directorRemarks.trim()}`
          : `Endorsed & recommended by Dean (${facultyHierarchy?.dean?.name || 'Dean'}) to Registry Inward Desk`;
      }

      await tx.applicationRevisionHistory.create({
        data: {
          applicationId: app.id,
          actorId: callerId,
          stage: revisionStage,
          action: revisionAction,
          comments: revisionComments,
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
    if (isHodRecommendationToDean) {
      // Notify Dean
      notifyUser(
        facultyHierarchy.dean!.id,
        '📄 Faculty Staff Application Forwarded by HOD for Dean Endorsement',
        `HOD ${directorName} has recommended staff ${applicantName}'s application (${application.referenceNumber}: ${application.subject}) and routed it to your Office for Dean recommendation to Registry.`,
        'INFO',
        '/director/applications/pending'
      ).catch(() => {});

      if (facultyHierarchy.dean!.email) {
        sendDirectorNotificationEmail(
          facultyHierarchy.dean!.email,
          facultyHierarchy.dean!.name || 'Dean',
          applicantName,
          application.subject,
          application.referenceNumber,
          application.category
        ).catch(() => {});
      }

      // Notify Applicant
      notifyUser(
        application.applicantId,
        '✅ Application Recommended by HOD',
        `Your Head of Department (${directorName}) has recommended your application (${application.referenceNumber}) and forwarded it to Dean (${facultyHierarchy.dean!.name || 'Dean'}) for onward transmission to Registry.`,
        'SUCCESS',
        '/portal/applications/my-applications'
      ).catch(() => {});

      if (application.applicant.email) {
        sendApplicantProgressEmail(
          application.applicant.email,
          applicantName,
          application.referenceNumber,
          'FORWARDED_TO_DEAN',
          directorRemarks
        ).catch(() => {});
      }
    } else {
      notifyUser(
        application.applicantId,
        decision === 'RECOMMEND'
          ? (facultyHierarchy?.isFacultyStaff ? '✅ Application Recommended by Dean to Registry' : '✅ Application Recommended by Director')
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

      if (decision === 'RECOMMEND') {
        try {
          const registryAndHrUsers = await prisma.user.findMany({
            where: {
              role: { in: ['REGISTRY_ADMIN', 'HR_ADMIN', 'ADMIN', 'SUPER_USER'] },
              isActive: true,
            },
            select: { id: true, email: true, name: true },
          });

          for (const regUser of registryAndHrUsers) {
            notifyUser(
              regUser.id,
              '📥 New Directorate Endorsement for Inward Docketing',
              `${facultyHierarchy?.isFacultyStaff ? 'Dean' : 'Director'} ${directorName} has endorsed application ${application.referenceNumber} (${application.subject}) for staff ${applicantName}. Awaiting Registry Folio docketing.`,
              'INFO',
              '/dashboard/registry/inward-docket'
            ).catch(() => {});

            if (regUser.email) {
              sendRegistryInwardDeskNotificationEmail(
                regUser.email,
                regUser.name || 'Registry / HR Officer',
                directorName,
                applicantName,
                application.subject,
                application.referenceNumber,
                application.category,
                directorRemarks ? directorRemarks.trim() : undefined
              ).catch(() => {});
            }
          }
        } catch (notifErr) {
          console.warn('[Docket Notification] Error notifying Registry/HR admins:', notifErr);
        }
      }
    }

    emitApplicationStatusChanged({
      applicationId: updated.id,
      refNo: updated.referenceNumber,
      oldStatus: application.status,
      newStatus,
      actorName: directorName,
      remarks: directorRemarks,
      actionUrl: '/dashboard/registry/inward-docket',
    });

    await cacheInvalidationService.invalidateInstitutionalApplications();

    const successMsg = isHodRecommendationToDean
      ? `Application successfully recommended by HOD and forwarded to Dean (${facultyHierarchy?.dean?.name || 'Dean'}).`
      : facultyHierarchy?.isFacultyStaff && decision === 'RECOMMEND'
      ? `Application successfully recommended by Dean and forwarded to Registry Inward Desk.`
      : `Application successfully ${decision.toLowerCase()}ed by Director.`;

    return res.status(200).json({
      success: true,
      message: successMsg,
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

    // Guard: Registry Inward Desk Officers, HR Admins, Super Users, Admins, Registrar
    const allowedRoles = [
      'REGISTRY_ADMIN',
      'HR_ADMIN',
      'SUPER_USER',
      'ADMIN',
      'REGISTRAR',
      'DEPUTY_REGISTRAR',
      'VICE_CHANCELLOR',
    ];
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

    // Notify Registrar & Deputy Registrar for Executive Adjudication
    prisma.user
      .findMany({
        where: {
          role: { in: ['REGISTRAR', 'DEPUTY_REGISTRAR', 'SUPER_USER', 'ADMIN', 'VICE_CHANCELLOR'] },
          isActive: true,
        },
        select: { id: true },
      })
      .then((registrarUsers) => {
        for (const regUser of registrarUsers) {
          notifyUser(
            regUser.id,
            '📜 Docketed Application Awaiting Determination',
            `Application ${application.referenceNumber} (Folio: ${folioNumber}) from ${applicantName} has been received and docketed by Registry Inward Desk.`,
            'INFO',
            '/registrar-cockpit/applications'
          ).catch(() => {});
        }
      })
      .catch(() => {});

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
    const rawDecision = req.body.decision || req.body.action;
    const decision = rawDecision ? String(rawDecision).trim().toUpperCase() : '';
    const rawRemarks = req.body.registrarRemarks || req.body.remarks || req.body.minute || req.body.comments || '';
    const registrarRemarks = typeof rawRemarks === 'string' ? rawRemarks.trim() : '';

    if (!['APPROVED', 'DECLINED', 'APPROVE', 'DECLINE'].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: "Decision must be 'APPROVED' or 'DECLINED'.",
      });
    }

    const normalizedDecision = ['APPROVED', 'APPROVE'].includes(decision) ? 'APPROVED' : 'DECLINED';

    if (!registrarRemarks) {
      return res.status(400).json({
        success: false,
        error: 'Mandatory executive remarks are required for Registrar final determination.',
      });
    }

    // Role Guard: REGISTRAR, DEPUTY_REGISTRAR, SUPER_USER, ADMIN, or VICE_CHANCELLOR
    const allowedRoles = ['REGISTRAR', 'DEPUTY_REGISTRAR', 'SUPER_USER', 'ADMIN', 'VICE_CHANCELLOR'];
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
    const isApproved = normalizedDecision === 'APPROVED';
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
          decision: normalizedDecision,
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
        normalizedDecision,
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
        normalizedDecision,
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
      include: { unit: true, studyCenter: true },
    });
    if (directorProfile) {
      if (directorProfile.userId) directorUserIds.push(directorProfile.userId);
      if (directorProfile.id) directorUserIds.push(directorProfile.id);
    }
    directorUserIds = Array.from(new Set(directorUserIds.filter(Boolean)));

    const isCentralExecutive = ['SUPER_USER', 'VICE_CHANCELLOR'].includes(callerRole);
    let baseScope: any;

    if (isCentralExecutive) {
      baseScope = { directorId: { not: '' } };
    } else {
      // An application submitted "Through Director" is strictly addressed to this specific Director/Head.
      // Enforce absolute isolation with zero cross-talk leakage and prohibit self-vetting.
      baseScope = {
        directorId: { in: directorUserIds },
        applicantId: { notIn: directorUserIds },
      };
    }

    let statusCondition: any = undefined;
    const statusParam = status ? String(status).toUpperCase().trim() : 'ALL';

    if (statusParam === 'PENDING' || statusParam === 'SUBMITTED_TO_DIRECTOR') {
      statusCondition = 'SUBMITTED_TO_DIRECTOR';
    } else if (statusParam === 'RECOMMENDED' || statusParam === 'ENDORSED') {
      statusCondition = { in: ['RECOMMENDED_TO_REGISTRY', 'DOCKETED_PENDING_REGISTRAR'] };
    } else if (statusParam === 'APPROVED' || statusParam === 'APPROVED_BY_REGISTRAR') {
      statusCondition = 'APPROVED_BY_REGISTRAR';
    } else if (statusParam === 'REJECTED' || statusParam === 'DECLINED') {
      statusCondition = { in: ['REJECTED_BY_DIRECTOR', 'DECLINED_BY_REGISTRAR'] };
    } else if (statusParam === 'REWRITE' || statusParam === 'RETURNED_FOR_REWRITE') {
      statusCondition = 'RETURNED_FOR_REWRITE';
    } else if (statusParam !== 'ALL' && statusParam !== '') {
      statusCondition = statusParam;
    }

    const whereClause: any = {
      ...baseScope,
      ...(statusCondition ? { status: statusCondition } : {}),
    };

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
        revisions: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Aggregate status counts for filter tabs
    const allScopedApps = await prisma.institutionalApplication.findMany({
      where: baseScope,
      select: { id: true, status: true },
    });

    const summary = {
      total: allScopedApps.length,
      pending: allScopedApps.filter((a) => a.status === 'SUBMITTED_TO_DIRECTOR').length,
      recommended: allScopedApps.filter((a) => ['RECOMMENDED_TO_REGISTRY', 'DOCKETED_PENDING_REGISTRAR'].includes(a.status)).length,
      approved: allScopedApps.filter((a) => a.status === 'APPROVED_BY_REGISTRAR').length,
      rejected: allScopedApps.filter((a) => ['REJECTED_BY_DIRECTOR', 'DECLINED_BY_REGISTRAR'].includes(a.status)).length,
      rewrite: allScopedApps.filter((a) => a.status === 'RETURNED_FOR_REWRITE').length,
    };

    return res.status(200).json({
      success: true,
      data: applications,
      applications,
      summary,
    });
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
    const rawFilter = req.query.filter || req.query.status || 'ALL';
    const filter = String(rawFilter).toUpperCase().trim();

    const whereClause: any = {};
    if (filter === 'AWAITING' || filter === 'PENDING' || filter === 'RECOMMENDED' || filter === 'RECOMMENDED_TO_REGISTRY') {
      whereClause.status = 'RECOMMENDED_TO_REGISTRY';
    } else if (filter === 'DOCKETED' || filter === 'DOCKETED_PENDING_REGISTRAR') {
      whereClause.status = 'DOCKETED_PENDING_REGISTRAR';
    } else if (filter === 'APPROVED' || filter === 'APPROVED_BY_REGISTRAR') {
      whereClause.status = 'APPROVED_BY_REGISTRAR';
    } else if (filter === 'DECLINED' || filter === 'REJECTED' || filter === 'DECLINED_BY_REGISTRAR') {
      whereClause.status = 'DECLINED_BY_REGISTRAR';
    } else {
      // Default / ALL: all applications that have reached Registry stage
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
                title: true,
                surname: true,
                otherNames: true,
                rank: true,
                unit: { select: { id: true, name: true } },
              },
            },
          },
        },
        registryClerk: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        revisions: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Summary counts for filter tabs
    const allRegistryApps = await prisma.institutionalApplication.findMany({
      where: {
        status: {
          in: ['RECOMMENDED_TO_REGISTRY', 'DOCKETED_PENDING_REGISTRAR', 'APPROVED_BY_REGISTRAR', 'DECLINED_BY_REGISTRAR'],
        },
      },
      select: { id: true, status: true },
    });

    const summary = {
      total: allRegistryApps.length,
      awaiting: allRegistryApps.filter((a) => a.status === 'RECOMMENDED_TO_REGISTRY').length,
      docketed: allRegistryApps.filter((a) => a.status === 'DOCKETED_PENDING_REGISTRAR').length,
      approved: allRegistryApps.filter((a) => a.status === 'APPROVED_BY_REGISTRAR').length,
      declined: allRegistryApps.filter((a) => a.status === 'DECLINED_BY_REGISTRAR').length,
    };

    return res.status(200).json({
      success: true,
      data: applications,
      applications,
      summary,
    });
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
    const rawFilter = req.query.filter || req.query.status || 'PENDING';
    const filter = String(rawFilter).toUpperCase().trim();

    const whereClause: any = {};
    if (filter === 'PENDING' || filter === 'DOCKETED') {
      whereClause.status = 'DOCKETED_PENDING_REGISTRAR';
    } else if (filter === 'APPROVED' || filter === 'APPROVED_BY_REGISTRAR') {
      whereClause.status = 'APPROVED_BY_REGISTRAR';
    } else if (filter === 'DECLINED' || filter === 'REJECTED' || filter === 'DECLINED_BY_REGISTRAR') {
      whereClause.status = 'DECLINED_BY_REGISTRAR';
    } else if (filter !== 'ALL') {
      whereClause.status = filter;
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
                rank: true,
                surname: true,
                otherNames: true,
                title: true,
                highestQualification: true,
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
                title: true,
                surname: true,
                otherNames: true,
                rank: true,
                unit: { select: { id: true, name: true } },
              },
            },
          },
        },
        registryClerk: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        revisions: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const allRegistrarApps = await prisma.institutionalApplication.findMany({
      where: {
        status: {
          in: ['DOCKETED_PENDING_REGISTRAR', 'APPROVED_BY_REGISTRAR', 'DECLINED_BY_REGISTRAR'],
        },
      },
      select: { id: true, status: true },
    });

    const summary = {
      total: allRegistrarApps.length,
      pending: allRegistrarApps.filter((a) => a.status === 'DOCKETED_PENDING_REGISTRAR').length,
      approved: allRegistrarApps.filter((a) => a.status === 'APPROVED_BY_REGISTRAR').length,
      declined: allRegistrarApps.filter((a) => a.status === 'DECLINED_BY_REGISTRAR').length,
    };

    return res.status(200).json({
      success: true,
      data: applications,
      applications,
      summary,
    });
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

      // Resolve designated Director / Dean / HOD using unified strict resolver
      facultyHierarchy = await resolveFacultyStaffHierarchy(callerId);

      if (facultyHierarchy?.isFacultyStaff && facultyHierarchy.hod && !facultyHierarchy.isCallerHod && !facultyHierarchy.isCallerDean) {
        designatedDirector = {
          id: facultyHierarchy.hod.id,
          name: facultyHierarchy.hod.name,
          email: facultyHierarchy.hod.email,
          unit: facultyHierarchy.department?.name || 'Department',
          role: 'UNIT_HEAD',
          title: facultyHierarchy.hod.title || 'HOD',
          reason: `Head of Department (HOD) for ${facultyHierarchy.department?.name || 'Department'} (Faculty of ${facultyHierarchy.faculty?.name || 'Faculty'})`
        };
      } else if (facultyHierarchy?.isFacultyStaff && facultyHierarchy.dean && facultyHierarchy.isCallerHod) {
        designatedDirector = {
          id: facultyHierarchy.dean.id,
          name: facultyHierarchy.dean.name,
          email: facultyHierarchy.dean.email,
          unit: facultyHierarchy.faculty?.name || 'Faculty',
          role: 'UNIT_HEAD',
          title: facultyHierarchy.dean.title || 'Dean',
          reason: `Faculty Dean for ${facultyHierarchy.faculty?.name || 'Faculty'}`
        };
      } else {
        const resolvedList = await resolveStaffDirector(callerId);
        if (resolvedList.length > 0) {
          const primary = resolvedList[0];
          designatedDirector = {
            id: primary.id,
            name: primary.name,
            email: primary.email,
            unit: primary.unitName || callerProfile?.unit?.name || callerProfile?.studyCenter?.name || 'Designated Directorate',
            role: primary.role,
            title: primary.title,
            reason: primary.reason || `Designated Supervisor for ${callerProfile?.unit?.name || 'Unit'}`
          };
        }
      }
    }

    // Ensure designated director is at the top of the selectable list if present
    if (designatedDirector) {
      const existsIndex = directors.findIndex(d => d.id === designatedDirector.id);
      if (existsIndex > -1) {
        const [match] = directors.splice(existsIndex, 1);
        directors.unshift(match);
      } else {
        directors.unshift({
          id: designatedDirector.id,
          name: designatedDirector.name,
          email: designatedDirector.email,
          unit: designatedDirector.unit,
          role: designatedDirector.role,
          title: designatedDirector.title,
          rank: designatedDirector.rank,
        });
      }
    }

    return res.status(200).json({ 
      success: true, 
      directors, 
      data: directors,
      designatedDirector,
      facultyHierarchy
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
                title: true,
                surname: true,
                otherNames: true,
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
        director: {
          select: {
            id: true,
            name: true,
            email: true,
            staffProfile: {
              select: {
                id: true,
                title: true,
                surname: true,
                otherNames: true,
                rank: true,
                unit: { select: { id: true, name: true } },
              },
            },
          },
        },
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
