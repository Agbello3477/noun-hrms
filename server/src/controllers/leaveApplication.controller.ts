import { Request, Response } from 'express';
import { LeaveType, LeaveApplicationStatus, Role, Cadre } from '@prisma/client';
import prisma from '../prisma';
import { calculateWorkingDays } from '../utils/calculateWorkingDays';
import {
  getOrInitializeLeaveBalances,
  checkIsPrincipalOfficer,
  parseSalaryScaleAndGrade,
  resolveStaffDirector,
} from '../services/leaveEntitlement.service';
import { resolveFacultyStaffHierarchy } from '../services/facultyStaffRouting.service';
import { ProbationConfirmationService } from '../services/ProbationConfirmationService';
import { TrainingBondGuard } from '../services/TrainingBondGuard';
import { notifyUser } from './notification.controller';
import { sendLeaveNotification } from '../services/email.service';

/**
 * Staff applies for statutory leave
 * POST /api/v1/leave/apply
 */
export const applyForStatutoryLeave = async (req: Request, res: Response) => {
  try {
    const {
      leaveType,
      startDate,
      endDate,
      reason,
      reliefStaffId,
      supportingDocumentUrl,
      isPaidLeave: requestedIsPaid,
    } = req.body;

    // @ts-ignore
    const userId = req.user.id;

    if (!leaveType || !startDate || !endDate) {
      return res.status(400).json({ message: 'leaveType, startDate, and endDate are required.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid start or end date format.' });
    }

    if (start > end) {
      return res.status(400).json({ message: 'End date must be greater than or equal to start date.' });
    }

    const staffProfile = await prisma.staffProfile.findUnique({
      where: { userId },
      include: { user: true, unit: true, studyCenter: true }
    });

    if (!staffProfile) {
      return res.status(404).json({ message: 'Staff profile not found for this user.' });
    }

    const year = start.getFullYear();

    // 1. Overlapping Leave Check
    const overlappingLeave = await prisma.leaveApplication.findFirst({
      where: {
        staffId: staffProfile.id,
        status: { in: [LeaveApplicationStatus.PENDING_HOD, LeaveApplicationStatus.PENDING_REGISTRY, LeaveApplicationStatus.APPROVED] },
        startDate: { lte: end },
        endDate: { gte: start }
      }
    });

    if (overlappingLeave) {
      return res.status(400).json({
        message: 'You already have a pending or approved leave application that overlaps with the requested date window.'
      });
    }

    // 2. Fetch holidays from database spanning the window
    const holidays = await prisma.universityHoliday.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        },
        isObserved: true
      }
    });

    // 3. Compute net working days excluding weekends & holidays
    const { workingDays, totalDays, weekendDaysExcluded, holidaysExcluded } = calculateWorkingDays(
      start,
      end,
      holidays
    );

    if (workingDays <= 0) {
      return res.status(400).json({
        message: 'The requested leave window contains 0 working days (falls entirely on weekends or statutory holidays).'
      });
    }

    // 4. Validate statutory rules by leave type
    const resolvedType = leaveType as LeaveType;
    const isPrincipalOfficer = checkIsPrincipalOfficer(staffProfile);

    // Casual Leave: Max 7 working days cumulative per year
    if (resolvedType === LeaveType.CASUAL && workingDays > 7) {
      return res.status(400).json({
        message: `Casual leave cannot exceed 7 working days per single application (Requested: ${workingDays} days).`
      });
    }

    // Sick Leave: Exceeding 2 days requires formal medical report from Clinic/Health Services
    if (resolvedType === LeaveType.SICK && workingDays > 2 && !supportingDocumentUrl) {
      return res.status(400).json({
        message: 'Sick leave exceeding 2 working days requires an official medical report from the University Health Services or approved hospital.'
      });
    }

    // Maternity Leave: Requires medical certificate of expected delivery
    if (resolvedType === LeaveType.MATERNITY && !supportingDocumentUrl) {
      return res.status(400).json({
        message: 'Maternity leave requires an uploaded medical certificate of expected delivery date.'
      });
    }

    // Paternity Leave: Requires birth certificate or delivery notice
    if (resolvedType === LeaveType.PATERNITY && !supportingDocumentUrl) {
      return res.status(400).json({
        message: 'Paternity leave requires an uploaded birth certificate or hospital delivery notification.'
      });
    }

    // Sabbatical & Research Leave: Restricted to Academic Cadre (Senior Lecturer and above)
    if (resolvedType === LeaveType.SABBATICAL || resolvedType === LeaveType.RESEARCH) {
      if (staffProfile.cadre !== Cadre.ACADEMIC) {
        return res.status(403).json({
          message: `${resolvedType === LeaveType.SABBATICAL ? 'Sabbatical' : 'Research'} Leave is strictly restricted to Academic staff.`
        });
      }

      const rank = (staffProfile.rank || '').toUpperCase();
      const eligibleRanks = ['SENIOR LECTURER', 'ASSOCIATE PROFESSOR', 'READER', 'PROFESSOR'];
      const isEligibleRank = eligibleRanks.some(r => rank.includes(r));

      if (!isEligibleRank) {
        return res.status(403).json({
          message: 'Sabbatical & Research Leave is statutory for Senior Lecturers and above only.'
        });
      }

      if (!supportingDocumentUrl) {
        return res.status(400).json({
          message: 'Sabbatical/Research Leave requires an uploaded research synopsis and institutional letter of placement/invitation.'
        });
      }
    }

    // Study & Training Leave: Hard Confirmation Prerequisite & SDC Approval Document
    if (resolvedType === LeaveType.STUDY || resolvedType === LeaveType.TRAINING) {
      const confirmCheck = ProbationConfirmationService.validateLeavePrerequisites(staffProfile, resolvedType);
      if (!confirmCheck.valid) {
        return res.status(403).json({
          error: confirmCheck.error,
          message: confirmCheck.message
        });
      }

      if (!supportingDocumentUrl) {
        return res.status(400).json({
          message: 'Study and Training Leave requires an uploaded Staff Development Committee approval letter.'
        });
      }
    }

    // Active Training Bond Guard for Leave of Absence or Secondary Study/Training Leave
    if (
      resolvedType === LeaveType.LEAVE_OF_ABSENCE_WITHOUT_PAY ||
      resolvedType === LeaveType.WITHOUT_PAY ||
      resolvedType === LeaveType.STUDY ||
      resolvedType === LeaveType.TRAINING
    ) {
      const bondGuard = await TrainingBondGuard.checkActiveBond(staffProfile.id, resolvedType);
      if (bondGuard.hasActiveBond) {
        return res.status(403).json({
          error: bondGuard.error,
          message: bondGuard.message
        });
      }
    }

    // Determine paid vs. unpaid
    let isPaidLeave = true;
    let payrollSuspensionFlag = false;

    if (
      resolvedType === LeaveType.LEAVE_OF_ABSENCE_WITHOUT_PAY ||
      resolvedType === LeaveType.WITHOUT_PAY ||
      requestedIsPaid === false
    ) {
      isPaidLeave = false;
      payrollSuspensionFlag = true;
    }

    // 5. Verify staff leave balance for the requested category
    const balances = await getOrInitializeLeaveBalances(staffProfile.id, year);
    const balance = balances.find(b => b.leaveType === resolvedType) || balances.find(b => b.leaveType === LeaveType.ANNUAL);

    if (balance && balance.daysRemaining < workingDays) {
      return res.status(400).json({
        message: `Insufficient leave balance for ${resolvedType}. Requested: ${workingDays} working days, Remaining: ${balance.daysRemaining} days.`
      });
    }

    // 6. Dual-Level Maker-Checker Routing:
    // If applicant is Principal Officer, route directly to PENDING_REGISTRY (Council/VC Docket).
    // Otherwise, route to PENDING_HOD for Level 1 endorsement.
    const initialStatus = isPrincipalOfficer
      ? LeaveApplicationStatus.PENDING_REGISTRY
      : LeaveApplicationStatus.PENDING_HOD;

    const application = await prisma.leaveApplication.create({
      data: {
        staffId: staffProfile.id,
        leaveType: resolvedType,
        startDate: start,
        endDate: end,
        workingDaysCount: workingDays,
        reliefStaffId: reliefStaffId || null,
        status: initialStatus,
        reason: reason || null,
        supportingDocumentUrl: supportingDocumentUrl || null,
        isPrincipalOfficer,
        isPaidLeave,
        payrollSuspensionFlag,
      },
      include: {
        staff: {
          include: {
            user: { select: { name: true, email: true } },
            unit: { select: { name: true, code: true } }
          }
        },
        reliefStaff: {
          include: {
            user: { select: { name: true, email: true } }
          }
        }
      }
    });

    // Notify Approvers
    try {
      const staffName = staffProfile.user?.name || 'Staff Member';
      if (isPrincipalOfficer) {
        // Notify Registrar / VC
        const executiveApprovers = await prisma.user.findMany({
          where: {
            role: { in: [Role.REGISTRAR, Role.VICE_CHANCELLOR, Role.SUPER_USER] },
            isActive: true,
            id: { not: userId }
          },
          select: { id: true, email: true, name: true }
        });

        for (const approver of executiveApprovers) {
          await notifyUser(
            approver.id,
            'Principal Officer Leave Application',
            `Principal Officer ${staffName} submitted a ${resolvedType} leave application (${workingDays} working days). Pending Executive Authorization.`,
            'INFO',
            '/dashboard/leaves'
          );
        }
      } else {
        // Resolve Faculty Hierarchy: If applicant is Faculty staff, notify their HOD specifically!
        const facultyHierarchy = await resolveFacultyStaffHierarchy(staffProfile.id);
        const isFacultyStaff = Boolean(facultyHierarchy?.isFacultyStaff && !isPrincipalOfficer && !facultyHierarchy.isCallerDean);

        if (isFacultyStaff && facultyHierarchy.hod?.id) {
          const hodUser = facultyHierarchy.hod;
          await notifyUser(
            hodUser.id,
            '📋 Faculty Leave Application - HOD Recommendation Required',
            `Staff member ${staffName} has submitted a ${resolvedType} leave application (${workingDays} working days) to Dean ${facultyHierarchy.dean?.name || 'of Faculty'} through you. Pending your HOD review and recommendation.`,
            'INFO',
            '/dashboard/unit/leaves'
          );

          if (hodUser.email) {
            sendLeaveNotification(
              hodUser.email,
              hodUser.name || 'Head of Department',
              String(resolvedType).replace(/_/g, ' '),
              'PENDING HOD RECOMMENDATION',
              workingDays,
              `Staff member ${staffName} has submitted a ${resolvedType} leave application (${workingDays} working days) to the Faculty Dean through you. Please review and recommend.`
            ).catch(e => console.warn('Email dispatch warning:', e));
          }
        } else {
          // Strict isolated resolution: Notify ONLY this staff's designated Director / Dean / HOD / Center Manager
          const unitApprovers = await resolveStaffDirector(staffProfile.id);

          for (const approver of unitApprovers) {
            await notifyUser(
              approver.id,
              'New Leave Application',
              `${staffName} applied for ${resolvedType} (${workingDays} working days). Pending your Level 1 endorsement.`,
              'INFO',
              '/dashboard/unit/leaves'
            );

            if (approver.email) {
              sendLeaveNotification(
                approver.email,
                approver.name || 'Director',
                String(resolvedType).replace(/_/g, ' '),
                'PENDING LEVEL 1 REVIEW',
                workingDays,
                `Staff member ${staffName} has submitted a ${resolvedType} leave application (${workingDays} working days) for your Directorate review and endorsement.`
              ).catch(e => console.warn('Email dispatch warning:', e));
            }
          }
        }
      }
    } catch (notifErr) {
      console.warn('Notification error on leave application:', notifErr);
    }

    res.status(201).json({
      message: 'Leave application submitted successfully.',
      application,
      breakdown: {
        workingDays,
        totalDays,
        weekendDaysExcluded,
        holidaysExcluded
      }
    });
  } catch (error: any) {
    console.error('applyForStatutoryLeave error:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

/**
 * Get leave balances for the authenticated staff member
 * GET /api/v1/leave/balances
 */
export const getMyLeaveBalances = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.user.id;

    const staffProfile = await prisma.staffProfile.findUnique({
      where: { userId },
      include: { user: true }
    });

    if (!staffProfile) {
      return res.status(404).json({ message: 'Staff profile not found.' });
    }

    const year = Number(req.query.year) || new Date().getFullYear();
    const balances = await getOrInitializeLeaveBalances(staffProfile.id, year);

    const isPrincipalOfficer = checkIsPrincipalOfficer(staffProfile);
    const { salaryScale, gradeLevel } = parseSalaryScaleAndGrade(staffProfile);

    res.json({
      staffProfile: {
        id: staffProfile.id,
        name: staffProfile.user?.name,
        rank: staffProfile.rank,
        level: staffProfile.level,
        cadre: staffProfile.cadre,
        salaryScale,
        gradeLevel,
        isPrincipalOfficer
      },
      year,
      balances
    });
  } catch (error: any) {
    console.error('getMyLeaveBalances error:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

/**
 * Get leave applications for the authenticated staff member
 * GET /api/v1/leave/applications/my
 */
export const getMyLeaveApplications = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.user.id;

    const staffProfile = await prisma.staffProfile.findUnique({
      where: { userId }
    });

    if (!staffProfile) {
      return res.status(404).json({ message: 'Staff profile not found.' });
    }

    const applications = await prisma.leaveApplication.findMany({
      where: { staffId: staffProfile.id },
      include: {
        reliefStaff: {
          include: {
            user: { select: { name: true, email: true } }
          }
        },
        hodApprovedBy: { select: { name: true, role: true } },
        registryApprovedBy: { select: { name: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(applications);
  } catch (error: any) {
    console.error('getMyLeaveApplications error:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

/**
 * Get pending leave applications for HOD or Registry vetting
 * GET /api/v1/leave/applications/pending
 */
export const getPendingLeaveApplications = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userRole = req.user.role as Role;
    // @ts-ignore
    const userId = req.user.id;

    const { leaveType, status, unitId, salaryScale } = req.query;

    const isExecutiveOrRegistry = (
      [
        Role.HR_ADMIN,
        Role.REGISTRY_ADMIN,
        Role.REGISTRAR,
        Role.DEPUTY_REGISTRAR,
        Role.SUPER_USER,
        Role.VICE_CHANCELLOR
      ] as Role[]
    ).includes(userRole);

    let whereClause: any = {};

    const headProfile = !isExecutiveOrRegistry ? await prisma.staffProfile.findUnique({
      where: { userId },
      include: { unit: true, studyCenter: true }
    }) : null;

    const isDeanOfFaculty = Boolean(
      !isExecutiveOrRegistry &&
      headProfile &&
      (headProfile.unit?.type === 'FACULTY' || (headProfile.unit?.code && headProfile.unit.code.startsWith('FAC-')) || (headProfile.rank && headProfile.rank.toUpperCase().includes('DEAN')))
    );

    if (status) {
      whereClause.status = status as LeaveApplicationStatus;
    } else if (isExecutiveOrRegistry || isDeanOfFaculty) {
      // Registry & Deans see both PENDING_REGISTRY and PENDING_HOD
      whereClause.status = {
        in: [LeaveApplicationStatus.PENDING_REGISTRY, LeaveApplicationStatus.PENDING_HOD]
      };
    } else {
      // HOD / Unit Head defaults to PENDING_HOD
      whereClause.status = LeaveApplicationStatus.PENDING_HOD;
    }

    if (leaveType) {
      whereClause.leaveType = leaveType as LeaveType;
    }

    if (!isExecutiveOrRegistry) {
      if (!headProfile) {
        return res.status(403).json({ message: 'Approver profile not found.' });
      }

      const isStudyCenterManager = userRole === Role.STUDY_CENTER_MANAGER;
      const isUnitLeaderRole = userRole === Role.UNIT_HEAD || userRole === Role.CLINIC_HEAD || userRole === Role.SECURITY_HEAD;
      const isRankLeader = Boolean(headProfile.rank && ['DIRECTOR', 'DEAN', 'HOD', 'HEAD', 'COORDINATOR'].some(k => headProfile.rank!.toUpperCase().includes(k)));

      const targetUnitIds: string[] = [];

      // 1. Units where this user or profile is set as explicit headId
      const headedUnits = await prisma.unit.findMany({
        where: {
          OR: [
            { headId: userId },
            { headId: headProfile.id }
          ]
        },
        select: { id: true, code: true, type: true }
      });
      for (const u of headedUnits) {
        if (!targetUnitIds.includes(u.id)) {
          targetUnitIds.push(u.id);
        }
      }

      // 2. Direct unit ID ONLY if the user holds an administrative leadership role/rank in that unit
      if ((isUnitLeaderRole || isRankLeader) && headProfile.unitId && !targetUnitIds.includes(headProfile.unitId)) {
        targetUnitIds.push(headProfile.unitId);
      }

      // 3. Faculty child departments if caller heads/leads a Faculty
      const facultyUnits = [
        ...(headProfile.unit?.type === 'FACULTY' || (headProfile.unit?.code && headProfile.unit.code.startsWith('FAC-')) ? [headProfile.unit] : []),
        ...headedUnits.filter(u => u.type === 'FACULTY' || (u.code && u.code.startsWith('FAC-')))
      ];

      for (const f of facultyUnits) {
        const facultyDeptMapping: Record<string, string[]> = {
          'FAC-SCIEN': ['DEP-CS', 'DEP-MTH'],
          'FAC-LAW': ['DEP-LAW'],
          'FAC-SOCIA': ['DEP-POL', 'DEP-ECO', 'DEP-SOC'],
          'FAC-MANAG': ['DEP-ACC', 'DEP-BUS', 'DEP-PAD'],
          'FAC-EDUCA': ['DEP-EDT', 'DEP-EDU'],
          'FAC-HEALT': ['DEP-PBH', 'DEP-NUR'],
          'FAC-AGRIC': ['DEP-AGR'],
          'FAC-ARTS': ['DEP-ART', 'DEP-ENG', 'DEP-HIS'],
          'FAC-COMPU': ['DEP-CMP']
        };
        const deptCodes = facultyDeptMapping[f.code || ''] || [];
        if (deptCodes.length > 0) {
          const relatedUnits = await prisma.unit.findMany({
            where: { code: { in: deptCodes } },
            select: { id: true }
          });
          for (const ru of relatedUnits) {
            if (!targetUnitIds.includes(ru.id)) {
              targetUnitIds.push(ru.id);
            }
          }
        }
      }

      const centerId = isStudyCenterManager ? headProfile.centerId : null;

      if (targetUnitIds.length > 0 && centerId) {
        whereClause.staff = {
          id: { not: headProfile.id },
          userId: { not: userId },
          OR: [
            { unitId: { in: targetUnitIds } },
            { centerId }
          ]
        };
      } else if (targetUnitIds.length > 0) {
        whereClause.staff = {
          id: { not: headProfile.id },
          userId: { not: userId },
          unitId: { in: targetUnitIds }
        };
      } else if (centerId) {
        whereClause.staff = {
          id: { not: headProfile.id },
          userId: { not: userId },
          centerId
        };
      } else {
        // Approver is not a Unit Head, Dean, or Center Manager: return empty list immediately
        return res.json([]);
      }
    } else if (unitId) {
      whereClause.staff = { unitId: String(unitId) };
    }

    const applications = await prisma.leaveApplication.findMany({
      where: whereClause,
      include: {
        staff: {
          include: {
            user: { select: { name: true, email: true } },
            unit: { select: { name: true, code: true } },
            studyCenter: { select: { name: true, code: true } }
          }
        },
        reliefStaff: {
          include: {
            user: { select: { name: true, email: true } }
          }
        },
        hodApprovedBy: { select: { name: true, role: true } },
        registryApprovedBy: { select: { name: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Optional filter by salary scale (CONUASS / CONTISS)
    let filtered = applications;
    if (salaryScale) {
      const scaleQuery = String(salaryScale).toUpperCase();
      filtered = applications.filter(app => {
        const { salaryScale } = parseSalaryScaleAndGrade(app.staff);
        return salaryScale === scaleQuery;
      });
    }

    res.json(filtered);
  } catch (error: any) {
    console.error('getPendingLeaveApplications error:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

/**
 * Level 1: HOD / Unit Head Endorses Leave Application
 * PUT /api/v1/leave/:id/endorse-hod
 */
export const endorseLeaveByHod = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    // @ts-ignore
    const approverId = req.user.id;
    // @ts-ignore
    const userRole = req.user.role as Role;

    const application = await prisma.leaveApplication.findUnique({
      where: { id },
      include: {
        staff: { include: { user: true } }
      }
    });

    if (!application) {
      return res.status(404).json({ message: 'Leave application not found.' });
    }

    if (application.status !== LeaveApplicationStatus.PENDING_HOD) {
      return res.status(400).json({
        message: `Application is in '${application.status}' state and cannot receive Level 1 HOD endorsement.`
      });
    }

    const isExecutiveOrRegistry = (
      [
        Role.HR_ADMIN,
        Role.REGISTRY_ADMIN,
        Role.REGISTRAR,
        Role.DEPUTY_REGISTRAR,
        Role.SUPER_USER,
        Role.VICE_CHANCELLOR,
      ] as Role[]
    ).includes(userRole);

    const headProfile = await prisma.staffProfile.findUnique({
      where: { userId: approverId },
      include: { unit: true, studyCenter: true },
    });

    // Maker-Checker validation: Caller cannot endorse their own leave application
    if (application.staff?.userId === approverId || (headProfile && application.staffId === headProfile.id)) {
      return res.status(403).json({
        error: 'ERR_MAKER_CHECKER_SELF_AUTHORIZATION',
        message: 'Dual-control violation: You cannot endorse your own leave application.',
      });
    }

    // Jurisdiction validation for non-executive supervisors
    if (!isExecutiveOrRegistry) {
      if (!headProfile) {
        return res.status(403).json({
          error: 'FORBIDDEN_ORGANIZATIONAL_SCOPE',
          message: 'Supervisor profile not found or insufficient privileges.',
        });
      }

      let isAuthorized = false;
      const targetStaff = application.staff;

      if (headProfile.centerId && targetStaff.centerId && headProfile.centerId === targetStaff.centerId) {
        isAuthorized = true;
      } else if (headProfile.unitId && targetStaff.unitId && headProfile.unitId === targetStaff.unitId) {
        isAuthorized = true;
      } else {
        const headedUnits = await prisma.unit.findMany({
          where: {
            OR: [{ headId: approverId }, { headId: headProfile.id }],
          },
          select: { id: true, code: true, type: true },
        });

        const headedUnitIds = headedUnits.map((u) => u.id);
        if (targetStaff.unitId && headedUnitIds.includes(targetStaff.unitId)) {
          isAuthorized = true;
        } else {
          const allUnits = [...(headProfile.unit ? [headProfile.unit] : []), ...headedUnits];
          for (const u of allUnits) {
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
                const childIds = childUnits.map((cu) => cu.id);
                if (targetStaff.unitId && childIds.includes(targetStaff.unitId)) {
                  isAuthorized = true;
                  break;
                }
              }
            }
          }
        }
      }

      if (!isAuthorized) {
        return res.status(403).json({
          error: 'FORBIDDEN_ORGANIZATIONAL_SCOPE',
          message: "You do not have jurisdiction over this staff member's administrative unit.",
        });
      }
    }

    // Check if staff is faculty staff
    const facultyHierarchy = await resolveFacultyStaffHierarchy(application.staffId);
    const isFacultyLeave = Boolean(facultyHierarchy?.isFacultyStaff && facultyHierarchy.dean);

    const defaultRemarks = isFacultyLeave
      ? 'Recommended by Head of Department and forwarded to Faculty Dean for final approval.'
      : 'Endorsed by HOD/Unit Head for administrative clearance.';

    // Update to PENDING_REGISTRY (represents Pending Final Clearance)
    const updated = await prisma.leaveApplication.update({
      where: { id },
      data: {
        status: LeaveApplicationStatus.PENDING_REGISTRY,
        hodApprovalRemarks: remarks ? (isFacultyLeave ? `Recommended by HOD: ${remarks.trim()}` : remarks.trim()) : defaultRemarks,
        hodApprovedById: approverId,
        hodApprovedAt: new Date()
      },
      include: {
        staff: { include: { user: true } },
        hodApprovedBy: { select: { name: true, role: true } }
      }
    });

    // Notify Staff & Dean or Registry
    try {
      const approverUser = await prisma.user.findUnique({ where: { id: approverId }, select: { name: true } });
      const approverName = approverUser?.name || 'HOD';

      if (application.staff?.userId) {
        await notifyUser(
          application.staff.userId,
          isFacultyLeave ? '✅ Leave Application Recommended by HOD' : 'Leave Application Endorsed',
          isFacultyLeave
            ? `Your ${application.leaveType} application was recommended by your HOD and forwarded to Dean ${facultyHierarchy.dean?.name || 'of Faculty'} for final approval.`
            : `Your ${application.leaveType} application was endorsed by your HOD. Now awaiting Registry clearance.`,
          'SUCCESS',
          '/dashboard/leaves'
        );
      }

      if (isFacultyLeave && facultyHierarchy.dean?.id) {
        // Direct notification to Faculty Dean for Final Approval
        await notifyUser(
          facultyHierarchy.dean.id,
          '🏛️ Leave Application Awaiting Dean Final Approval',
          `HOD ${approverName} has recommended ${application.leaveType} leave for ${application.staff.user?.name || 'Staff'} (${application.workingDaysCount} working days) and pushed it to you for final approval.`,
          'INFO',
          '/dashboard/unit/leaves'
        );
      } else {
        // Notify Registry HR Officers
        const registryOfficers = await prisma.user.findMany({
          where: { role: { in: [Role.HR_ADMIN, Role.REGISTRY_ADMIN, Role.REGISTRAR] } },
          select: { id: true }
        });
        for (const reg of registryOfficers) {
          await notifyUser(
            reg.id,
            'Leave Pending Registry Clearance',
            `Leave for ${application.staff.user?.name || 'Staff'} has been endorsed by HOD and requires Registry clearance.`,
            'INFO',
            '/dashboard/unit/leaves'
          );
        }
      }
    } catch (e) {
      console.warn('Notification error on endorseLeaveByHod:', e);
    }

    res.json({
      message: isFacultyLeave
        ? 'Leave application recommended successfully by HOD and forwarded to the Dean for final approval.'
        : 'Leave application endorsed successfully and forwarded to Registry.',
      application: updated
    });
  } catch (error: any) {
    console.error('endorseLeaveByHod error:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

/**
 * Level 2: Registry / HR Authorizes Leave Application (Final Clearance & Ledger Mutation)
 * PUT /api/v1/leave/:id/authorize-registry
 */
export const authorizeLeaveByRegistry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    // @ts-ignore
    const approverId = req.user.id;
    // @ts-ignore
    const userRole = req.user.role as Role;

    const application = await prisma.leaveApplication.findUnique({
      where: { id },
      include: {
        staff: { include: { user: true } }
      }
    });

    if (!application) {
      return res.status(404).json({ message: 'Leave application not found.' });
    }

    if (
      application.status !== LeaveApplicationStatus.PENDING_REGISTRY &&
      application.status !== LeaveApplicationStatus.PENDING_HOD // Principal officers or emergency overrides
    ) {
      return res.status(400).json({
        message: `Application is in '${application.status}' state and cannot be authorized.`
      });
    }

    const year = application.startDate.getFullYear();
    const workingDaysCount = application.workingDaysCount;
    const resolvedType = application.leaveType;

    const facultyHierarchy = await resolveFacultyStaffHierarchy(application.staffId);
    const isDeanApprover = Boolean(facultyHierarchy?.dean?.id === approverId);

    const defaultRemarks = isDeanApprover
      ? 'Officially approved by Faculty Dean.'
      : 'Authorized by Registry/HR for statutory leave.';

    // Execute atomic balance ledger update and application authorization in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Fetch balance record
      let balance = await tx.leaveBalance.findUnique({
        where: {
          staffId_leaveType_year: {
            staffId: application.staffId,
            leaveType: resolvedType,
            year
          }
        }
      });

      // If category balance not found, fall back to Annual Leave balance
      if (!balance) {
        balance = await tx.leaveBalance.findUnique({
          where: {
            staffId_leaveType_year: {
              staffId: application.staffId,
              leaveType: LeaveType.ANNUAL,
              year
            }
          }
        });
      }

      // 2. Update balance ledger
      if (balance) {
        const newUtilized = balance.daysUtilized + workingDaysCount;
        const newRemaining = Math.max(0, balance.daysRemaining - workingDaysCount);

        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            daysUtilized: newUtilized,
            daysRemaining: newRemaining
          }
        });
      }

      // 3. Mark Staff status as ON_LEAVE
      await tx.staffProfile.update({
        where: { id: application.staffId },
        data: { status: 'ON_LEAVE' }
      });

      // 4. Update application status to APPROVED
      const updatedApp = await tx.leaveApplication.update({
        where: { id },
        data: {
          status: LeaveApplicationStatus.APPROVED,
          registryApprovalRemarks: remarks ? (isDeanApprover ? `Approved by Faculty Dean: ${remarks.trim()}` : remarks.trim()) : defaultRemarks,
          registryApprovedById: approverId,
          registryApprovedAt: new Date(),
          payrollSuspensionFlag: !application.isPaidLeave
        },
        include: {
          staff: { include: { user: true } },
          registryApprovedBy: { select: { name: true, role: true } }
        }
      });

      return updatedApp;
    });

    // Auto-generate statutory TrainingBondRecord for Study / Training Leave
    if (application.leaveType === LeaveType.STUDY || application.leaveType === LeaveType.TRAINING) {
      const durationYears = Math.max(1, Math.round((application.endDate.getTime() - application.startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
      await TrainingBondGuard.createBondRecord({
        staffProfileId: application.staffId,
        studyLeaveId: application.id,
        trainingType: 'FULL_TIME_SPONSORED' as any,
        studyDurationYears: durationYears,
        bondStartDate: application.startDate,
        totalFinancialIndemnity: 0.00
      }).catch(err => console.error('Error creating TrainingBondRecord on leave approval:', err));
    }

    // Notify Staff
    try {
      if (application.staff?.userId) {
        await notifyUser(
          application.staff.userId,
          isDeanApprover ? '🎉 Leave Application Approved by Dean' : 'Leave Application Approved',
          isDeanApprover
            ? `Your ${application.leaveType} application for ${workingDaysCount} working days was officially APPROVED by Dean ${facultyHierarchy?.dean?.name || 'of Faculty'}.`
            : `Your ${application.leaveType} application for ${workingDaysCount} working days was APPROVED by the Registry.`,
          'SUCCESS',
          '/dashboard/leaves'
        );

        if (application.staff.user?.email) {
          sendLeaveNotification(
            application.staff.user.email,
            application.staff.user.name || 'Staff Member',
            String(application.leaveType),
            'APPROVED',
            workingDaysCount,
            `Your leave application from ${application.startDate.toDateString()} to ${application.endDate.toDateString()} has been officially approved.`
          ).catch(e => console.warn('Email send warning:', e));
        }
      }
    } catch (e) {
      console.warn('Notification error on authorizeLeaveByRegistry:', e);
    }

    res.json({
      message: isDeanApprover
        ? 'Leave application officially approved by the Dean. Balances deducted.'
        : 'Leave application authorized successfully. Balances deducted.',
      application: result
    });
  } catch (error: any) {
    console.error('authorizeLeaveByRegistry error:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

/**
 * Faculty Dean Final Approval alias
 */
export const authorizeLeaveByDean = authorizeLeaveByRegistry;

/**
 * Reject a Leave Application
 * PUT /api/v1/leave/:id/reject
 */
export const rejectLeaveApplication = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    // @ts-ignore
    const approverId = req.user.id;

    const application = await prisma.leaveApplication.findUnique({
      where: { id },
      include: { staff: { include: { user: true } } }
    });

    if (!application) {
      return res.status(404).json({ message: 'Leave application not found.' });
    }

    const facultyHierarchy = await resolveFacultyStaffHierarchy(application.staffId);
    const isDeanRejecting = Boolean(facultyHierarchy?.dean?.id === approverId);
    const isHodRejecting = Boolean(facultyHierarchy?.hod?.id === approverId);
    const rejectRoleLabel = isDeanRejecting ? 'Faculty Dean' : (isHodRejecting ? 'Head of Department' : 'Supervisor / Registry');

    const updated = await prisma.leaveApplication.update({
      where: { id },
      data: {
        status: LeaveApplicationStatus.REJECTED,
        registryApprovalRemarks: remarks ? `Rejected by ${rejectRoleLabel}: ${remarks.trim()}` : `Rejected by ${rejectRoleLabel}.`
      }
    });

    if (application.staff?.userId) {
      await notifyUser(
        application.staff.userId,
        `❌ Leave Application Rejected by ${rejectRoleLabel}`,
        `Your ${application.leaveType} application was rejected: ${remarks || 'Administrative decision.'}`,
        'ERROR',
        '/dashboard/leaves'
      );
    }

    res.json({
      message: `Leave application rejected by ${rejectRoleLabel}.`,
      application: updated
    });
  } catch (error: any) {
    console.error('rejectLeaveApplication error:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

/**
 * GET /api/v1/leave/faculty-hierarchy
 */
export const getMyFacultyHierarchy = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.user.id;
    const hierarchy = await resolveFacultyStaffHierarchy(userId);
    res.json(hierarchy);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};
  } catch (error: any) {
    console.error('rejectLeaveApplication error:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

/**
 * Preview working days for requested date range
 * POST /api/v1/leave/preview-working-days
 */
export const previewWorkingDays = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({ message: 'End date must be greater than or equal to start date.' });
    }

    const holidays = await prisma.universityHoliday.findMany({
      where: {
        date: { gte: start, lte: end },
        isObserved: true
      }
    });

    const result = calculateWorkingDays(start, end, holidays);

    res.json(result);
  } catch (error: any) {
    console.error('previewWorkingDays error:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};
