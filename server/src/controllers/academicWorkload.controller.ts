import { Request, Response } from 'express';
import prisma from '../prisma';
import {
  Role,
  AllocationRole,
  AcademicSemester,
  WorkloadAllocationStatus,
  ProgrammeLevel,
  Cadre,
} from '@prisma/client';
import { AcademicWorkloadEngine } from '../services/AcademicWorkloadEngine';
import { AuditService } from '../services/audit.service';
import { notifyUser } from './notification.controller';
import { Prisma } from '@prisma/client';

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: Role;
    staffProfile?: { id: string; unitId?: string | null; centerId?: string | null };
  };
}

/**
 * 1. Get all Faculties
 * GET /api/v1/academic/faculties
 */
export const getFaculties = async (req: Request, res: Response) => {
  try {
    const faculties = await prisma.faculty.findMany({
      include: {
        dean: {
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
              },
            },
          },
        },
        departments: {
          select: {
            id: true,
            name: true,
            _count: { select: { programmes: true, courses: true } },
          },
          orderBy: { name: 'asc' },
        },
        _count: { select: { programmes: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(faculties);
  } catch (error: any) {
    console.error('Error fetching faculties:', error);
    res.status(500).json({ message: 'Error fetching faculties', error: error.message });
  }
};

/**
 * 2. Get all Departments
 * GET /api/v1/academic/departments?facultyId=...
 */
export const getDepartments = async (req: Request, res: Response) => {
  try {
    const { facultyId } = req.query;

    const whereClause: any = {};
    if (facultyId && typeof facultyId === 'string') {
      whereClause.facultyId = facultyId;
    }

    const departments = await prisma.department.findMany({
      where: whereClause,
      include: {
        faculty: { select: { id: true, facultyCode: true, name: true } },
        hod: {
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
              },
            },
          },
        },
        _count: { select: { programmes: true, courses: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(departments);
  } catch (error: any) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ message: 'Error fetching departments', error: error.message });
  }
};

/**
 * 3. Get Academic Programmes
 * GET /api/v1/academic/programmes?facultyId=...&departmentId=...&level=...&search=...
 */
export const getAcademicProgrammes = async (req: Request, res: Response) => {
  try {
    const { facultyId, departmentId, level, search } = req.query;

    const whereClause: any = { isActive: true };

    if (facultyId && typeof facultyId === 'string') {
      whereClause.facultyId = facultyId;
    }
    if (departmentId && typeof departmentId === 'string') {
      whereClause.departmentId = departmentId;
    }
    if (level && typeof level === 'string') {
      whereClause.level = level as ProgrammeLevel;
    }
    if (search && typeof search === 'string') {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { programmeCode: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } },
      ];
    }

    const programmes = await prisma.academicProgramme.findMany({
      where: whereClause,
      include: {
        faculty: { select: { id: true, name: true, facultyCode: true } },
        department: { select: { id: true, name: true } },
        _count: { select: { courses: true, staff: true } },
      },
      orderBy: [{ facultyId: 'asc' }, { departmentId: 'asc' }, { name: 'asc' }],
    });

    res.json(programmes);
  } catch (error: any) {
    console.error('Error fetching programmes:', error);
    res.status(500).json({ message: 'Error fetching academic programmes', error: error.message });
  }
};

/**
 * 4. Get Academic Courses
 * GET /api/v1/academic/courses?programmeId=...&departmentId=...&semester=...&session=...&search=...
 */
export const getAcademicCourses = async (req: Request, res: Response) => {
  try {
    const { programmeId, departmentId, semester, session, level, search } = req.query;

    const whereClause: any = {};

    if (programmeId && typeof programmeId === 'string') {
      whereClause.programmeId = programmeId;
    }
    if (departmentId && typeof departmentId === 'string') {
      whereClause.departmentId = departmentId;
    }
    if (semester && typeof semester === 'string') {
      whereClause.semester = semester as AcademicSemester;
    }
    if (session && typeof session === 'string') {
      whereClause.session = session;
    }
    if (level && typeof level === 'string') {
      whereClause.level = parseInt(level, 10);
    }
    if (search && typeof search === 'string') {
      whereClause.OR = [
        { courseCode: { contains: search, mode: 'insensitive' } },
        { courseTitle: { contains: search, mode: 'insensitive' } },
      ];
    }

    const courses = await prisma.academicCourse.findMany({
      where: whereClause,
      include: {
        programme: { select: { id: true, programmeCode: true, name: true, degreeTitle: true } },
        department: { select: { id: true, name: true } },
        allocations: {
          include: {
            academicStaff: {
              select: {
                id: true,
                staffId: true,
                surname: true,
                otherNames: true,
                rank: true,
                currentAcademicRank: true,
              },
            },
          },
        },
      },
      orderBy: [{ courseCode: 'asc' }],
    });

    res.json(courses);
  } catch (error: any) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ message: 'Error fetching academic courses', error: error.message });
  }
};

/**
 * 5. Create or Upsert Academic Course
 * POST /api/v1/academic/courses
 */
export const createOrUpdateCourse = async (req: AuthRequest, res: Response) => {
  try {
    const {
      courseCode,
      courseTitle,
      creditUnits,
      lectureHours = 2,
      tutorialHours = 1,
      practicalHours = 0,
      programmeId,
      departmentId,
      semester = 'FIRST_SEMESTER',
      session = '2026/2027',
      level = 100,
    } = req.body;

    if (!courseCode || !courseTitle || !creditUnits || !programmeId || !departmentId) {
      return res.status(400).json({
        message: 'Missing required fields: courseCode, courseTitle, creditUnits, programmeId, departmentId',
      });
    }

    const course = await prisma.academicCourse.upsert({
      where: { courseCode: courseCode.trim().toUpperCase() },
      update: {
        courseTitle: courseTitle.trim(),
        creditUnits: parseInt(creditUnits, 10),
        lectureHours: parseInt(lectureHours, 10),
        tutorialHours: parseInt(tutorialHours, 10),
        practicalHours: parseInt(practicalHours, 10),
        programmeId,
        departmentId,
        semester: semester as AcademicSemester,
        session,
        level: parseInt(level, 10),
      },
      create: {
        courseCode: courseCode.trim().toUpperCase(),
        courseTitle: courseTitle.trim(),
        creditUnits: parseInt(creditUnits, 10),
        lectureHours: parseInt(lectureHours, 10),
        tutorialHours: parseInt(tutorialHours, 10),
        practicalHours: parseInt(practicalHours, 10),
        programmeId,
        departmentId,
        semester: semester as AcademicSemester,
        session,
        level: parseInt(level, 10),
      },
    });

    res.status(201).json(course);
  } catch (error: any) {
    console.error('Error saving course:', error);
    res.status(500).json({ message: 'Error saving course', error: error.message });
  }
};

/**
 * 6. Allocate Course to Academic Staff
 * POST /api/v1/academic/workload/allocate
 */
export const allocateWorkload = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const {
      courseId,
      academicStaffId,
      academicSession = '2026/2027',
      semester = 'FIRST_SEMESTER',
      role = 'COURSE_COORDINATOR',
      assignedCreditUnits,
      enrolledStudentsCount = 0,
      contactHoursWeekly,
      courseMaterialCreditUnits = 0,
      administrativeReliefUnits = 0,
    } = req.body;

    if (!courseId || !academicStaffId) {
      return res.status(400).json({ message: 'Missing courseId or academicStaffId' });
    }

    // 1. Verify Course exists
    const course = await prisma.academicCourse.findUnique({
      where: { id: courseId },
      include: { department: true, programme: true },
    });
    if (!course) {
      return res.status(404).json({ message: 'Academic course not found' });
    }

    // 2. Verify Academic Staff exists
    const staff = await prisma.staffProfile.findUnique({
      where: { id: academicStaffId },
      include: { user: true, unit: true },
    });
    if (!staff) {
      return res.status(404).json({ message: 'Academic staff profile not found' });
    }

    const effectiveAssignedCU = assignedCreditUnits ? Number(assignedCreditUnits) : course.creditUnits;
    const effectiveStudents = parseInt(String(enrolledStudentsCount || 0), 10);
    const effectiveContactHrs = contactHoursWeekly
      ? Number(contactHoursWeekly)
      : AcademicWorkloadEngine.calculateContactHours(
          course.lectureHours,
          course.tutorialHours,
          course.practicalHours
        );
    const calculatedETE = AcademicWorkloadEngine.calculateCourseETE(effectiveAssignedCU, effectiveStudents);

    // 3. Upsert allocation to guarantee idempotency
    const allocation = await prisma.courseWorkloadAllocation.upsert({
      where: {
        courseId_academicStaffId_academicSession_semester: {
          courseId,
          academicStaffId,
          academicSession,
          semester: semester as AcademicSemester,
        },
      },
      update: {
        role: role as AllocationRole,
        assignedCreditUnits: new Prisma.Decimal(effectiveAssignedCU),
        enrolledStudentsCount: effectiveStudents,
        contactHoursWeekly: new Prisma.Decimal(effectiveContactHrs),
        courseMaterialCreditUnits: new Prisma.Decimal(Number(courseMaterialCreditUnits || 0)),
        administrativeReliefUnits: new Prisma.Decimal(Number(administrativeReliefUnits || 0)),
        effectiveTeachingEquivalent: new Prisma.Decimal(calculatedETE),
        assignedById: userId,
      },
      create: {
        courseId,
        academicStaffId,
        academicSession,
        semester: semester as AcademicSemester,
        role: role as AllocationRole,
        assignedCreditUnits: new Prisma.Decimal(effectiveAssignedCU),
        enrolledStudentsCount: effectiveStudents,
        contactHoursWeekly: new Prisma.Decimal(effectiveContactHrs),
        courseMaterialCreditUnits: new Prisma.Decimal(Number(courseMaterialCreditUnits || 0)),
        administrativeReliefUnits: new Prisma.Decimal(Number(administrativeReliefUnits || 0)),
        effectiveTeachingEquivalent: new Prisma.Decimal(calculatedETE),
        allocationStatus: WorkloadAllocationStatus.DRAFT,
        assignedById: userId,
      },
      include: {
        course: { select: { courseCode: true, courseTitle: true, creditUnits: true } },
        academicStaff: { select: { staffId: true, surname: true, otherNames: true, rank: true } },
      },
    });

    await AuditService.log(
      userId,
      AuditService.ACTIONS.CREATE,
      'ACADEMIC_WORKLOAD',
      `Allocated course ${course.courseCode} (${effectiveAssignedCU} CU) to staff ${staff.staffId} for ${academicSession} ${semester}`
    );

    res.status(201).json(allocation);
  } catch (error: any) {
    console.error('Error allocating workload:', error);
    res.status(500).json({ message: 'Error allocating workload', error: error.message });
  }
};

/**
 * 7. Delete / Revoke Workload Allocation
 * DELETE /api/v1/academic/workload/allocation/:id
 */
export const revokeWorkloadAllocation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const allocation = await prisma.courseWorkloadAllocation.findUnique({
      where: { id },
      include: { course: true, academicStaff: true },
    });

    if (!allocation) {
      return res.status(404).json({ message: 'Workload allocation not found' });
    }

    await prisma.courseWorkloadAllocation.delete({ where: { id } });

    await AuditService.log(
      userId,
      AuditService.ACTIONS.DELETE,
      'ACADEMIC_WORKLOAD',
      `Revoked course ${allocation.course.courseCode} allocation from staff ${allocation.academicStaff.staffId}`
    );

    res.json({ message: 'Allocation revoked successfully', id });
  } catch (error: any) {
    console.error('Error revoking allocation:', error);
    res.status(500).json({ message: 'Error revoking allocation', error: error.message });
  }
};

/**
 * 8. Get Staff Workload Dossier
 * GET /api/v1/academic/workload/staff/:staffProfileId?session=...&semester=...
 */
export const getStaffWorkloadDossier = async (req: AuthRequest, res: Response) => {
  try {
    const { staffProfileId } = req.params;
    const session = (req.query.session as string) || '2026/2027';
    const semester = (req.query.semester as string) || 'FIRST_SEMESTER';

    const staff = await prisma.staffProfile.findUnique({
      where: { id: staffProfileId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        unit: true,
        studyCenter: true,
      },
    });

    if (!staff) {
      return res.status(404).json({ message: 'Staff profile not found' });
    }

    const allocations = await prisma.courseWorkloadAllocation.findMany({
      where: {
        academicStaffId: staffProfileId,
        academicSession: session,
        semester: semester as AcademicSemester,
      },
      include: {
        course: {
          include: {
            programme: true,
            department: { include: { faculty: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const summary = AcademicWorkloadEngine.evaluateStaffWorkload({
      staffProfileId: staff.id,
      staffName: `${staff.surname || ''} ${staff.otherNames || ''}`.trim() || staff.user.name || 'Academic Staff',
      staffId: staff.staffId || 'N/A',
      academicRank: staff.currentAcademicRank || staff.rank,
      departmentId: staff.unitId || undefined,
      departmentName: staff.unit?.name || undefined,
      session,
      semester,
      allocations: allocations.map((a) => ({
        courseId: a.courseId,
        courseCode: a.course.courseCode,
        courseTitle: a.course.courseTitle,
        creditUnits: a.course.creditUnits,
        assignedCreditUnits: a.assignedCreditUnits ? Number(a.assignedCreditUnits) : a.course.creditUnits,
        enrolledStudentsCount: a.enrolledStudentsCount,
        lectureHours: a.course.lectureHours,
        tutorialHours: a.course.tutorialHours,
        practicalHours: a.course.practicalHours,
        role: a.role,
        courseMaterialCreditUnits: a.courseMaterialCreditUnits ? Number(a.courseMaterialCreditUnits) : 0,
        administrativeReliefUnits: a.administrativeReliefUnits ? Number(a.administrativeReliefUnits) : 0,
        allocationStatus: a.allocationStatus,
        session: a.academicSession,
        semester: a.semester,
      })),
    });

    res.json(summary);
  } catch (error: any) {
    console.error('Error fetching staff workload dossier:', error);
    res.status(500).json({ message: 'Error fetching staff workload dossier', error: error.message });
  }
};

/**
 * 9. Get Departmental Workload Matrix
 * GET /api/v1/academic/workload/department/:departmentId?session=...&semester=...
 */
export const getDepartmentalWorkloadMatrix = async (req: AuthRequest, res: Response) => {
  try {
    const { departmentId } = req.params;
    const session = (req.query.session as string) || '2026/2027';
    const semester = (req.query.semester as string) || 'FIRST_SEMESTER';

    // 1. Fetch Department Details
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        faculty: true,
        hod: {
          select: {
            id: true,
            name: true,
            email: true,
            staffProfile: { select: { id: true, surname: true, otherNames: true, staffId: true } },
          },
        },
        programmes: true,
        courses: { where: { semester: semester as AcademicSemester } },
      },
    });

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // 2. Fetch all academic staff in this department/faculty or with allocations
    const staffProfiles = await prisma.staffProfile.findMany({
      where: {
        cadre: Cadre.ACADEMIC,
        status: 'ACTIVE',
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        unit: true,
        courseAllocations: {
          where: {
            academicSession: session,
            semester: semester as AcademicSemester,
            course: { departmentId },
          },
          include: {
            course: {
              include: { programme: true },
            },
          },
        },
      },
      orderBy: [{ surname: 'asc' }, { otherNames: 'asc' }],
    });

    // 3. Compute summaries for each staff
    const staffSummaries = staffProfiles.map((staff) => {
      const summary = AcademicWorkloadEngine.evaluateStaffWorkload({
        staffProfileId: staff.id,
        staffName: `${staff.surname || ''} ${staff.otherNames || ''}`.trim() || staff.user.name || 'Academic Staff',
        staffId: staff.staffId || 'N/A',
        academicRank: staff.currentAcademicRank || staff.rank,
        departmentId: department.id,
        departmentName: department.name,
        facultyId: department.facultyId,
        facultyName: department.faculty.name,
        session,
        semester,
        allocations: staff.courseAllocations.map((a) => ({
          courseId: a.courseId,
          courseCode: a.course.courseCode,
          courseTitle: a.course.courseTitle,
          creditUnits: a.course.creditUnits,
          assignedCreditUnits: a.assignedCreditUnits ? Number(a.assignedCreditUnits) : a.course.creditUnits,
          enrolledStudentsCount: a.enrolledStudentsCount,
          lectureHours: a.course.lectureHours,
          tutorialHours: a.course.tutorialHours,
          practicalHours: a.course.practicalHours,
          role: a.role,
          courseMaterialCreditUnits: a.courseMaterialCreditUnits ? Number(a.courseMaterialCreditUnits) : 0,
          administrativeReliefUnits: a.administrativeReliefUnits ? Number(a.administrativeReliefUnits) : 0,
          allocationStatus: a.allocationStatus,
          session: a.academicSession,
          semester: a.semester,
        })),
      });

      return summary;
    });

    // Filter to staff who have allocations or belong to department
    const relevantStaff = staffSummaries.filter((s) => s.allocations.length > 0 || staffProfiles.length <= 15);

    // Docket status calculation across allocations
    const allAllocations = staffProfiles.flatMap((s) => s.courseAllocations);
    let overallDocketStatus: WorkloadAllocationStatus = WorkloadAllocationStatus.DRAFT;

    if (allAllocations.length > 0) {
      if (allAllocations.every((a) => a.allocationStatus === WorkloadAllocationStatus.RATIFIED_ACADEMIC_PLANNING)) {
        overallDocketStatus = WorkloadAllocationStatus.RATIFIED_ACADEMIC_PLANNING;
      } else if (allAllocations.every((a) => a.allocationStatus === WorkloadAllocationStatus.APPROVED_BY_DEAN || a.allocationStatus === WorkloadAllocationStatus.RATIFIED_ACADEMIC_PLANNING)) {
        overallDocketStatus = WorkloadAllocationStatus.APPROVED_BY_DEAN;
      } else if (allAllocations.some((a) => a.allocationStatus === WorkloadAllocationStatus.SUBMITTED_BY_HOD)) {
        overallDocketStatus = WorkloadAllocationStatus.SUBMITTED_BY_HOD;
      }
    }

    const totalOverloadCount = relevantStaff.filter((s) => s.complianceStatus === 'WORKLOAD_OVERLOAD_WARNING').length;
    const totalUnderallocatedCount = relevantStaff.filter((s) => s.complianceStatus === 'UNDER_ALLOCATED').length;
    const totalCompliantCount = relevantStaff.filter((s) => s.complianceStatus === 'NORMAL_LOAD').length;

    res.json({
      department: {
        id: department.id,
        name: department.name,
        faculty: department.faculty,
        hod: department.hod,
        programmesCount: department.programmes.length,
        coursesCount: department.courses.length,
      },
      session,
      semester,
      overallDocketStatus,
      statistics: {
        totalStaff: relevantStaff.length,
        totalAllocations: allAllocations.length,
        totalOverloadCount,
        totalUnderallocatedCount,
        totalCompliantCount,
        complianceRate: relevantStaff.length > 0 ? Number(((totalCompliantCount / relevantStaff.length) * 100).toFixed(1)) : 100,
      },
      staffMatrix: relevantStaff,
    });
  } catch (error: any) {
    console.error('Error fetching departmental workload matrix:', error);
    res.status(500).json({ message: 'Error fetching departmental matrix', error: error.message });
  }
};

/**
 * 10. HOD Submits Departmental Workload Docket to Dean
 * PUT /api/v1/academic/workload/dockets/:departmentId/submit
 */
export const submitDepartmentalDocket = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { departmentId } = req.params;
    const { session = '2026/2027', semester = 'FIRST_SEMESTER', remarks } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    // Update all DRAFT allocations in this department to SUBMITTED_BY_HOD
    const updated = await prisma.courseWorkloadAllocation.updateMany({
      where: {
        academicSession: session,
        semester: semester as AcademicSemester,
        course: { departmentId },
        allocationStatus: WorkloadAllocationStatus.DRAFT,
      },
      data: {
        allocationStatus: WorkloadAllocationStatus.SUBMITTED_BY_HOD,
        approvalRemarks: remarks || null,
      },
    });

    await AuditService.log(
      userId,
      AuditService.ACTIONS.UPDATE,
      'ACADEMIC_WORKLOAD_DOCKET',
      `HOD submitted workload docket for department ${departmentId} (${updated.count} allocations submitted for Dean authorization)`
    );

    res.json({
      message: 'Departmental workload docket submitted to Dean successfully',
      updatedAllocationsCount: updated.count,
      status: WorkloadAllocationStatus.SUBMITTED_BY_HOD,
    });
  } catch (error: any) {
    console.error('Error submitting departmental docket:', error);
    res.status(500).json({ message: 'Error submitting docket', error: error.message });
  }
};

/**
 * 11. Dean Authorizes Departmental Docket
 * PUT /api/v1/academic/workload/dockets/:departmentId/dean-approval
 */
export const authorizeDepartmentalDocket = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { departmentId } = req.params;
    const { session = '2026/2027', semester = 'FIRST_SEMESTER', remarks, action = 'APPROVE' } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const targetStatus =
      action === 'REJECT' || action === 'RETURN'
        ? WorkloadAllocationStatus.DRAFT
        : WorkloadAllocationStatus.APPROVED_BY_DEAN;

    const updated = await prisma.courseWorkloadAllocation.updateMany({
      where: {
        academicSession: session,
        semester: semester as AcademicSemester,
        course: { departmentId },
        allocationStatus: WorkloadAllocationStatus.SUBMITTED_BY_HOD,
      },
      data: {
        allocationStatus: targetStatus,
        approvedById: userId,
        approvalRemarks: remarks || (targetStatus === WorkloadAllocationStatus.APPROVED_BY_DEAN ? 'Approved by Dean' : 'Returned to HOD for revision'),
      },
    });

    await AuditService.log(
      userId,
      AuditService.ACTIONS.UPDATE,
      'ACADEMIC_WORKLOAD_DOCKET',
      `Dean acted on departmental docket ${departmentId}: ${targetStatus} (${updated.count} allocations)`
    );

    res.json({
      message: `Departmental workload docket ${targetStatus === WorkloadAllocationStatus.APPROVED_BY_DEAN ? 'authorized' : 'returned to HOD'} successfully`,
      updatedAllocationsCount: updated.count,
      status: targetStatus,
    });
  } catch (error: any) {
    console.error('Error authorizing docket:', error);
    res.status(500).json({ message: 'Error authorizing docket', error: error.message });
  }
};

/**
 * 12. Director of Academic Planning Ratifies Docket
 * PUT /api/v1/academic/workload/dockets/:departmentId/ratify
 */
export const ratifyDepartmentalDocket = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { departmentId } = req.params;
    const { session = '2026/2027', semester = 'FIRST_SEMESTER', remarks } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const updated = await prisma.courseWorkloadAllocation.updateMany({
      where: {
        academicSession: session,
        semester: semester as AcademicSemester,
        course: { departmentId },
        allocationStatus: WorkloadAllocationStatus.APPROVED_BY_DEAN,
      },
      data: {
        allocationStatus: WorkloadAllocationStatus.RATIFIED_ACADEMIC_PLANNING,
        ratifiedById: userId,
        approvalRemarks: remarks || 'Ratified by Directorate of Academic Planning (DAP)',
      },
    });

    await AuditService.log(
      userId,
      AuditService.ACTIONS.UPDATE,
      'ACADEMIC_WORKLOAD_DOCKET',
      `Academic Planning Director ratified docket for department ${departmentId} (${updated.count} allocations)`
    );

    res.json({
      message: 'Departmental workload docket ratified by Academic Planning successfully',
      updatedAllocationsCount: updated.count,
      status: WorkloadAllocationStatus.RATIFIED_ACADEMIC_PLANNING,
    });
  } catch (error: any) {
    console.error('Error ratifying docket:', error);
    res.status(500).json({ message: 'Error ratifying docket', error: error.message });
  }
};

/**
 * 13. Export NUC Accreditation & Workload Compliance Audit Report
 * GET /api/v1/academic/workload/export-audit?session=...&semester=...&format=json|csv
 */
export const exportWorkloadAuditReport = async (req: Request, res: Response) => {
  try {
    const session = (req.query.session as string) || '2026/2027';
    const semester = (req.query.semester as string) || 'FIRST_SEMESTER';
    const format = (req.query.format as string) || 'json';

    const faculties = await prisma.faculty.findMany({
      include: {
        departments: {
          include: {
            programmes: true,
            courses: {
              where: { semester: semester as AcademicSemester },
              include: {
                allocations: {
                  where: { academicSession: session, semester: semester as AcademicSemester },
                  include: {
                    academicStaff: {
                      select: {
                        id: true,
                        staffId: true,
                        surname: true,
                        otherNames: true,
                        title: true,
                        rank: true,
                        currentAcademicRank: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const reportRows: any[] = [];

    faculties.forEach((fac) => {
      fac.departments.forEach((dept) => {
        dept.courses.forEach((course) => {
          if (course.allocations.length === 0) {
            reportRows.push({
              faculty: fac.name,
              facultyCode: fac.facultyCode,
              department: dept.name,
              courseCode: course.courseCode,
              courseTitle: course.courseTitle,
              creditUnits: course.creditUnits,
              staffId: 'UNALLOCATED',
              staffName: 'Unallocated Course',
              academicRank: 'N/A',
              role: 'NONE',
              enrolledStudents: 0,
              contactHoursWeekly: AcademicWorkloadEngine.calculateContactHours(course.lectureHours, course.tutorialHours, course.practicalHours),
              effectiveTeachingEquivalent: 0,
              allocationStatus: 'UNALLOCATED',
              compliance: 'DEFICIT',
            });
          } else {
            course.allocations.forEach((alloc) => {
              const staffRank = alloc.academicStaff.currentAcademicRank || alloc.academicStaff.rank || 'Lecturer II';
              const ete = AcademicWorkloadEngine.calculateCourseETE(Number(alloc.assignedCreditUnits || course.creditUnits), alloc.enrolledStudentsCount);
              const contactHrs = Number(alloc.contactHoursWeekly) || AcademicWorkloadEngine.calculateContactHours(course.lectureHours, course.tutorialHours, course.practicalHours);

              reportRows.push({
                faculty: fac.name,
                facultyCode: fac.facultyCode,
                department: dept.name,
                courseCode: course.courseCode,
                courseTitle: course.courseTitle,
                creditUnits: course.creditUnits,
                assignedCreditUnits: Number(alloc.assignedCreditUnits),
                staffId: alloc.academicStaff.staffId || 'N/A',
                staffName: `${alloc.academicStaff.title || ''} ${alloc.academicStaff.surname || ''} ${alloc.academicStaff.otherNames || ''}`.trim(),
                academicRank: staffRank,
                role: alloc.role,
                enrolledStudents: alloc.enrolledStudentsCount,
                contactHoursWeekly: contactHrs,
                effectiveTeachingEquivalent: ete,
                allocationStatus: alloc.allocationStatus,
                compliance: 'NUC_COMPLIANT',
              });
            });
          }
        });
      });
    });

    if (format === 'csv') {
      const headers = [
        'Faculty',
        'Faculty Code',
        'Department',
        'Course Code',
        'Course Title',
        'Credit Units',
        'Assigned Credit Units',
        'Staff ID',
        'Staff Name',
        'Academic Rank',
        'Role',
        'Enrolled Students',
        'Weekly Contact Hours',
        'Effective Teaching Equivalent (ETE)',
        'Allocation Status',
        'Compliance Status',
      ];

      const csvLines = [headers.join(',')];
      reportRows.forEach((r) => {
        const line = [
          `"${r.faculty}"`,
          `"${r.facultyCode}"`,
          `"${r.department}"`,
          `"${r.courseCode}"`,
          `"${r.courseTitle.replace(/"/g, '""')}"`,
          r.creditUnits,
          r.assignedCreditUnits || r.creditUnits,
          `"${r.staffId}"`,
          `"${r.staffName}"`,
          `"${r.academicRank}"`,
          `"${r.role}"`,
          r.enrolledStudents,
          r.contactHoursWeekly,
          r.effectiveTeachingEquivalent,
          `"${r.allocationStatus}"`,
          `"${r.compliance}"`,
        ];
        csvLines.push(line.join(','));
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=NUC_Academic_Workload_Audit_${session}_${semester}.csv`);
      return res.send(csvLines.join('\n'));
    }

    res.json({
      institution: 'National Open University of Nigeria (NOUN)',
      reportTitle: 'NUC Teaching Workload Allocation & Accreditation Compliance Audit',
      session,
      semester,
      generatedAt: new Date().toISOString(),
      totalRecords: reportRows.length,
      data: reportRows,
    });
  } catch (error: any) {
    console.error('Error exporting audit report:', error);
    res.status(500).json({ message: 'Error exporting audit report', error: error.message });
  }
};

/**
 * 15. Get Complete Faculty Hierarchy
 * GET /api/v1/academic/faculties/hierarchy
 * Returns full tree: Deans, Faculty Officers, Faculty Secretaries, Departments, HODs, Exam Officers, Department Admins, Lecturers
 */
export const getFacultyHierarchy = async (req: Request, res: Response) => {
  try {
    const { facultyId } = req.query;
    const whereClause: any = {};
    if (facultyId && typeof facultyId === 'string') {
      whereClause.id = facultyId;
    }

    const faculties = await prisma.faculty.findMany({
      where: whereClause,
      include: {
        dean: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            staffProfile: {
              select: { id: true, staffId: true, surname: true, otherNames: true, title: true, rank: true, phone: true }
            }
          }
        },
        facultyOfficer: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            staffProfile: {
              select: { id: true, staffId: true, surname: true, otherNames: true, title: true, rank: true, phone: true }
            }
          }
        },
        facultySecretary: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            staffProfile: {
              select: { id: true, staffId: true, surname: true, otherNames: true, title: true, rank: true, phone: true }
            }
          }
        },
        departments: {
          include: {
            hod: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                staffProfile: {
                  select: { id: true, staffId: true, surname: true, otherNames: true, title: true, rank: true, phone: true }
                }
              }
            },
            examOfficer: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                staffProfile: {
                  select: { id: true, staffId: true, surname: true, otherNames: true, title: true, rank: true, phone: true }
                }
              }
            },
            departmentAdmin: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                staffProfile: {
                  select: { id: true, staffId: true, surname: true, otherNames: true, title: true, rank: true, phone: true }
                }
              }
            },
            programmes: {
              select: { id: true, name: true, code: true }
            },
            courses: {
              include: {
                programme: { select: { id: true, name: true, code: true } },
                allocations: {
                  include: {
                    academicStaff: {
                      select: {
                        id: true,
                        staffId: true,
                        surname: true,
                        otherNames: true,
                        title: true,
                        rank: true,
                        currentAcademicRank: true,
                        user: { select: { id: true, name: true, email: true } }
                      }
                    }
                  }
                }
              },
              orderBy: { courseCode: 'asc' }
            },
            _count: {
              select: { programmes: true, courses: true, complaints: true }
            }
          },
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Also fetch lecturers for each department with course allocations summary
    const enriched = await Promise.all(
      faculties.map(async (fac: any) => {
        const departmentsWithLecturers = await Promise.all(
          fac.departments.map(async (dept: any) => {
            const deptCode = dept.code || dept.id;
            const unit = await prisma.unit.findFirst({
              where: {
                OR: [
                  { code: deptCode },
                  { name: { contains: dept.name, mode: 'insensitive' } },
                  { id: dept.id }
                ]
              }
            });

            let lecturers: any[] = [];
            if (unit) {
              const staffProfiles = await prisma.staffProfile.findMany({
                where: {
                  unitId: unit.id,
                  cadre: 'ACADEMIC',
                  isDeleted: false,
                  user: { isActive: true }
                },
                select: {
                  id: true,
                  userId: true,
                  staffId: true,
                  surname: true,
                  otherNames: true,
                  title: true,
                  rank: true,
                  currentAcademicRank: true,
                  courseAllocations: {
                    select: {
                      id: true,
                      courseId: true,
                      assignedCreditUnits: true,
                      role: true,
                      allocationStatus: true,
                      enrolledStudentsCount: true,
                      course: {
                        select: {
                          courseCode: true,
                          courseTitle: true,
                          creditUnits: true
                        }
                      }
                    }
                  },
                  user: { select: { id: true, name: true, email: true, role: true } }
                },
                orderBy: { surname: 'asc' }
              });

              lecturers = staffProfiles.map(s => {
                const totalAllocatedCredits = s.courseAllocations.reduce((acc, a) => acc + (Number(a.assignedCreditUnits) || a.course?.creditUnits || 0), 0);
                return {
                  ...s,
                  totalAllocatedCredits,
                  allocationsCount: s.courseAllocations.length,
                };
              });
            }

            return {
              ...dept,
              lecturersCount: lecturers.length,
              lecturers
            };
          })
        );

        return {
          ...fac,
          departments: departmentsWithLecturers
        };
      })
    );

    res.json(enriched);
  } catch (error: any) {
    console.error('Error fetching faculty hierarchy:', error);
    res.status(500).json({ message: 'Failed to fetch faculty hierarchy', error: error.message });
  }
};

/**
 * 16. Update Faculty Officers (Dean, Faculty Officer, Secretary)
 * PUT /api/v1/academic/faculties/:id/officers
 */
export const updateFacultyOfficers = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { deanId, facultyOfficerId, facultySecretaryId } = req.body;
    const callerId = req.user?.id;
    const callerRole = req.user?.role;

    if (![Role.SUPER_USER, Role.VICE_CHANCELLOR, Role.REGISTRAR, Role.HR_ADMIN, Role.ADMIN].includes(callerRole as any)) {
      return res.status(403).json({ message: 'Only Principal Officers and HR Admins can appoint Faculty Officers.' });
    }

    const faculty = await prisma.faculty.findUnique({ where: { id } });
    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    const updated = await prisma.faculty.update({
      where: { id },
      data: {
        ...(deanId !== undefined ? { deanId: deanId || null } : {}),
        ...(facultyOfficerId !== undefined ? { facultyOfficerId: facultyOfficerId || null } : {}),
        ...(facultySecretaryId !== undefined ? { facultySecretaryId: facultySecretaryId || null } : {})
      },
      include: {
        dean: { select: { id: true, name: true, email: true } },
        facultyOfficer: { select: { id: true, name: true, email: true } },
        facultySecretary: { select: { id: true, name: true, email: true } }
      }
    });

    // Notify newly appointed officers
    if (deanId) {
      await notifyUser(deanId, '🏛️ Appointed as Faculty Dean', `You have been officially designated as Dean of ${faculty.name}.`, 'SUCCESS', '/dashboard/faculty/workload/review').catch(() => {});
    }
    if (facultyOfficerId) {
      await notifyUser(facultyOfficerId, '📋 Appointed as Faculty Officer', `You have been designated as the Faculty Officer (Head of Administration) for ${faculty.name}.`, 'INFO', '/dashboard/academic/workload').catch(() => {});
    }
    if (facultySecretaryId) {
      await notifyUser(facultySecretaryId, '📝 Appointed as Faculty Secretary', `You have been designated as the Faculty Secretary for ${faculty.name}.`, 'INFO', '/dashboard/academic/workload').catch(() => {});
    }

    await AuditService.log(
      callerId || 'SYSTEM',
      'UPDATE_FACULTY_OFFICERS',
      `Faculty:${id}`,
      JSON.stringify({ deanId, facultyOfficerId, facultySecretaryId, facultyName: faculty.name })
    );

    res.json({ message: 'Faculty officers updated successfully', faculty: updated });
  } catch (error: any) {
    console.error('Error updating faculty officers:', error);
    res.status(500).json({ message: 'Failed to update faculty officers', error: error.message });
  }
};

/**
 * 17. Update Department Officers (HOD, Exam Officer, Department Admin)
 * PUT /api/v1/academic/departments/:id/officers
 */
export const updateDepartmentOfficers = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { hodId, examOfficerId, departmentAdminId } = req.body;
    const callerId = req.user?.id;
    const callerRole = req.user?.role;

    const department = await prisma.department.findUnique({
      where: { id },
      include: { faculty: true }
    });
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const isDeanOfFaculty = department.faculty.deanId === callerId;
    const isExecutive = [Role.SUPER_USER, Role.VICE_CHANCELLOR, Role.REGISTRAR, Role.HR_ADMIN, Role.ADMIN].includes(callerRole as any);

    if (!isDeanOfFaculty && !isExecutive) {
      return res.status(403).json({ message: 'Unauthorized: Only the Dean of this Faculty or University Executives can configure Department Officers.' });
    }

    const updated = await prisma.department.update({
      where: { id },
      data: {
        ...(hodId !== undefined ? { hodId: hodId || null } : {}),
        ...(examOfficerId !== undefined ? { examOfficerId: examOfficerId || null } : {}),
        ...(departmentAdminId !== undefined ? { departmentAdminId: departmentAdminId || null } : {})
      },
      include: {
        hod: { select: { id: true, name: true, email: true } },
        examOfficer: { select: { id: true, name: true, email: true } },
        departmentAdmin: { select: { id: true, name: true, email: true } }
      }
    });

    // Notify newly appointed officers
    if (hodId) {
      await notifyUser(hodId, '🎓 Appointed as Head of Department (HOD)', `You have been designated as HOD of ${department.name}. You lead course allocations and departmental academic administration.`, 'SUCCESS', '/dashboard/academic/workload/allocation').catch(() => {});
    }
    if (examOfficerId) {
      await notifyUser(examOfficerId, '📑 Appointed as Examination Officer', `You have been designated as Departmental Examination Officer for ${department.name}.`, 'INFO', '/dashboard/academic/workload').catch(() => {});
    }
    if (departmentAdminId) {
      await notifyUser(departmentAdminId, '📂 Appointed as Departmental Administrative Officer', `You have been designated as Departmental Administrative Officer/Secretary for ${department.name}.`, 'INFO', '/dashboard/academic/workload').catch(() => {});
    }

    await AuditService.log(
      callerId || 'SYSTEM',
      'UPDATE_DEPARTMENT_OFFICERS',
      `Department:${id}`,
      JSON.stringify({ hodId, examOfficerId, departmentAdminId, departmentName: department.name })
    );

    res.json({ message: 'Department officers updated successfully', department: updated });
  } catch (error: any) {
    console.error('Error updating department officers:', error);
    res.status(500).json({ message: 'Failed to update department officers', error: error.message });
  }
};

/**
 * 18. Submit Course Allocation Complaint (Lecturer to HOD)
 * POST /api/v1/academic/workload/complaints
 */
export const submitWorkloadComplaint = async (req: AuthRequest, res: Response) => {
  try {
    const callerId = req.user?.id;
    if (!callerId) return res.status(401).json({ message: 'Unauthorized' });

    const {
      departmentId,
      allocationId,
      courseId,
      session,
      semester = AcademicSemester.FIRST_SEMESTER,
      complaintType = 'COURSE_MISMATCH',
      subject,
      details,
      suggestedAdjustment
    } = req.body;

    if (!departmentId || !subject || !details) {
      return res.status(400).json({ message: 'Department, subject, and complaint details are required.' });
    }

    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: { hod: true, faculty: true }
    });

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const complaint = await prisma.workloadComplaint.create({
      data: {
        staffId: callerId,
        departmentId,
        allocationId: allocationId || null,
        courseId: courseId || null,
        session: session || '2026/2027',
        semester: (semester as AcademicSemester) || AcademicSemester.FIRST_SEMESTER,
        complaintType: complaintType || 'COURSE_MISMATCH',
        subject,
        details,
        suggestedAdjustment: suggestedAdjustment || null,
        status: 'PENDING_HOD_REVIEW'
      },
      include: {
        staff: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, courseCode: true, courseTitle: true } },
        department: { select: { id: true, name: true } }
      }
    });

    // Notify HOD of the department
    if (department.hodId) {
      await notifyUser(
        department.hodId,
        '⚠️ Lecturer Course Allocation Complaint Lodged',
        `An academic staff member lodged a course allocation complaint: "${subject}". Please review the allocation at your HOD desk.`,
        'WARNING',
        '/dashboard/academic/workload/allocation'
      ).catch(() => {});
    }

    await AuditService.log(
      callerId,
      'SUBMIT_WORKLOAD_COMPLAINT',
      `WorkloadComplaint:${complaint.id}`,
      JSON.stringify({ departmentId, subject, complaintType, session, semester })
    );

    res.status(201).json({
      message: 'Course allocation complaint submitted successfully to HOD.',
      complaint
    });
  } catch (error: any) {
    console.error('Error submitting workload complaint:', error);
    res.status(500).json({ message: 'Failed to submit workload complaint', error: error.message });
  }
};

/**
 * 19. Get Workload Complaints
 * GET /api/v1/academic/workload/complaints
 */
export const getWorkloadComplaints = async (req: AuthRequest, res: Response) => {
  try {
    const callerId = req.user?.id;
    const callerRole = req.user?.role;
    const { departmentId, facultyId, status, session, semester } = req.query;

    let whereClause: any = {};

    if (status && typeof status === 'string') {
      whereClause.status = status;
    }
    if (session && typeof session === 'string') {
      whereClause.session = session;
    }
    if (semester && typeof semester === 'string') {
      whereClause.semester = semester;
    }

    const isExecutive = [Role.SUPER_USER, Role.VICE_CHANCELLOR, Role.REGISTRAR, Role.HR_ADMIN, Role.ADMIN].includes(callerRole as any);

    if (!isExecutive) {
      const headedDepts = await prisma.department.findMany({
        where: { hodId: callerId },
        select: { id: true }
      });
      const headedFaculties = await prisma.faculty.findMany({
        where: { deanId: callerId },
        include: { departments: { select: { id: true } } }
      });

      const hodDeptIds = headedDepts.map(d => d.id);
      const deanDeptIds = headedFaculties.flatMap(f => f.departments.map(d => d.id));
      const managedDeptIds = Array.from(new Set([...hodDeptIds, ...deanDeptIds]));

      if (managedDeptIds.length > 0) {
        whereClause.OR = [
          { departmentId: { in: managedDeptIds } },
          { staffId: callerId }
        ];
      } else {
        whereClause.staffId = callerId;
      }
    } else {
      if (departmentId && typeof departmentId === 'string') {
        whereClause.departmentId = departmentId;
      } else if (facultyId && typeof facultyId === 'string') {
        const facDepts = await prisma.department.findMany({
          where: { facultyId },
          select: { id: true }
        });
        whereClause.departmentId = { in: facDepts.map(d => d.id) };
      }
    }

    const complaints = await prisma.workloadComplaint.findMany({
      where: whereClause,
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true,
            staffProfile: {
              select: { id: true, staffId: true, surname: true, otherNames: true, title: true, rank: true, currentAcademicRank: true }
            }
          }
        },
        department: { select: { id: true, name: true, code: true, faculty: { select: { id: true, name: true } } } },
        course: { select: { id: true, courseCode: true, courseTitle: true, creditUnits: true } },
        allocation: true,
        resolvedBy: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(complaints);
  } catch (error: any) {
    console.error('Error fetching workload complaints:', error);
    res.status(500).json({ message: 'Failed to fetch workload complaints', error: error.message });
  }
};

/**
 * 20. Review Course Allocation Complaint (HOD or Dean)
 * PUT /api/v1/academic/workload/complaints/:id/review
 */
export const reviewWorkloadComplaint = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { decision, hodRemarks } = req.body;
    const callerId = req.user?.id;
    const callerRole = req.user?.role;

    if (!callerId) return res.status(401).json({ message: 'Unauthorized' });

    const complaint = await prisma.workloadComplaint.findUnique({
      where: { id },
      include: {
        department: { include: { faculty: true } },
        staff: true,
        course: true
      }
    });

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint record not found' });
    }

    const isDeptHod = complaint.department.hodId === callerId;
    const isFacultyDean = complaint.department.faculty.deanId === callerId;
    const isExecutive = [Role.SUPER_USER, Role.VICE_CHANCELLOR, Role.REGISTRAR, Role.HR_ADMIN, Role.ADMIN].includes(callerRole as any);

    if (!isDeptHod && !isFacultyDean && !isExecutive) {
      return res.status(403).json({ message: 'Unauthorized: Only the Head of Department (HOD) or Dean can review course allocation complaints.' });
    }

    const validStatuses = ['RESOLVED_ADJUSTED', 'REJECTED_MAINTAINED', 'UNDER_REVIEW'];
    const finalStatus = validStatuses.includes(decision) ? decision : 'RESOLVED_ADJUSTED';

    const updated = await prisma.workloadComplaint.update({
      where: { id },
      data: {
        status: finalStatus as any,
        hodRemarks: hodRemarks || 'Reviewed by HOD',
        resolvedById: callerId,
        resolvedAt: new Date()
      },
      include: {
        staff: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
        course: { select: { id: true, courseCode: true, courseTitle: true } },
        resolvedBy: { select: { id: true, name: true } }
      }
    });

    // Notify lecturer of decision
    const statusText = finalStatus === 'RESOLVED_ADJUSTED'
      ? '✅ Course Allocation Adjusted & Resolved'
      : finalStatus === 'REJECTED_MAINTAINED'
      ? '📋 Course Allocation Maintained after Review'
      : '⏳ Course Allocation Complaint Placed Under Review';

    await notifyUser(
      complaint.staffId,
      statusText,
      `Your course allocation complaint for "${complaint.subject}" has been reviewed. Remarks: ${hodRemarks || 'Please check your workload on your portal.'}`,
      finalStatus === 'RESOLVED_ADJUSTED' ? 'SUCCESS' : 'INFO',
      '/dashboard/portal/my-teaching-workload'
    ).catch(() => {});

    await AuditService.log(
      callerId,
      'REVIEW_WORKLOAD_COMPLAINT',
      `WorkloadComplaint:${id}`,
      JSON.stringify({ decision: finalStatus, hodRemarks, staffId: complaint.staffId })
    );

    res.json({
      message: 'Workload complaint reviewed successfully',
      complaint: updated
    });
  } catch (error: any) {
    console.error('Error reviewing workload complaint:', error);
    res.status(500).json({ message: 'Failed to review workload complaint', error: error.message });
  }
};

