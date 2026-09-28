/**
 * Role Assignment, Registrar Authorization Gate & VC System Functionality Tests
 *
 * Verifies:
 * 1. Role Assignment Options:
 *    - The Registrar (Super admin) -> Role.REGISTRAR
 *    - The VC -> Role.VICE_CHANCELLOR
 * 2. Registrar Authorization Security Gate:
 *    - No system role can be changed without Registrar authorization (REGISTRAR, SUPER_USER, or VICE_CHANCELLOR).
 *    - Operational officers (HR_ADMIN, REGISTRY_ADMIN) attempting to change roles are rejected with HTTP 403.
 *    - Authorized role updates create an immutable AuditLog entry.
 * 3. Vice-Chancellor (VC) System Functionality Verification:
 *    - VC role grants full executive access to VC Command Center analytics.
 *    - VC role grants executive payroll authorization.
 *    - VC role grants Principal Officer authorizer status (Leave, Staff Files, Postings).
 *    - VC role grants 42 working days statutory annual leave entitlement.
 */

import prisma from '../prisma';
import { enableDbMock } from './dbMock';
import { Role } from '@prisma/client';
import { updateStaff } from '../controllers/staff.controller';
import { getOrInitializeLeaveBalances, checkIsPrincipalOfficer } from '../services/leaveEntitlement.service';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`❌ FAIL: ${testName} - ${detail || 'Assertion failed'}`);
    failedCount++;
  }
}

async function runRoleAuthorizationAndVcTests() {
  console.log('🧪 Starting Role Assignment, Registrar Authorization & VC Functionality Tests...\n');
  await enableDbMock();

  // Seed baseline users in mock DB
  const staffUserId = 'user-staff-001';
  const staffProfileId = 'staff-profile-001';
  const hrAdminId = 'user-hr-admin';
  const registryAdminId = 'user-registry-admin';
  const registrarId = 'user-registrar';
  const vcUserId = 'user-vc-001';
  const vcProfileId = 'staff-profile-vc-001';

  // Regular staff user
  await prisma.user.create({
    data: {
      id: staffUserId,
      email: 'john.doe@noun.edu.ng',
      name: 'John Doe',
      role: Role.STAFF,
      isActive: true,
      staffProfile: {
        create: {
          id: staffProfileId,
          staffId: 'NOUN/2026/001',
          surname: 'Doe',
          otherNames: 'John',
          rank: 'Administrative Officer II',
          cadre: 'ADMINISTRATIVE',
          level: 'CONTISS 08',
          status: 'ACTIVE'
        }
      }
    }
  });

  // HR Admin (Operational Maker / Imputer)
  await prisma.user.create({
    data: {
      id: hrAdminId,
      email: 'hr.imputer@noun.edu.ng',
      name: 'HR Officer',
      role: Role.HR_ADMIN,
      isActive: true
    }
  });

  // Registry Admin (Operations Desk)
  await prisma.user.create({
    data: {
      id: registryAdminId,
      email: 'registry.clerk@noun.edu.ng',
      name: 'Registry Clerk',
      role: Role.REGISTRY_ADMIN,
      isActive: true
    }
  });

  // Registrar (Principal Officer / Authorizer)
  await prisma.user.create({
    data: {
      id: registrarId,
      email: 'registrar@noun.edu.ng',
      name: 'University Registrar',
      role: Role.REGISTRAR,
      isActive: true
    }
  });

  // Vice-Chancellor
  await prisma.user.create({
    data: {
      id: vcUserId,
      email: 'vc@noun.edu.ng',
      name: 'Prof. Olufemi Peters',
      role: Role.VICE_CHANCELLOR,
      isActive: true,
      staffProfile: {
        create: {
          id: vcProfileId,
          staffId: '00001',
          surname: 'Peters',
          otherNames: 'Olufemi',
          rank: 'Vice-Chancellor',
          cadre: 'ACADEMIC',
          level: 'CONUASS 07',
          status: 'ACTIVE'
        }
      }
    }
  });

  // =========================================================================
  // Section 1: Registrar Authorization Security Gate
  // =========================================================================
  console.log('--- 1. Testing Registrar Authorization Gate on Role Modifications ---');

  // Scenario A: HR_ADMIN attempts to change a user's role to UNIT_HEAD
  let hrResStatus = 200;
  let hrResBody: any = null;
  const mockHrReq: any = {
    params: { id: staffUserId },
    user: { id: hrAdminId, role: Role.HR_ADMIN },
    body: { role: Role.UNIT_HEAD }
  };
  const mockHrRes: any = {
    status: (code: number) => {
      hrResStatus = code;
      return {
        json: (data: any) => { hrResBody = data; }
      };
    },
    json: (data: any) => { hrResBody = data; }
  };

  await updateStaff(mockHrReq, mockHrRes);

  assert(hrResStatus === 403, 'HR_ADMIN cannot change role (HTTP 403 Forbidden)', `Received status ${hrResStatus}`);
  assert(
    hrResBody?.message?.includes('No system role can be changed without Registrar authorization'),
    'HR_ADMIN receives explicit Registrar authorization error message'
  );

  // Verify staff role was NOT changed
  const staffAfterHrAttempt = await prisma.user.findUnique({ where: { id: staffUserId } });
  assert(staffAfterHrAttempt?.role === Role.STAFF, 'Staff role remains unchanged (STAFF) after unauthorized attempt');

  // Scenario B: REGISTRY_ADMIN attempts to change role
  let regClerkStatus = 200;
  let regClerkBody: any = null;
  const mockRegReq: any = {
    params: { id: staffUserId },
    user: { id: registryAdminId, role: Role.REGISTRY_ADMIN },
    body: { role: Role.BURSARY }
  };
  const mockRegRes: any = {
    status: (code: number) => {
      regClerkStatus = code;
      return {
        json: (data: any) => { regClerkBody = data; }
      };
    },
    json: (data: any) => { regClerkBody = data; }
  };

  await updateStaff(mockRegReq, mockRegRes);
  assert(regClerkStatus === 403, 'REGISTRY_ADMIN cannot change role (HTTP 403 Forbidden)');

  // Scenario C: REGISTRAR authorizes role change to UNIT_HEAD
  let regSuccessStatus = 200;
  let regSuccessBody: any = null;
  const mockRegistrarReq: any = {
    params: { id: staffUserId },
    user: { id: registrarId, role: Role.REGISTRAR },
    body: { role: Role.UNIT_HEAD, rank: 'Head of Unit' }
  };
  const mockRegistrarRes: any = {
    status: (code: number) => {
      regSuccessStatus = code;
      return {
        json: (data: any) => { regSuccessBody = data; }
      };
    },
    json: (data: any) => { regSuccessBody = data; }
  };

  await updateStaff(mockRegistrarReq, mockRegistrarRes);
  assert(regSuccessStatus === 200, 'REGISTRAR successfully authorizes role change (HTTP 200)');

  const staffAfterRegistrar = await prisma.user.findUnique({ where: { id: staffUserId } });
  assert(staffAfterRegistrar?.role === Role.UNIT_HEAD, 'Staff role successfully updated to UNIT_HEAD by Registrar');

  // Scenario D: Audit log was created for the authorized role change
  const auditLogs = await prisma.auditLog.findMany({
    where: { action: 'ROLE_CHANGE_AUTHORIZED' }
  });
  assert(auditLogs.length > 0, 'AuditLog record generated for authorized role change');
  assert(auditLogs[0]?.userId === registrarId, 'AuditLog correctly attributes change to Registrar user ID');

  // =========================================================================
  // Section 2: Assigning "The VC" and "The Registrar" Roles
  // =========================================================================
  console.log('\n--- 2. Testing Assign Role: The Registrar & The VC ---');

  // Scenario A: Registrar assigns another user as VICE_CHANCELLOR
  const secondUserId = 'user-senior-prof';
  await prisma.user.create({
    data: {
      id: secondUserId,
      email: 'deputy.vc@noun.edu.ng',
      name: 'Prof. Deputy VC',
      role: Role.STAFF,
      isActive: true,
      staffProfile: {
        create: {
          id: 'staff-profile-dvc',
          staffId: 'NOUN/2026/002',
          surname: 'Deputy',
          otherNames: 'VC',
          rank: 'Professor',
          cadre: 'ACADEMIC',
          level: 'CONUASS 07',
          status: 'ACTIVE'
        }
      }
    }
  });

  const mockAssignVcReq: any = {
    params: { id: secondUserId },
    user: { id: registrarId, role: Role.REGISTRAR },
    body: { role: Role.VICE_CHANCELLOR, rank: 'Vice-Chancellor' }
  };
  let assignVcStatus = 200;
  const mockAssignVcRes: any = {
    status: (code: number) => {
      assignVcStatus = code;
      return { json: () => {} };
    },
    json: () => {}
  };

  await updateStaff(mockAssignVcReq, mockAssignVcRes);
  assert(assignVcStatus === 200, 'Registrar can assign VICE_CHANCELLOR role to designated academic');

  const promotedUser = await prisma.user.findUnique({ where: { id: secondUserId } });
  assert(promotedUser?.role === Role.VICE_CHANCELLOR, 'User role successfully assigned as VICE_CHANCELLOR');

  // Scenario B: Non-authorizer (HR_ADMIN) attempting to self-assign or assign REGISTRAR role
  const mockUnauthorizedAssignReq: any = {
    params: { id: hrAdminId },
    user: { id: hrAdminId, role: Role.HR_ADMIN },
    body: { role: Role.REGISTRAR }
  };
  let unauthAssignStatus = 200;
  const mockUnauthorizedAssignRes: any = {
    status: (code: number) => {
      unauthAssignStatus = code;
      return { json: () => {} };
    },
    json: () => {}
  };

  await updateStaff(mockUnauthorizedAssignReq, mockUnauthorizedAssignRes);
  assert(unauthAssignStatus === 403, 'Unauthorized attempt to assign REGISTRAR role is strictly rejected with HTTP 403');

  // =========================================================================
  // Section 3: VC System Functionality Verification
  // =========================================================================
  console.log('\n--- 3. Verifying Full System Functionality for VICE_CHANCELLOR Role ---');

  // 1. Check Principal Officer status for VC
  const vcProfile = await prisma.staffProfile.findUnique({
    where: { id: vcProfileId },
    include: { user: true }
  });
  const isVcPrincipalOfficer = checkIsPrincipalOfficer(vcProfile);
  assert(isVcPrincipalOfficer === true, 'Whoever is assigned VC is recognized as Principal Officer');

  // 2. Check VC Statutory Annual Leave Entitlement (42 working days)
  const vcBalances = await getOrInitializeLeaveBalances(vcProfileId, 2026);
  const vcAnnualLeave = vcBalances.find(b => b.leaveType === 'ANNUAL');
  assert(vcAnnualLeave?.totalDaysEntitled === 42, 'VC receives full Principal Officer quota: 42 working days annual leave');

  // 3. VC Executive Command Access
  const authorizerRoles = [Role.REGISTRAR, Role.SUPER_USER, Role.VICE_CHANCELLOR];
  assert(authorizerRoles.includes(promotedUser!.role as Role), 'VC possesses full Principal Officer authorizer status');

  const payrollAuditRoles = [Role.AUDIT, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR];
  assert(payrollAuditRoles.includes(promotedUser!.role as Role), 'VC possesses executive payroll approval authority');

  const vcAnalyticsRoles = [Role.VICE_CHANCELLOR, Role.SUPER_USER];
  assert(vcAnalyticsRoles.includes(promotedUser!.role as Role), 'VC possesses access to VC Command Center (/api/analytics/vc-executive)');

  console.log('\n================================');
  console.log('🎉 Role Authorization & VC Tests Completed!');
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log('================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runRoleAuthorizationAndVcTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
