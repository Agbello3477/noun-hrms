import prisma from '../prisma';
import { Role } from '@prisma/client';

export interface FacultyHierarchyResolution {
  isFacultyStaff: boolean;
  isCallerHod: boolean;
  isCallerDean: boolean;
  department: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
  faculty: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
  hod: {
    id: string;
    name: string;
    email: string | null;
    title?: string | null;
    rank?: string | null;
  } | null;
  dean: {
    id: string;
    name: string;
    email: string | null;
    title?: string | null;
    rank?: string | null;
  } | null;
}

const FACULTY_DEPT_MAPPING: Record<string, string> = {
  'DEP-CS': 'FAC-SCIEN',
  'DEP-MTH': 'FAC-SCIEN',
  'DEP-LAW': 'FAC-LAW',
  'DEP-POL': 'FAC-SOCIA',
  'DEP-ECO': 'FAC-SOCIA',
  'DEP-SOC': 'FAC-SOCIA',
  'DEP-ACC': 'FAC-MANAG',
  'DEP-BUS': 'FAC-MANAG',
  'DEP-PAD': 'FAC-MANAG',
  'DEP-EDT': 'FAC-EDUCA',
  'DEP-EDU': 'FAC-EDUCA',
  'DEP-PBH': 'FAC-HEALT',
  'DEP-NUR': 'FAC-HEALT',
  'DEP-AGR': 'FAC-AGRIC',
  'DEP-ART': 'FAC-ARTS',
  'DEP-ENG': 'FAC-ARTS',
  'DEP-HIS': 'FAC-ARTS',
  'DEP-CMP': 'FAC-COMPU'
};

const FACULTY_CODES_TO_IDS: Record<string, string> = {
  'FAC-SCIEN': 'sci',
  'FAC-COMPU': 'cmp',
  'FAC-LAW': 'law',
  'FAC-SOCIA': 'ssc',
  'FAC-MANAG': 'msc',
  'FAC-EDUCA': 'edu',
  'FAC-HEALT': 'hsc',
  'FAC-AGRIC': 'agr',
  'FAC-ARTS': 'art'
};

/**
 * Resolves whether a staff member belongs to a Faculty (academic or non-academic)
 * and resolves their exact Department, HOD, Faculty, and Dean.
 */
export async function resolveFacultyStaffHierarchy(
  staffProfileIdOrUserId: string
): Promise<FacultyHierarchyResolution> {
  const result: FacultyHierarchyResolution = {
    isFacultyStaff: false,
    isCallerHod: false,
    isCallerDean: false,
    department: null,
    faculty: null,
    hod: null,
    dean: null
  };

  const staff = await prisma.staffProfile.findFirst({
    where: {
      OR: [
        { id: staffProfileIdOrUserId },
        { userId: staffProfileIdOrUserId }
      ]
    },
    include: {
      user: true,
      unit: true,
      studyCenter: true,
      programme: {
        include: {
          department: {
            include: {
              faculty: { include: { dean: true } },
              hod: true
            }
          },
          faculty: { include: { dean: true } }
        }
      }
    }
  });

  if (!staff) {
    return result;
  }

  const staffUserId = staff.userId;
  const unit = staff.unit;

  let resolvedDeptId: string | null = null;
  let resolvedDeptName: string | null = null;
  let resolvedDeptCode: string | null = null;
  let resolvedHodUser: any = null;

  let resolvedFacultyId: string | null = null;
  let resolvedFacultyName: string | null = null;
  let resolvedFacultyCode: string | null = null;
  let resolvedDeanUser: any = null;

  // 1. Check if linked via AcademicProgramme
  if (staff.programme?.department) {
    const dept = staff.programme.department;
    resolvedDeptId = dept.id;
    resolvedDeptName = dept.name;
    resolvedDeptCode = dept.code || dept.id;
    if (dept.hod) resolvedHodUser = dept.hod;

    const fac = dept.faculty || staff.programme.faculty;
    if (fac) {
      resolvedFacultyId = fac.id;
      resolvedFacultyName = fac.name;
      resolvedFacultyCode = fac.facultyCode;
      if (fac.dean) resolvedDeanUser = fac.dean;
    }
  }

  // 2. Check if linked via Unit (Department or Faculty)
  if (unit) {
    const isDeptUnit = unit.type === 'DEPARTMENT' || (unit.code && unit.code.startsWith('DEP-'));
    const isFacUnit = unit.type === 'FACULTY' || (unit.code && unit.code.startsWith('FAC-'));

    if (isDeptUnit) {
      if (!resolvedDeptName) resolvedDeptName = unit.name;
      if (!resolvedDeptCode) resolvedDeptCode = unit.code;

      // Look up Academic Department model if available
      const academicDept = await prisma.department.findFirst({
        where: {
          OR: [
            ...(unit.code ? [{ code: unit.code }] : []),
            { name: { contains: unit.name, mode: 'insensitive' } },
            ...(unit.code ? [{ id: unit.code.replace('DEP-', '').toLowerCase() }] : [])
          ]
        },
        include: {
          faculty: { include: { dean: true } },
          hod: true
        }
      });

      if (academicDept) {
        resolvedDeptId = academicDept.id;
        resolvedDeptName = academicDept.name;
        resolvedDeptCode = academicDept.code || academicDept.id;
        if (academicDept.hod && !resolvedHodUser) resolvedHodUser = academicDept.hod;

        if (academicDept.faculty && !resolvedFacultyName) {
          resolvedFacultyId = academicDept.faculty.id;
          resolvedFacultyName = academicDept.faculty.name;
          resolvedFacultyCode = academicDept.faculty.facultyCode;
          if (academicDept.faculty.dean && !resolvedDeanUser) resolvedDeanUser = academicDept.faculty.dean;
        }
      }

      // Check parent faculty via code mapping
      if (!resolvedFacultyName && unit.code && FACULTY_DEPT_MAPPING[unit.code]) {
        const parentFacCode = FACULTY_DEPT_MAPPING[unit.code];
        const facUnit = await prisma.unit.findUnique({ where: { code: parentFacCode } });
        if (facUnit) {
          resolvedFacultyName = facUnit.name;
          resolvedFacultyCode = facUnit.code;
          if (facUnit.headId && !resolvedDeanUser) {
            resolvedDeanUser = await prisma.user.findUnique({ where: { id: facUnit.headId } });
          }
        }

        const facId = FACULTY_CODES_TO_IDS[parentFacCode];
        if (facId && !resolvedDeanUser) {
          const facModel = await prisma.faculty.findUnique({
            where: { id: facId },
            include: { dean: true }
          });
          if (facModel) {
            if (!resolvedFacultyName) resolvedFacultyName = facModel.name;
            resolvedFacultyId = facModel.id;
            if (facModel.dean) resolvedDeanUser = facModel.dean;
          }
        }
      }

      // Check unit.headId for HOD
      if (!resolvedHodUser && unit.headId) {
        resolvedHodUser = await prisma.user.findUnique({ where: { id: unit.headId } });
      }
    } else if (isFacUnit) {
      if (!resolvedFacultyName) resolvedFacultyName = unit.name;
      if (!resolvedFacultyCode) resolvedFacultyCode = unit.code;
      if (!resolvedDeptName) resolvedDeptName = 'Faculty Office';

      if (unit.headId && !resolvedDeanUser) {
        resolvedDeanUser = await prisma.user.findUnique({ where: { id: unit.headId } });
      }

      if (unit.code && FACULTY_CODES_TO_IDS[unit.code]) {
        const facModel = await prisma.faculty.findUnique({
          where: { id: FACULTY_CODES_TO_IDS[unit.code] },
          include: { dean: true }
        });
        if (facModel) {
          resolvedFacultyId = facModel.id;
          if (facModel.dean && !resolvedDeanUser) resolvedDeanUser = facModel.dean;
        }
      }
    }
  }

  // 3. Check primaryAssignmentDepartment or legacy department
  if (!resolvedDeptName && staff.primaryAssignmentDepartment) {
    resolvedDeptName = staff.primaryAssignmentDepartment;
    const academicDept = await prisma.department.findFirst({
      where: { name: { contains: staff.primaryAssignmentDepartment, mode: 'insensitive' } },
      include: { faculty: { include: { dean: true } }, hod: true }
    });
    if (academicDept) {
      resolvedDeptId = academicDept.id;
      resolvedDeptName = academicDept.name;
      resolvedDeptCode = academicDept.code;
      if (academicDept.hod && !resolvedHodUser) resolvedHodUser = academicDept.hod;
      if (academicDept.faculty && !resolvedFacultyName) {
        resolvedFacultyId = academicDept.faculty.id;
        resolvedFacultyName = academicDept.faculty.name;
        resolvedFacultyCode = academicDept.faculty.facultyCode;
        if (academicDept.faculty.dean && !resolvedDeanUser) resolvedDeanUser = academicDept.faculty.dean;
      }
    }
  }

  // 4. Fallback search for HOD if still null
  if (!resolvedHodUser && resolvedDeptCode) {
    const candidateHod = await prisma.user.findFirst({
      where: {
        staffProfile: {
          unit: { code: resolvedDeptCode },
          OR: [
            { rank: { contains: 'HOD', mode: 'insensitive' } },
            { rank: { contains: 'Head', mode: 'insensitive' } },
          ]
        },
        isActive: true
      }
    });
    if (candidateHod) resolvedHodUser = candidateHod;
  }

  // 5. Fallback search for Dean if still null
  if (!resolvedDeanUser && resolvedFacultyCode) {
    const candidateDean = await prisma.user.findFirst({
      where: {
        staffProfile: {
          unit: { code: resolvedFacultyCode },
          OR: [
            { rank: { contains: 'Dean', mode: 'insensitive' } },
          ]
        },
        isActive: true
      }
    });
    if (candidateDean) resolvedDeanUser = candidateDean;
  }

  // If a faculty or department was resolved, this is a Faculty staff member!
  const isFacultyStaff = Boolean(resolvedFacultyName || resolvedDeptName?.toLowerCase().includes('faculty') || resolvedDeptCode?.startsWith('DEP-'));

  if (isFacultyStaff) {
    result.isFacultyStaff = true;
    result.department = resolvedDeptName ? {
      id: resolvedDeptId || resolvedDeptCode || 'dept-generic',
      name: resolvedDeptName,
      code: resolvedDeptCode
    } : null;

    result.faculty = resolvedFacultyName ? {
      id: resolvedFacultyId || resolvedFacultyCode || 'fac-generic',
      name: resolvedFacultyName,
      code: resolvedFacultyCode
    } : null;

    if (resolvedHodUser) {
      result.hod = {
        id: resolvedHodUser.id,
        name: resolvedHodUser.name || 'Head of Department',
        email: resolvedHodUser.email || null,
        title: 'HOD'
      };
      if (resolvedHodUser.id === staffUserId) {
        result.isCallerHod = true;
      }
    }

    if (resolvedDeanUser) {
      result.dean = {
        id: resolvedDeanUser.id,
        name: resolvedDeanUser.name || 'Dean of Faculty',
        email: resolvedDeanUser.email || null,
        title: 'Dean'
      };
      if (resolvedDeanUser.id === staffUserId) {
        result.isCallerDean = true;
      }
    }
  }

  return result;
}
