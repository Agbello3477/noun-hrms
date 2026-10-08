import prisma from '../prisma';
import { LeaveType, Role, Cadre } from '@prisma/client';

export interface StaffEntitlementInfo {
  salaryScale: 'CONTISS' | 'CONUASS' | 'OTHER';
  gradeLevel: number;
  isPrincipalOfficer: boolean;
  cadre: string;
}

/**
 * Checks if a title, rank or role designates a Principal Officer per university statute:
 * Vice-Chancellor, Deputy Vice-Chancellors, Registrar, Bursar, University Librarian.
 */
export function checkIsPrincipalOfficer(
  profile: {
    isPrincipalOfficer?: boolean | null;
    rank?: string | null;
    level?: string | null;
    user?: { role?: Role | string | null; name?: string | null } | null;
  }
): boolean {
  if (profile.isPrincipalOfficer) return true;

  const role = profile.user?.role;
  if (role === Role.VICE_CHANCELLOR || role === Role.REGISTRAR) {
    return true;
  }

  const rankLower = (profile.rank || '').toLowerCase();
  const principalOfficerKeywords = [
    'vice-chancellor',
    'vice chancellor',
    'deputy vice-chancellor',
    'deputy vice chancellor',
    'registrar',
    'bursar',
    'university librarian',
    'librarian of the university'
  ];

  return principalOfficerKeywords.some(keyword => rankLower.includes(keyword));
}

/**
 * Parses salary scale and numeric grade level from level or rank strings
 * Examples: "CONTISS 13", "CONUASS 04", "15", "CONTISS 08", "CONUASS 01"
 */
export function parseSalaryScaleAndGrade(profile: {
  level?: string | null;
  currentGradeLevel?: string | null;
  cadre?: Cadre | string | null;
}): { salaryScale: 'CONTISS' | 'CONUASS' | 'OTHER'; gradeLevel: number } {
  const levelStr = (profile.currentGradeLevel || profile.level || '').toUpperCase().trim();

  let salaryScale: 'CONTISS' | 'CONUASS' | 'OTHER' = 'CONTISS';
  let gradeLevel = 8; // Default midpoint

  if (levelStr.includes('CONUASS') || profile.cadre === 'ACADEMIC') {
    salaryScale = 'CONUASS';
  } else if (levelStr.includes('CONTISS')) {
    salaryScale = 'CONTISS';
  }

  // Extract number from string (e.g. "CONUASS 04" -> 4, "CONTISS 13" -> 13)
  const match = levelStr.match(/\d+/);
  if (match) {
    gradeLevel = parseInt(match[0], 10);
  } else {
    // Default based on scale
    gradeLevel = salaryScale === 'CONUASS' ? 4 : 8;
  }

  return { salaryScale, gradeLevel };
}

/**
 * Determines statutory Annual Leave entitlement in working days:
 * - Principal Officers: 42 working days
 * - CONUASS 01 - 07: 30 working days
 * - CONTISS 06 - 15: 30 working days
 * - CONTISS 01 - 05: 21 working days (junior staff statutory base)
 */
export function calculateAnnualLeaveDays(info: {
  isPrincipalOfficer: boolean;
  salaryScale: 'CONTISS' | 'CONUASS' | 'OTHER';
  gradeLevel: number;
}): number {
  if (info.isPrincipalOfficer) {
    return 42;
  }

  if (info.salaryScale === 'CONUASS') {
    return 30;
  }

  if (info.salaryScale === 'CONTISS') {
    if (info.gradeLevel >= 6) {
      return 30;
    }
    return 21;
  }

  return 30; // Standard senior fallback
}

/**
 * Initializes or refreshes statutory annual leave balance for a staff profile
 */
export async function initializeAnnualLeaveQuota(
  staffId: string,
  year: number = new Date().getFullYear()
) {
  const staff = await prisma.staffProfile.findUnique({
    where: { id: staffId },
    include: { user: true }
  });

  if (!staff) {
    throw new Error(`Staff profile with ID ${staffId} not found.`);
  }

  const isPrincipalOfficer = checkIsPrincipalOfficer(staff);
  const { salaryScale, gradeLevel } = parseSalaryScaleAndGrade(staff);

  const totalDaysEntitled = calculateAnnualLeaveDays({
    isPrincipalOfficer,
    salaryScale,
    gradeLevel
  });

  // Check if balance record already exists for this year
  const existingBalance = await prisma.leaveBalance.findUnique({
    where: {
      staffId_leaveType_year: {
        staffId,
        leaveType: LeaveType.ANNUAL,
        year
      }
    }
  });

  if (existingBalance) {
    const daysUtilized = existingBalance.daysUtilized;
    const daysRemaining = Math.max(0, totalDaysEntitled - daysUtilized);

    return await prisma.leaveBalance.update({
      where: { id: existingBalance.id },
      data: {
        totalDaysEntitled,
        daysRemaining,
        isPaidLeave: true
      }
    });
  }

  return await prisma.leaveBalance.create({
    data: {
      staffId,
      leaveType: LeaveType.ANNUAL,
      year,
      totalDaysEntitled,
      daysUtilized: 0,
      daysRemaining: totalDaysEntitled,
      isPaidLeave: true
    }
  });
}

/**
 * Initializes all statutory leave balances for a staff member for the target calendar year
 */
export async function initializeAllLeaveBalances(
  staffId: string,
  year: number = new Date().getFullYear()
) {
  // 1. Annual Leave Quota
  const annualBalance = await initializeAnnualLeaveQuota(staffId, year);

  // 2. Define statutory base days for other specialized categories
  const otherLeaveQuotas: Array<{
    type: LeaveType;
    totalDays: number;
    isPaid: boolean;
  }> = [
    { type: LeaveType.CASUAL, totalDays: 7, isPaid: true }, // Max 7 days cumulative
    { type: LeaveType.PATERNITY, totalDays: 14, isPaid: true }, // 14 working days
    { type: LeaveType.MATERNITY, totalDays: 80, isPaid: true }, // 16 weeks (~80 working days)
    { type: LeaveType.SICK, totalDays: 21, isPaid: true },
    { type: LeaveType.SABBATICAL, totalDays: 260, isPaid: true }, // 1 academic year (~260 working days)
    { type: LeaveType.RESEARCH, totalDays: 130, isPaid: true }, // ~6 months
    { type: LeaveType.STUDY, totalDays: 260, isPaid: true },
    { type: LeaveType.TRAINING, totalDays: 60, isPaid: true },
    { type: LeaveType.EXAMINATION, totalDays: 14, isPaid: true },
    { type: LeaveType.EXTERNAL_ACADEMIC_AWARD, totalDays: 180, isPaid: true },
    { type: LeaveType.TERMINAL, totalDays: 30, isPaid: true },
    { type: LeaveType.LEAVE_OF_ABSENCE_WITHOUT_PAY, totalDays: 260, isPaid: false },
  ];

  const balances = [annualBalance];

  for (const item of otherLeaveQuotas) {
    const existing = await prisma.leaveBalance.findUnique({
      where: {
        staffId_leaveType_year: {
          staffId,
          leaveType: item.type,
          year
        }
      }
    });

    if (!existing) {
      const created = await prisma.leaveBalance.create({
        data: {
          staffId,
          leaveType: item.type,
          year,
          totalDaysEntitled: item.totalDays,
          daysUtilized: 0,
          daysRemaining: item.totalDays,
          isPaidLeave: item.isPaid
        }
      });
      balances.push(created);
    } else {
      balances.push(existing);
    }
  }

  return balances;
}

/**
 * Returns all active leave balances for a staff profile, auto-initializing if missing
 */
export async function getOrInitializeLeaveBalances(
  staffId: string,
  year: number = new Date().getFullYear()
) {
  let balances = await prisma.leaveBalance.findMany({
    where: { staffId, year },
    orderBy: { leaveType: 'asc' }
  });

  if (balances.length === 0) {
    balances = await initializeAllLeaveBalances(staffId, year);
  } else {
    // Ensure Annual Leave is always present
    const hasAnnual = balances.some(b => b.leaveType === LeaveType.ANNUAL);
    if (!hasAnnual) {
      const annual = await initializeAnnualLeaveQuota(staffId, year);
      balances.push(annual);
    }
  }

  return balances;
}

export interface ResolvedDirector {
  id: string; // User ID
  name: string;
  email: string | null;
  role: Role | string;
  title?: string | null;
  unitName?: string | null;
  reason?: string;
}

/**
 * Resolves ONLY the specific Director, Dean, HOD, or Study Center Manager
 * who is the direct administrative supervisor for a given staff member.
 * Ensures strict isolation with zero-leakage so unrelated directors NEVER receive notifications.
 */
export async function resolveStaffDirector(
  staffProfileIdOrUserId: string
): Promise<ResolvedDirector[]> {
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
      studyCenter: true
    }
  });

  if (!staff) return [];

  const staffUserId = staff.userId;
  const unit = staff.unit;
  const centerId = staff.centerId;
  const results: ResolvedDirector[] = [];
  const addedUserIds = new Set<string>();

  const addApprover = (user: { id: string; name?: string | null; email?: string | null; role: Role | string }, unitName?: string | null, reason?: string) => {
    if (user.id !== staffUserId && !addedUserIds.has(user.id)) {
      addedUserIds.add(user.id);
      results.push({
        id: user.id,
        name: user.name || 'Administrative Approver',
        email: user.email || null,
        role: user.role,
        unitName: unitName || unit?.name || 'Unit',
        reason
      });
    }
  };

  const eligibleDirectorRoles: Role[] = [
    Role.UNIT_HEAD,
    Role.UNIT_ADMIN,
    Role.STUDY_CENTER_MANAGER,
    Role.CLINIC_HEAD,
    Role.SECURITY_HEAD,
  ];

  // =========================================================================
  // BRANCH 1: STUDY CENTRE PLACEMENT (Staff stationed at a Study Centre)
  // Staff deals with Study Centre Director / Centre Manager
  // =========================================================================
  if (centerId) {
    const centerManager = await prisma.user.findFirst({
      where: {
        staffProfile: { centerId },
        role: { in: [Role.STUDY_CENTER_MANAGER, Role.UNIT_HEAD] },
        isActive: true,
        id: { not: staffUserId }
      },
      select: { id: true, name: true, email: true, role: true }
    });

    if (centerManager) {
      addApprover(centerManager, staff.studyCenter?.name || 'Study Centre', 'Study Centre Director / Centre Manager');
    }
  }

  // =========================================================================
  // BRANCH 2: FACULTY PLACEMENT (Staff in Faculty or Academic Department)
  // Staff deals with HOD (Department level) and Dean (Faculty level)
  // =========================================================================
  const isFacultyDept = unit && (unit.type === 'DEPARTMENT' || (unit.code && unit.code.startsWith('DEP-')));
  const isFacultyDirect = unit && (unit.type === 'FACULTY' || (unit.code && unit.code.startsWith('FAC-')));

  if (isFacultyDept || isFacultyDirect) {
    // 2a. If Academic Department: Resolve HOD
    if (isFacultyDept) {
      // Direct HOD via unit.headId
      if (unit.headId && unit.headId !== staffUserId) {
        const hodUser = await prisma.user.findFirst({
          where: { id: unit.headId, isActive: true },
          select: { id: true, name: true, email: true, role: true }
        });
        if (hodUser) {
          addApprover(hodUser, unit.name, 'Head of Department (HOD)');
        }
      }

      // HOD via role in same department
      if (!addedUserIds.size) {
        const deptHod = await prisma.user.findFirst({
          where: {
            staffProfile: { unitId: unit.id },
            role: { in: eligibleDirectorRoles },
            isActive: true,
            id: { not: staffUserId }
          },
          select: { id: true, name: true, email: true, role: true }
        });
        if (deptHod) {
          addApprover(deptHod, unit.name, 'Department HOD / Unit Head');
        }
      }

      // HOD via rank
      if (!addedUserIds.size) {
        const rankedHod = await prisma.staffProfile.findFirst({
          where: {
            unitId: unit.id,
            userId: { not: staffUserId },
            user: { isActive: true },
            OR: [
              { rank: { contains: 'HOD', mode: 'insensitive' } },
              { rank: { contains: 'Head', mode: 'insensitive' } },
            ]
          },
          include: { user: true }
        });
        if (rankedHod?.user) {
          addApprover(rankedHod.user, unit.name, 'Ranked HOD / Department Head');
        }
      }

      // 2b. Resolve Parent Faculty Dean
      const facultyDeptMapping: Record<string, string> = {
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

      const parentFacultyCode = facultyDeptMapping[unit.code || ''];
      if (parentFacultyCode) {
        const parentFaculty = await prisma.unit.findUnique({
          where: { code: parentFacultyCode }
        });

        if (parentFaculty) {
          if (parentFaculty.headId && parentFaculty.headId !== staffUserId) {
            const deanUser = await prisma.user.findFirst({
              where: { id: parentFaculty.headId, isActive: true },
              select: { id: true, name: true, email: true, role: true }
            });
            if (deanUser) {
              addApprover(deanUser, parentFaculty.name, 'Faculty Dean (via parent Faculty headId)');
            }
          }

          const deanRoleUser = await prisma.user.findFirst({
            where: {
              staffProfile: { unitId: parentFaculty.id },
              role: { in: eligibleDirectorRoles },
              isActive: true,
              id: { not: staffUserId }
            },
            select: { id: true, name: true, email: true, role: true }
          });
          if (deanRoleUser) {
            addApprover(deanRoleUser, parentFaculty.name, 'Faculty Dean (Parent Faculty Leader)');
          }
        }
      }
    }

    // 2c. If placed directly in Faculty Office (e.g. Faculty Officer, Dean's Admin): Resolve Dean
    if (isFacultyDirect) {
      if (unit.headId && unit.headId !== staffUserId) {
        const deanUser = await prisma.user.findFirst({
          where: { id: unit.headId, isActive: true },
          select: { id: true, name: true, email: true, role: true }
        });
        if (deanUser) {
          addApprover(deanUser, unit.name, 'Faculty Dean (Direct Faculty headId)');
        }
      }

      const deanLeader = await prisma.user.findFirst({
        where: {
          staffProfile: { unitId: unit.id },
          role: { in: eligibleDirectorRoles },
          isActive: true,
          id: { not: staffUserId }
        },
        select: { id: true, name: true, email: true, role: true }
      });
      if (deanLeader) {
        addApprover(deanLeader, unit.name, 'Faculty Dean');
      }
    }
  }

  // =========================================================================
  // BRANCH 3: DIRECTORATE / HQ PLACEMENT (MIS, DAP, Registry, Bursary, Clinic, Security)
  // Staff deals with Director / Directorate Head
  // =========================================================================
  if (!isFacultyDept && !isFacultyDirect && unit?.id) {
    // Direct Unit Head via unit.headId
    if (unit.headId && unit.headId !== staffUserId) {
      const headUser = await prisma.user.findFirst({
        where: { id: unit.headId, isActive: true },
        select: { id: true, name: true, email: true, role: true }
      });
      if (headUser) {
        addApprover(headUser, unit.name, 'Director / Directorate Head (via unit.headId)');
      }
    }

    // Directorate Leader via Role
    if (!results.length) {
      const unitLeader = await prisma.user.findFirst({
        where: {
          staffProfile: { unitId: unit.id },
          role: { in: eligibleDirectorRoles },
          isActive: true,
          id: { not: staffUserId }
        },
        select: { id: true, name: true, email: true, role: true }
      });
      if (unitLeader) {
        addApprover(unitLeader, unit.name, 'Director / Unit Head');
      }
    }

    // Directorate Leader via Rank
    if (!results.length) {
      const rankedLeader = await prisma.staffProfile.findFirst({
        where: {
          unitId: unit.id,
          userId: { not: staffUserId },
          user: { isActive: true },
          OR: [
            { rank: { contains: 'Director', mode: 'insensitive' } },
            { rank: { contains: 'Head', mode: 'insensitive' } },
            { rank: { contains: 'Coordinator', mode: 'insensitive' } },
          ]
        },
        include: { user: true }
      });
      if (rankedLeader?.user) {
        addApprover(rankedLeader.user, unit.name, 'Director / Head of Unit (by Rank)');
      }
    }
  }

  if (results.length > 0) {
    return results;
  }

  // Zero-leakage fallback: If no dedicated director found, return empty array. NEVER broadcast!
  console.warn(`[Leave Notification] No dedicated Director/Unit Head resolved for staff ${staff.id} (${staff.user?.name || 'Unknown'}). Zero-leakage policy applied.`);
  return [];
}

/**
 * Resolves all Unit IDs, Center IDs, and location identifiers under a Director/Dean/Manager's authority.
 * Includes direct Unit, headed Units, child departments under a Faculty, and Study Centers.
 */
export async function getDirectorPlacementScope(userId: string, userRole?: string): Promise<{
  unitIds: string[];
  centerIds: string[];
  locationNames: string[];
  allPlacementIds: string[];
}> {
  const profile = await prisma.staffProfile.findUnique({
    where: { userId },
    select: { id: true, unitId: true, centerId: true, unit: true, studyCenter: true }
  });

  const targetUnitIds = new Set<string>();
  const targetCenterIds = new Set<string>();
  const targetLocationNames = new Set<string>();

  if (profile?.unitId) targetUnitIds.add(profile.unitId);
  if (profile?.centerId) targetCenterIds.add(profile.centerId);
  if (profile?.unit?.name) targetLocationNames.add(profile.unit.name);
  if (profile?.studyCenter?.name) targetLocationNames.add(profile.studyCenter.name);

  // Units where user is designated head (by user.id or staffProfile.id)
  const headedUnits = await prisma.unit.findMany({
    where: {
      OR: [
        { headId: userId },
        ...(profile?.id ? [{ headId: profile.id }] : [])
      ]
    }
  });

  headedUnits.forEach(u => {
    targetUnitIds.add(u.id);
    if (u.name) targetLocationNames.add(u.name);
  });

  // Check child units / departments if headed/assigned units are faculties
  const facultyDeptMapping: Record<string, string> = {
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

  const allKnownUnitIds = Array.from(targetUnitIds);
  if (allKnownUnitIds.length > 0) {
    const knownUnits = await prisma.unit.findMany({
      where: { id: { in: allKnownUnitIds } }
    });
    const facultyCodes = knownUnits
      .map(u => u.code)
      .filter(Boolean) as string[];

    const deptCodesToAdd: string[] = [];
    for (const [deptCode, facCode] of Object.entries(facultyDeptMapping)) {
      if (facultyCodes.includes(facCode)) {
        deptCodesToAdd.push(deptCode);
      }
    }

    if (deptCodesToAdd.length > 0) {
      const childUnits = await prisma.unit.findMany({
        where: { code: { in: deptCodesToAdd } }
      });
      childUnits.forEach(cu => {
        targetUnitIds.add(cu.id);
        if (cu.name) targetLocationNames.add(cu.name);
      });
    }
  }

  // Study centers where manager is user or profile
  const studyCenters = await prisma.studyCenter.findMany({
    where: {
      OR: [
        ...(profile?.centerId ? [{ id: profile.centerId }] : []),
        ...(profile?.id ? [{ id: profile.id }] : [])
      ]
    }
  });
  studyCenters.forEach(c => {
    targetCenterIds.add(c.id);
    targetLocationNames.add(c.name);
  });

  return {
    unitIds: Array.from(targetUnitIds),
    centerIds: Array.from(targetCenterIds),
    locationNames: Array.from(targetLocationNames),
    allPlacementIds: [...Array.from(targetUnitIds), ...Array.from(targetCenterIds)]
  };
}

