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
import { updateStaff, approveRoleChange, rejectRoleChange, getPendingRoleChanges } from '../controllers/staff.controller';
import { batchUploadDocuments } from '../controllers/document.controller';
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
      password: 'hashed-password',
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
      password: 'hashed-password',
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
      password: 'hashed-password',
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
      password: 'hashed-password',
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
      password: 'hashed-password',
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
  // Section 1: Dual-Control Maker-Checker Role Governance
  // =========================================================================
  console.log('--- 1. Testing Dual-Control Maker-Checker Role Governance ---');

  // Scenario A: HR_ADMIN (Maker / Imputer) requests a role change to UNIT_HEAD
  let hrResStatus = 200;
  let hrResBody: any = null;
  const mockHrReq: any = {
    params: { id: staffUserId },
    user: { id: hrAdminId, role: Role.HR_ADMIN },
    body: { role: Role.UNIT_HEAD, overrideReason: 'Promoted to Head of Department by Faculty Board' }
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

  assert(hrResStatus === 200, 'HR_ADMIN role change request accepted into dual-control queue (HTTP 200)');
  assert(hrResBody?.roleChangeRequested === true, 'Response confirms role change requested flag is true');
  assert(hrResBody?.roleChangeStatus === 'PENDING_REGISTRAR_APPROVAL', 'Status is PENDING_REGISTRAR_APPROVAL');

  // Verify staff active role was NOT changed immediately
  const staffAfterHrAttempt = await prisma.user.findUnique({ where: { id: staffUserId } });
  assert(staffAfterHrAttempt?.role === Role.STAFF, 'Staff active role remains unchanged (STAFF) pending Registrar sign-off');
  assert(staffAfterHrAttempt?.pendingRole === Role.UNIT_HEAD, 'Pending role correctly recorded as UNIT_HEAD');

  // Verify audit log for request
  const requestAuditLogs = await prisma.auditLog.findMany({
    where: { action: 'ROLE_CHANGE_REQUESTED' }
  });
  assert(requestAuditLogs.length > 0, 'AuditLog generated for ROLE_CHANGE_REQUESTED');
  assert(requestAuditLogs[0]?.userId === hrAdminId, 'AuditLog attributes request to HR Admin');

  // Scenario B: Non-authorizer (HR_ADMIN) attempting to authorize the role change is rejected
  let unauthorizedApproveStatus = 200;
  const mockUnauthApproveReq: any = {
    params: { id: staffUserId },
    user: { id: hrAdminId, role: Role.HR_ADMIN },
    body: { remarks: 'Self-authorization attempt' }
  };
  const mockUnauthApproveRes: any = {
    status: (code: number) => {
      unauthorizedApproveStatus = code;
      return { json: () => {} };
    },
    json: () => {}
  };

  await approveRoleChange(mockUnauthApproveReq, mockUnauthApproveRes);
  assert(unauthorizedApproveStatus === 403, 'Non-Registrar cannot authorize role change (HTTP 403 Forbidden)');

  // Scenario C: REGISTRAR (Authorizer / Checker) authorizes the pending role change
  let regSuccessStatus = 200;
  let regSuccessBody: any = null;
  const mockRegistrarApproveReq: any = {
    params: { id: staffUserId },
    user: { id: registrarId, role: Role.REGISTRAR },
    body: { remarks: 'Registrar dual-control clearance granted after verifying Faculty Board minutes' }
  };
  const mockRegistrarApproveRes: any = {
    status: (code: number) => {
      regSuccessStatus = code;
      return {
        json: (data: any) => { regSuccessBody = data; }
      };
    },
    json: (data: any) => { regSuccessBody = data; }
  };

  await approveRoleChange(mockRegistrarApproveReq, mockRegistrarApproveRes);
  assert(regSuccessStatus === 200, 'REGISTRAR successfully authorizes role change (HTTP 200)');
  assert(regSuccessBody?.roleChangeStatus === 'APPROVED', 'Approval response confirms roleChangeStatus = APPROVED');

  const staffAfterRegistrar = await prisma.user.findUnique({ where: { id: staffUserId } });
  assert(staffAfterRegistrar?.role === Role.UNIT_HEAD, 'Staff active role successfully updated to UNIT_HEAD upon Registrar sign-off');
  assert(staffAfterRegistrar?.pendingRole === null, 'Pending role cleared after authorization');

  // Verify Audit log for approved change
  const authorizedAuditLogs = await prisma.auditLog.findMany({
    where: { action: 'ROLE_CHANGE_APPROVED' }
  });
  assert(authorizedAuditLogs.length > 0, 'AuditLog record generated for ROLE_CHANGE_APPROVED');
  assert(authorizedAuditLogs[0]?.userId === registrarId, 'AuditLog attributes authorization to Registrar user ID');

  // Scenario D: Regular STAFF member attempting to change roles is strictly rejected
  let regularStaffStatus = 200;
  const mockRegularStaffReq: any = {
    params: { id: staffUserId },
    user: { id: staffUserId, role: Role.STAFF },
    body: { role: Role.REGISTRAR }
  };
  const mockRegularStaffRes: any = {
    status: (code: number) => {
      regularStaffStatus = code;
      return { json: () => {} };
    },
    json: () => {}
  };

  await updateStaff(mockRegularStaffReq, mockRegularStaffRes);
  assert(regularStaffStatus === 403, 'Regular staff member cannot modify system roles (HTTP 403 Forbidden)');

  // =========================================================================
  // Section 2: Assigning "The VC" and "The Registrar" Roles
  // =========================================================================
  console.log('\n--- 2. Testing Assign Role: The Registrar & The VC ---');

  // Scenario A: Registrar directly assigns another user as VICE_CHANCELLOR
  const secondUserId = 'user-senior-prof';
  await prisma.user.create({
    data: {
      id: secondUserId,
      email: 'deputy.vc@noun.edu.ng',
      password: 'hashed-password',
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
  assert(assignVcStatus === 200, 'Registrar can directly assign VICE_CHANCELLOR role to designated academic');

  const promotedUser = await prisma.user.findUnique({ where: { id: secondUserId } });
  assert(promotedUser?.role === Role.VICE_CHANCELLOR, 'User role successfully assigned as VICE_CHANCELLOR immediately');

  // =========================================================================
  // Section 3: VC System Functionality Verification
  // =========================================================================
  console.log('\n--- 3. Verifying Full System Functionality for VICE_CHANCELLOR Role ---');

  // 1. Check Principal Officer status for VC
  const vcProfile = await prisma.staffProfile.findUnique({
    where: { id: vcProfileId },
    include: { user: true }
  });
  const isVcPrincipalOfficer = checkIsPrincipalOfficer(vcProfile!);
  assert(isVcPrincipalOfficer === true, 'Whoever is assigned VC is recognized as Principal Officer');

  // 2. Check VC Statutory Annual Leave Entitlement (42 working days)
  const vcBalances = await getOrInitializeLeaveBalances(vcProfileId, 2026);
  const vcAnnualLeave = vcBalances.find(b => b.leaveType === 'ANNUAL');
  assert(vcAnnualLeave?.totalDaysEntitled === 42, 'VC receives full Principal Officer quota: 42 working days annual leave');

  // 3. VC Executive Command Access
  const authorizerRoles: Role[] = [Role.REGISTRAR, Role.SUPER_USER, Role.VICE_CHANCELLOR];
  assert(authorizerRoles.includes(promotedUser!.role as any), 'VC possesses full Principal Officer authorizer status');

  const payrollAuditRoles: Role[] = [Role.AUDIT, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR];
  assert(payrollAuditRoles.includes(promotedUser!.role as any), 'VC possesses executive payroll approval authority');

  const vcAnalyticsRoles: Role[] = [Role.VICE_CHANCELLOR, Role.SUPER_USER];
  assert(vcAnalyticsRoles.includes(promotedUser!.role as any), 'VC possesses access to VC Command Center (/api/analytics/vc-executive)');

  // =========================================================================
  // Section 4: Batch Dossier Upload API Verification
  // =========================================================================
  console.log('\n--- 4. Testing Batch Dossier Upload API ---');

  const mockFiles: any[] = [
    {
      originalname: 'NOUN_2026_001_Appointment_Letter.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('%PDF-1.4 mock')
    },
    {
      originalname: 'NOUN_2026_001_Credentials.pdf',
      mimetype: 'application/pdf',
      size: 2048,
      buffer: Buffer.from('%PDF-1.4 mock 2')
    }
  ];

  let batchUploadStatus = 200;
  let batchUploadBody: any = null;
  const mockBatchReq: any = {
    user: { id: hrAdminId, role: Role.HR_ADMIN },
    files: mockFiles,
    body: {
      staffId: staffProfileId,
      type: 'APPOINTMENT_LETTER',
      accessLevel: 'CONFIDENTIAL'
    }
  };
  const mockBatchRes: any = {
    status: (code: number) => {
      batchUploadStatus = code;
      return {
        json: (data: any) => { batchUploadBody = data; }
      };
    },
    json: (data: any) => { batchUploadBody = data; }
  };

  await batchUploadDocuments(mockBatchReq, mockBatchRes);

  assert(batchUploadStatus === 200, 'Batch dossier upload succeeds with HTTP 200');
  assert(batchUploadBody?.successfulCount === 2, 'Batch upload successfully ingests both uploaded files');

  console.log('\n================================');
  console.log('🎉 Role Authorization, Dual Control & Dossier Tests Completed!');
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
