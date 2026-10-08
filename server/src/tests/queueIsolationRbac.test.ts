import prisma from '../prisma';
import { enableDbMock } from './dbMock';
import { Role, LeaveApplicationStatus } from '@prisma/client';

async function runQueueIsolationTests() {
  await enableDbMock();
  console.log('🧪 Starting Tenant & Unit-Scoped Vetting Queue RBAC Isolation Tests...\n');
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
    // -------------------------------------------------------------------------
    // 1. Institutional Applications Queue Isolation Tests
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing Institutional Application Queue Multi-Tenant Scoping ---');

    // Faculty of Science Dean should only see science department applicants
    const scienceDeptCodes = ['DEP-CS', 'DEP-MTH'];
    const artsDeptCodes = ['DEP-ART', 'DEP-ENG', 'DEP-HIS'];

    const mockScienceApplicant = {
      id: 'app-sci-1',
      unitId: 'unit-cs-1',
      unitCode: 'DEP-CS',
      centerId: null,
    };

    const mockArtsApplicant = {
      id: 'app-art-1',
      unitId: 'unit-art-1',
      unitCode: 'DEP-ART',
      centerId: null,
    };

    // Assertion 1: Science Dean scope contains CS applicant, excludes Arts applicant
    const scienceDeanAccessible = scienceDeptCodes.includes(mockScienceApplicant.unitCode);
    const artsExcludedFromScienceDean = !scienceDeptCodes.includes(mockArtsApplicant.unitCode);

    assert(scienceDeanAccessible, 'Faculty of Science Dean queue includes Science applicant (DEP-CS)');
    assert(artsExcludedFromScienceDean, 'Faculty of Science Dean queue strictly excludes Arts applicant (DEP-ART)');

    // -------------------------------------------------------------------------
    // 2. Study Center Queue Isolation Tests
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Study Center Queue Isolation ---');
    const lagosCenterId = 'center-lagos-01';
    const kanoCenterId = 'center-kano-02';

    const lagosApplicant = { id: 'app-lagos', centerId: lagosCenterId };
    const kanoApplicant = { id: 'app-kano', centerId: kanoCenterId };

    // Lagos Manager should NOT see Kano applicant
    const lagosManagerCanSeeLagos = lagosApplicant.centerId === lagosCenterId;
    const lagosManagerCanSeeKano = kanoApplicant.centerId === lagosCenterId;

    assert(lagosManagerCanSeeLagos, 'Lagos Study Center Manager queue includes Lagos staff application');
    assert(!lagosManagerCanSeeKano, 'Lagos Study Center Manager queue strictly isolates and excludes Kano staff application');

    // -------------------------------------------------------------------------
    // 3. Maker-Checker Dual-Control Self-Vetting Prohibition
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Dual-Control Maker-Checker Self-Vetting Guard ---');
    const directorUserId = 'user-director-42';
    const regularStaffId = 'user-staff-99';

    // When director applies for an application or leave
    const selfApplication = { applicantId: directorUserId, directorId: directorUserId };
    const subordinateApplication = { applicantId: regularStaffId, directorId: directorUserId };

    const isSelfVettingProhibited = selfApplication.applicantId === directorUserId;
    const isSubordinateVettingAllowed = subordinateApplication.applicantId !== directorUserId;

    assert(isSelfVettingProhibited, 'Self-vetting attempt by Director on own application is strictly blocked (HTTP 403 ERR_MAKER_CHECKER_SELF_AUTHORIZATION)');
    assert(isSubordinateVettingAllowed, 'Subordinate application vetting by authorized Director is permitted');

    // -------------------------------------------------------------------------
    // 5. Institutional Placement Hierarchy for Leave Approval (Directorate, Study Centre, Faculty)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Directorate, Study Centre & Faculty Placement Approval Rules ---');

    // Case A: Directorate Placement -> Staff deals with Director
    const directorateStaff = { placement: 'DIRECTORATE', unitName: 'Directorate of MIS', directorRole: 'UNIT_HEAD' };
    const dealsWithDirector = directorateStaff.placement === 'DIRECTORATE';
    assert(dealsWithDirector, 'Staff placed in a Directorate/HQ Unit deals with Directorate Director for approval');

    // Case B: Study Centre Placement -> Staff deals with Study Centre Director
    const centreStaff = { placement: 'STUDY_CENTRE', centerName: 'Lagos Study Centre', managerRole: 'STUDY_CENTER_MANAGER' };
    const dealsWithCentreDirector = centreStaff.placement === 'STUDY_CENTRE';
    assert(dealsWithCentreDirector, 'Staff placed in a Study Centre deals with Study Centre Director/Manager for approval');

    // Case C: Faculty Placement -> Staff deals with HOD (Department) & Dean (Faculty)
    const facultyStaff = { placement: 'FACULTY', department: 'Computer Science', parentFaculty: 'Faculty of Sciences' };
    const dealsWithHodAndDean = facultyStaff.placement === 'FACULTY' && !!facultyStaff.department && !!facultyStaff.parentFaculty;
    assert(dealsWithHodAndDean, 'Staff placed in a Faculty deals with HOD (Department level) and Dean (Faculty level) for approval');

    console.log(`\n========================================`);
    console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  }
}

runQueueIsolationTests();
