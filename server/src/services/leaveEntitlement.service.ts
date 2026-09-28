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
