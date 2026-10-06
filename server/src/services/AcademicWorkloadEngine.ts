export interface WorkloadCadreThreshold {
  minCreditUnits: number;
  maxCreditUnits: number;
  maxWeeklyContactHours: number;
  description: string;
}

export interface AdministrativeRoleRebate {
  roleName: string;
  rebateCreditUnits: number;
  description: string;
}

export type WorkloadComplianceStatus =
  | 'NORMAL_LOAD'
  | 'WORKLOAD_OVERLOAD_WARNING'
  | 'UNDER_ALLOCATED';

export interface AllocationItemCalculation {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  baseCreditUnits: number;
  assignedCreditUnits: number;
  enrolledStudentsCount: number;
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  effectiveContactHoursWeekly: number;
  effectiveTeachingEquivalent: number;
  courseMaterialCreditUnits: number;
  role: string;
  semester: string;
  session: string;
  status: string;
}

export interface StaffWorkloadSummary {
  staffProfileId: string;
  staffName: string;
  staffId: string;
  academicRank: string;
  departmentId?: string;
  departmentName?: string;
  facultyId?: string;
  facultyName?: string;
  session: string;
  semester: string;
  
  // Cadre Thresholds
  cadreMinCU: number;
  cadreMaxCU: number;
  cadreMaxContactHours: number;
  
  // Administrative Rebates
  administrativeRole?: string;
  administrativeRebateCU: number;
  effectiveRequiredMinCU: number;
  effectivePermissibleMaxCU: number;
  
  // Computed Totals
  totalBaseCreditUnits: number;
  totalAssignedCreditUnits: number;
  totalCourseMaterialCreditUnits: number;
  totalEffectiveTeachingEquivalent: number;
  totalWeeklyContactHours: number;
  totalEnrolledStudents: number;
  coursesCount: number;
  
  // Compliance
  complianceStatus: WorkloadComplianceStatus;
  statusLabel: string;
  statusColor: 'emerald' | 'amber' | 'red';
  statusRemarks: string;
  overloadDeltaCU: number;
  underloadDeltaCU: number;
  isNucCompliant: boolean;
  
  // Allocations breakdown
  allocations: AllocationItemCalculation[];
}

export class AcademicWorkloadEngine {
  /**
   * Statutory CADRE Credit Unit and Contact Hour Norms per Semester (NUC Compliant)
   */
  public static readonly CADRE_NORMS: Record<string, WorkloadCadreThreshold> = {
    ASSISTANT_LECTURER: {
      minCreditUnits: 10,
      maxCreditUnits: 12,
      maxWeeklyContactHours: 16,
      description: 'Assistant Lecturer Cadre (Teaching Focus & Induction)',
    },
    LECTURER_II: {
      minCreditUnits: 10,
      maxCreditUnits: 12,
      maxWeeklyContactHours: 16,
      description: 'Lecturer II Cadre (Standard Teaching & Assessment)',
    },
    LECTURER_I: {
      minCreditUnits: 8,
      maxCreditUnits: 10,
      maxWeeklyContactHours: 14,
      description: 'Lecturer I Cadre (Teaching & Departmental Administration)',
    },
    SENIOR_LECTURER: {
      minCreditUnits: 8,
      maxCreditUnits: 10,
      maxWeeklyContactHours: 14,
      description: 'Senior Lecturer Cadre (Teaching, Research & PG Supervision)',
    },
    ASSOCIATE_PROFESSOR: {
      minCreditUnits: 6,
      maxCreditUnits: 8,
      maxWeeklyContactHours: 10,
      description: 'Reader / Associate Professor (Doctoral Supervision & Governance)',
    },
    READER: {
      minCreditUnits: 6,
      maxCreditUnits: 8,
      maxWeeklyContactHours: 10,
      description: 'Reader (Doctoral Supervision & Governance)',
    },
    PROFESSOR: {
      minCreditUnits: 6,
      maxCreditUnits: 8,
      maxWeeklyContactHours: 10,
      description: 'Full Professor (Doctoral Leadership, Research & Institutional Governance)',
    },
  };

  /**
   * Administrative Rebates (Credit Relief per Semester)
   */
  public static readonly ADMINISTRATIVE_REBATES: Record<string, number> = {
    HOD: 3.0,
    HEAD_OF_DEPARTMENT: 3.0,
    DEAN: 6.0,
    DEPUTY_DEAN: 4.0,
    DIRECTOR: 6.0,
    DEPUTY_DIRECTOR: 4.0,
    EXAM_OFFICER: 2.0,
    PROGRAMME_COORDINATOR: 2.0,
    SIWES_COORDINATOR: 2.0,
    PRACTICAL_COORDINATOR: 2.0,
    STUDY_CENTER_DIRECTOR: 6.0,
  };

  /**
   * Normalizes rank string to standard Cadre key
   */
  public static normalizeCadre(rankStr?: string | null): string {
    if (!rankStr) return 'LECTURER_II';
    const clean = rankStr.toUpperCase().trim().replace(/[\s-]+/g, '_');
    
    // Check specific ranks before generic substrings
    if (clean.includes('ASSISTANT_LECTURER') || clean.includes('GRADUATE_ASSISTANT')) return 'ASSISTANT_LECTURER';
    if (clean.includes('ASSOCIATE_PROFESSOR') || clean.includes('READER')) return 'ASSOCIATE_PROFESSOR';
    if (clean.includes('PROFESSOR')) return 'PROFESSOR';
    if (clean.includes('SENIOR_LECTURER')) return 'SENIOR_LECTURER';
    if (clean.includes('LECTURER_II') || clean === 'LECTURER_2') return 'LECTURER_II';
    if (clean.includes('LECTURER_I') || clean === 'LECTURER_1') return 'LECTURER_I';
    if (clean.includes('LECTURER')) return 'LECTURER_II';
    
    return 'LECTURER_II';
  }

  /**
   * Calculates Effective Teaching Equivalent (ETE) for an ODL Course Allocation
   * ETE = Base Credit Units + max(0, (Enrolled Students - 200) / 500) * 0.5
   */
  public static calculateCourseETE(
    baseCreditUnits: number,
    enrolledStudents: number = 0,
    roleScalingFactor: number = 1.0
  ): number {
    const safeBase = Math.max(0, baseCreditUnits);
    const safeStudents = Math.max(0, enrolledStudents);
    const studentScalingBonus = safeStudents > 200 ? ((safeStudents - 200) / 500) * 0.5 : 0;
    const totalETE = (safeBase + studentScalingBonus) * roleScalingFactor;
    return Number(totalETE.toFixed(2));
  }

  /**
   * Calculates Weekly Teaching Contact Hours
   * Contact Hours = Lecture Hours + Tutorial Hours + (Practical Hours * 0.5)
   */
  public static calculateContactHours(
    lectureHours: number = 2,
    tutorialHours: number = 1,
    practicalHours: number = 0
  ): number {
    const contact = Math.max(0, lectureHours) + Math.max(0, tutorialHours) + Math.max(0, practicalHours) * 0.5;
    return Number(contact.toFixed(2));
  }

  /**
   * Evaluates administrative rebate based on staff title, rank, or explicit appointment
   */
  public static getAdministrativeRebate(administrativeRole?: string | null, rank?: string | null): { role: string; rebateCU: number } {
    if (!administrativeRole && !rank) {
      return { role: 'NONE', rebateCU: 0 };
    }

    const searchKey = `${administrativeRole || ''} ${rank || ''}`.toUpperCase().replace(/[\s_-]+/g, ' ');

    if (searchKey.includes('DEAN') || searchKey.includes('DIRECTOR')) {
      return { role: 'DEAN / DIRECTOR', rebateCU: 6.0 };
    }
    if (searchKey.includes('HOD') || searchKey.includes('HEAD OF DEPARTMENT')) {
      return { role: 'HEAD OF DEPARTMENT (HOD)', rebateCU: 3.0 };
    }
    if (searchKey.includes('DEPUTY DEAN') || searchKey.includes('DEPUTY DIRECTOR')) {
      return { role: 'DEPUTY DEAN / DIRECTOR', rebateCU: 4.0 };
    }
    if (searchKey.includes('EXAM OFFICER') || searchKey.includes('EXAMINATION OFFICER')) {
      return { role: 'EXAMINATION OFFICER', rebateCU: 2.0 };
    }
    if (searchKey.includes('PROGRAMME COORDINATOR') || searchKey.includes('COORDINATOR')) {
      return { role: 'PROGRAMME COORDINATOR', rebateCU: 2.0 };
    }

    return { role: 'NONE', rebateCU: 0 };
  }

  /**
   * Evaluates whole semester workload dossier for an academic staff member
   */
  public static evaluateStaffWorkload(params: {
    staffProfileId: string;
    staffName: string;
    staffId: string;
    academicRank?: string | null;
    departmentId?: string;
    departmentName?: string;
    facultyId?: string;
    facultyName?: string;
    administrativeRole?: string | null;
    session: string;
    semester: string;
    allocations: Array<{
      courseId: string;
      courseCode: string;
      courseTitle: string;
      creditUnits: number;
      assignedCreditUnits?: number | null;
      enrolledStudentsCount?: number | null;
      lectureHours?: number | null;
      tutorialHours?: number | null;
      practicalHours?: number | null;
      role: string;
      courseMaterialCreditUnits?: number | null;
      administrativeReliefUnits?: number | null;
      allocationStatus: string;
      session?: string;
      semester?: string;
    }>;
  }): StaffWorkloadSummary {
    const cadreKey = this.normalizeCadre(params.academicRank);
    const cadreNorm = this.CADRE_NORMS[cadreKey] || this.CADRE_NORMS.LECTURER_II;

    const { role: adminRoleName, rebateCU: adminRebateCU } = this.getAdministrativeRebate(
      params.administrativeRole,
      params.academicRank
    );

    const effectiveRequiredMinCU = Math.max(0, cadreNorm.minCreditUnits - adminRebateCU);
    const effectivePermissibleMaxCU = Math.max(0, cadreNorm.maxCreditUnits - adminRebateCU);

    let totalBaseCU = 0;
    let totalAssignedCU = 0;
    let totalCourseMaterialCU = 0;
    let totalETE = 0;
    let totalWeeklyContactHours = 0;
    let totalEnrolledStudents = 0;

    const itemCalculations: AllocationItemCalculation[] = params.allocations.map((alloc) => {
      const baseCU = Number(alloc.creditUnits || 3);
      const assignedCU = Number(alloc.assignedCreditUnits || baseCU);
      const enrolled = Number(alloc.enrolledStudentsCount || 0);
      const lectHrs = Number(alloc.lectureHours ?? 2);
      const tutHrs = Number(alloc.tutorialHours ?? 1);
      const pracHrs = Number(alloc.practicalHours ?? 0);
      const matCU = Number(alloc.courseMaterialCreditUnits || 0);

      const contactHrs = this.calculateContactHours(lectHrs, tutHrs, pracHrs);
      const ete = this.calculateCourseETE(assignedCU, enrolled);

      totalBaseCU += baseCU;
      totalAssignedCU += assignedCU;
      totalCourseMaterialCU += matCU;
      totalETE += ete + matCU;
      totalWeeklyContactHours += contactHrs;
      totalEnrolledStudents += enrolled;

      return {
        courseId: alloc.courseId,
        courseCode: alloc.courseCode,
        courseTitle: alloc.courseTitle,
        baseCreditUnits: baseCU,
        assignedCreditUnits: assignedCU,
        enrolledStudentsCount: enrolled,
        lectureHours: lectHrs,
        tutorialHours: tutHrs,
        practicalHours: pracHrs,
        effectiveContactHoursWeekly: contactHrs,
        effectiveTeachingEquivalent: ete,
        courseMaterialCreditUnits: matCU,
        role: alloc.role,
        semester: alloc.semester || params.semester,
        session: alloc.session || params.session,
        status: alloc.allocationStatus,
      };
    });

    const grandTotalEffectiveCU = totalAssignedCU + totalCourseMaterialCU;

    // Validation & Overload Alerts:
    // Overload warning if grand total CU > cadre maximum permissible + 3 CU ceiling
    let complianceStatus: WorkloadComplianceStatus = 'NORMAL_LOAD';
    let statusLabel = 'Normal Load';
    let statusColor: 'emerald' | 'amber' | 'red' = 'emerald';
    let statusRemarks = 'Workload within statutory NUC boundaries.';
    let overloadDeltaCU = 0;
    let underloadDeltaCU = 0;

    if (grandTotalEffectiveCU > effectivePermissibleMaxCU + 3.0) {
      complianceStatus = 'WORKLOAD_OVERLOAD_WARNING';
      overloadDeltaCU = Number((grandTotalEffectiveCU - effectivePermissibleMaxCU).toFixed(2));
      statusLabel = 'Workload Overload Warning';
      statusColor = 'red';
      statusRemarks = `Allocated load (${grandTotalEffectiveCU.toFixed(1)} CU) exceeds maximum statutory threshold (${effectivePermissibleMaxCU.toFixed(1)} CU) by +${overloadDeltaCU.toFixed(1)} CU.`;
    } else if (grandTotalEffectiveCU < effectiveRequiredMinCU && effectiveRequiredMinCU > 0) {
      complianceStatus = 'UNDER_ALLOCATED';
      underloadDeltaCU = Number((effectiveRequiredMinCU - grandTotalEffectiveCU).toFixed(2));
      statusLabel = 'Under-Allocated';
      statusColor = 'amber';
      statusRemarks = `Allocated load (${grandTotalEffectiveCU.toFixed(1)} CU) is below statutory minimum threshold (${effectiveRequiredMinCU.toFixed(1)} CU) by -${underloadDeltaCU.toFixed(1)} CU.`;
    } else {
      complianceStatus = 'NORMAL_LOAD';
      statusLabel = 'NUC Compliant Load';
      statusColor = 'emerald';
      statusRemarks = `Workload is balanced (${grandTotalEffectiveCU.toFixed(1)} CU vs permissible ${effectiveRequiredMinCU}-${effectivePermissibleMaxCU} CU).`;
    }

    return {
      staffProfileId: params.staffProfileId,
      staffName: params.staffName,
      staffId: params.staffId,
      academicRank: params.academicRank || 'Lecturer II',
      departmentId: params.departmentId,
      departmentName: params.departmentName,
      facultyId: params.facultyId,
      facultyName: params.facultyName,
      session: params.session,
      semester: params.semester,
      cadreMinCU: cadreNorm.minCreditUnits,
      cadreMaxCU: cadreNorm.maxCreditUnits,
      cadreMaxContactHours: cadreNorm.maxWeeklyContactHours,
      administrativeRole: adminRoleName !== 'NONE' ? adminRoleName : undefined,
      administrativeRebateCU: adminRebateCU,
      effectiveRequiredMinCU,
      effectivePermissibleMaxCU,
      totalBaseCreditUnits: totalBaseCU,
      totalAssignedCreditUnits: totalAssignedCU,
      totalCourseMaterialCreditUnits: totalCourseMaterialCU,
      totalEffectiveTeachingEquivalent: Number(totalETE.toFixed(2)),
      totalWeeklyContactHours: Number(totalWeeklyContactHours.toFixed(2)),
      totalEnrolledStudents,
      coursesCount: itemCalculations.length,
      complianceStatus,
      statusLabel,
      statusColor,
      statusRemarks,
      overloadDeltaCU,
      underloadDeltaCU,
      isNucCompliant: complianceStatus === 'NORMAL_LOAD',
      allocations: itemCalculations,
    };
  }
}
