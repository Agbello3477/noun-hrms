import prisma from '../prisma';
import { enableDbMock } from './dbMock';
import { calculateWorkingDays, UniversityHoliday } from '../utils/calculateWorkingDays';
import {
  calculateAnnualLeaveDays,
  parseSalaryScaleAndGrade,
  checkIsPrincipalOfficer,
  initializeAnnualLeaveQuota,
} from '../services/leaveEntitlement.service';
import { LeaveType, LeaveApplicationStatus, Role, Cadre } from '@prisma/client';

async function runTests() {
  await enableDbMock();
  console.log('🧪 Starting Statutory Leave Taxonomy & Entitlement Engine Integration Tests...');
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, message: string) => {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  };

  try {
    // --- 1. Working-Day Calculation Utility Tests ---
    console.log('\n--- 1. Testing Working-Day Calculation Engine ---');

    // Scenario A: Thursday to Tuesday across a weekend (2026-10-08 to 2026-10-13)
    // Thu (1), Fri (2), Sat (excluded), Sun (excluded), Mon (3), Tue (4) = 4 working days
    const thursdayToTuesday = calculateWorkingDays('2026-10-08', '2026-10-13', []);
    assert(thursdayToTuesday.totalDays === 6, 'Thursday to Tuesday spans 6 total calendar days');
    assert(thursdayToTuesday.weekendDaysExcluded === 2, '2 weekend days (Saturday & Sunday) excluded');
    assert(thursdayToTuesday.workingDays === 4, 'Thursday to Tuesday deducts exactly 4 working days');

    // Scenario B: Spanning Nigerian Independence Day (Thursday, Oct 1 to Wednesday, Oct 7, 2026)
    // Oct 1 = Holiday (Thursday) -> Excluded
    // Oct 2 = Friday -> Working day (1)
    // Oct 3 = Saturday -> Weekend excluded
    // Oct 4 = Sunday -> Weekend excluded
    // Oct 5 = Monday -> Working day (2)
    // Oct 6 = Tuesday -> Working day (3)
    // Oct 7 = Wednesday -> Working day (4)
    const holidays2026: UniversityHoliday[] = [
      { date: '2026-10-01', name: 'National Independence Day' },
      { date: '2026-12-25', name: 'Christmas Day' },
      { date: '2026-12-26', name: 'Boxing Day' }
    ];

    const octHolidayResult = calculateWorkingDays('2026-10-01', '2026-10-07', holidays2026);
    assert(octHolidayResult.totalDays === 7, 'Oct 1 to Oct 7 spans 7 total calendar days');
    assert(octHolidayResult.holidaysExcluded === 1, 'National Independence Day (Oct 1) correctly excluded');
    assert(octHolidayResult.weekendDaysExcluded === 2, 'Weekend days (Oct 3, 4) excluded');
    assert(octHolidayResult.workingDays === 4, 'Spanning holiday and weekend yields exactly 4 working days');

    // --- 2. Statutory Entitlement Matrix Tests ---
    console.log('\n--- 2. Testing Statutory Annual Leave Entitlement Matrix ---');

    // 2a: CONUASS 04 Academic staff member (Senior Lecturer / Lecturer)
    const conuassStaff = {
      level: 'CONUASS 04',
      cadre: Cadre.ACADEMIC,
      isPrincipalOfficer: false
    };
    const parsedConuass = parseSalaryScaleAndGrade(conuassStaff);
    assert(parsedConuass.salaryScale === 'CONUASS', 'CONUASS scale parsed correctly');
    assert(parsedConuass.gradeLevel === 4, 'Grade level 4 parsed correctly');
    const conuassQuota = calculateAnnualLeaveDays({
      salaryScale: parsedConuass.salaryScale,
      gradeLevel: parsedConuass.gradeLevel,
      isPrincipalOfficer: false
    });
    assert(conuassQuota === 30, 'CONUASS 04 receives exactly 30 working days entitlement');

    // 2b: CONTISS 08 Senior Administrative staff member
    const contiss08Staff = {
      level: 'CONTISS 08',
      cadre: Cadre.ADMINISTRATIVE,
      isPrincipalOfficer: false
    };
    const parsedContiss08 = parseSalaryScaleAndGrade(contiss08Staff);
    assert(parsedContiss08.salaryScale === 'CONTISS', 'CONTISS scale parsed correctly');
    assert(parsedContiss08.gradeLevel === 8, 'Grade level 8 parsed correctly');
    const contiss08Quota = calculateAnnualLeaveDays({
      salaryScale: parsedContiss08.salaryScale,
      gradeLevel: parsedContiss08.gradeLevel,
      isPrincipalOfficer: false
    });
    assert(contiss08Quota === 30, 'CONTISS 08 receives exactly 30 working days entitlement');

    // 2c: CONTISS 03 Junior staff member
    const contiss03Staff = {
      level: 'CONTISS 03',
      cadre: Cadre.JUNIOR,
      isPrincipalOfficer: false
    };
    const parsedContiss03 = parseSalaryScaleAndGrade(contiss03Staff);
    const contiss03Quota = calculateAnnualLeaveDays({
      salaryScale: parsedContiss03.salaryScale,
      gradeLevel: parsedContiss03.gradeLevel,
      isPrincipalOfficer: false
    });
    assert(contiss03Quota === 21, 'CONTISS 03 (Junior staff) receives exactly 21 working days entitlement');

    // 2d: Principal Officer (Registrar / University Librarian)
    const registrarProfile = {
      rank: 'University Registrar',
      level: 'CONTISS 15',
      user: { role: Role.REGISTRAR },
      isPrincipalOfficer: true
    };
    assert(checkIsPrincipalOfficer(registrarProfile) === true, 'Registrar identified as Principal Officer');
    const registrarQuota = calculateAnnualLeaveDays({
      salaryScale: 'CONTISS',
      gradeLevel: 15,
      isPrincipalOfficer: true
    });
    assert(registrarQuota === 42, 'Principal Officer (Registrar) receives exactly 42 working days entitlement');

    // 2e: Vice-Chancellor Principal Officer
    const vcProfile = {
      rank: 'Vice-Chancellor',
      level: 'CONTISS 15',
      user: { role: Role.VICE_CHANCELLOR },
      isPrincipalOfficer: true
    };
    assert(checkIsPrincipalOfficer(vcProfile) === true, 'Vice-Chancellor identified as Principal Officer');
    assert(
      calculateAnnualLeaveDays({ salaryScale: 'CONUASS', gradeLevel: 7, isPrincipalOfficer: true }) === 42,
      'Vice-Chancellor receives exactly 42 working days entitlement'
    );

    // --- 3. Database Initialization & Ledger Operations ---
    console.log('\n--- 3. Testing Database Ledger Initialization & Balances ---');

    // Setup Test Staff User in DB mock
    const testStaffUser = await (prisma.user as any).create({
      data: {
        id: 'test-staff-conuass-04',
        email: 'conuass04@noun.edu.ng',
        name: 'Dr. Academic Lecturer',
        role: Role.STAFF,
        staffProfile: {
          create: {
            id: 'profile-conuass-04',
            level: 'CONUASS 04',
            cadre: Cadre.ACADEMIC,
            rank: 'Senior Lecturer',
            staffId: 'NOUN-ACAD-04',
            isPrincipalOfficer: false
          }
        }
      }
    });

    const initBalance = await initializeAnnualLeaveQuota(testStaffUser.staffProfile.id, 2026);
    assert(initBalance.staffId === testStaffUser.staffProfile.id, 'Balance created for target staff profile');
    assert(initBalance.leaveType === LeaveType.ANNUAL, 'Balance initialized for ANNUAL leave');
    assert(initBalance.year === 2026, 'Balance recorded for calendar year 2026');
    assert(initBalance.totalDaysEntitled === 30, 'Database ledger records 30 total entitled days for CONUASS 04');
    assert(initBalance.daysRemaining === 30, 'Initial daysRemaining matches totalDaysEntitled (30)');
    assert(initBalance.daysUtilized === 0, 'Initial daysUtilized is 0');

    // --- 4. Dual-Level Maker-Checker Application & Approval Workflow ---
    console.log('\n--- 4. Testing Dual-Level Approval Workflow (HOD -> Registry) ---');

    // 4a: Staff submits application for 4 working days
    const leaveApp = await (prisma as any).leaveApplication.create({
      data: {
        staffId: testStaffUser.staffProfile.id,
        leaveType: LeaveType.ANNUAL,
        startDate: new Date('2026-10-08'),
        endDate: new Date('2026-10-13'),
        workingDaysCount: 4,
        status: LeaveApplicationStatus.PENDING_HOD,
        reason: 'Statutory annual vacation rest'
      }
    });

    assert(leaveApp.id !== undefined, 'Leave application created with UUID');
    assert(leaveApp.status === LeaveApplicationStatus.PENDING_HOD, 'Initial status is PENDING_HOD');
    assert(leaveApp.workingDaysCount === 4, 'Working days count recorded as 4');

    // 4b: Level 1 HOD Endorsement
    const hodEndorsed = await (prisma as any).leaveApplication.update({
      where: { id: leaveApp.id },
      data: {
        status: LeaveApplicationStatus.PENDING_REGISTRY,
        hodApprovalRemarks: 'Endorsed. Relief staff identified and briefed.',
        hodApprovedById: 'hod-user-id',
        hodApprovedAt: new Date()
      }
    });

    assert(hodEndorsed.status === LeaveApplicationStatus.PENDING_REGISTRY, 'Level 1 updates status to PENDING_REGISTRY');
    assert(hodEndorsed.hodApprovalRemarks.includes('Endorsed'), 'HOD approval remarks recorded');

    // 4c: Level 2 Registry Final Authorization & Atomic Ledger Mutation
    const registryAuthorized = await (prisma as any).leaveApplication.update({
      where: { id: leaveApp.id },
      data: {
        status: LeaveApplicationStatus.APPROVED,
        registryApprovalRemarks: 'Approved by Registry HR Leave Unit.',
        registryApprovedById: 'registry-admin-user-id',
        registryApprovedAt: new Date(),
        payrollSuspensionFlag: false
      }
    });

    assert(registryAuthorized.status === LeaveApplicationStatus.APPROVED, 'Level 2 updates status to APPROVED');

    // Atomic ledger balance deduction
    const updatedBalance = await (prisma as any).leaveBalance.update({
      where: { id: initBalance.id },
      data: {
        daysUtilized: initBalance.daysUtilized + 4,
        daysRemaining: initBalance.daysRemaining - 4
      }
    });

    assert(updatedBalance.daysUtilized === 4, 'Leave balance daysUtilized incremented by 4 (4 days used)');
    assert(updatedBalance.daysRemaining === 26, 'Leave balance daysRemaining decremented to 26 (30 - 4 = 26)');

    // --- 5. Leave of Absence without Pay & Payroll Suspension Flag ---
    console.log('\n--- 5. Testing Leave of Absence Without Pay & Payroll Halt ---');

    const unpaidLeave = await (prisma as any).leaveApplication.create({
      data: {
        staffId: testStaffUser.staffProfile.id,
        leaveType: LeaveType.LEAVE_OF_ABSENCE_WITHOUT_PAY,
        startDate: new Date('2026-11-01'),
        endDate: new Date('2027-04-30'),
        workingDaysCount: 130,
        status: LeaveApplicationStatus.APPROVED,
        isPaidLeave: false,
        payrollSuspensionFlag: true,
        reason: 'Personal leave of absence for international consultancy'
      }
    });

    assert(unpaidLeave.leaveType === LeaveType.LEAVE_OF_ABSENCE_WITHOUT_PAY, 'Leave type is LEAVE_OF_ABSENCE_WITHOUT_PAY');
    assert(unpaidLeave.isPaidLeave === false, 'isPaidLeave is set to false');
    assert(unpaidLeave.payrollSuspensionFlag === true, 'payrollSuspensionFlag is set to true to halt salary computations');

    console.log(`\n================================`);
    console.log(`🎉 Statutory Leave Subsystem Tests Completed!`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (e: any) {
    console.error('Test execution failed with error:', e);
    process.exit(1);
  }
}

runTests();
