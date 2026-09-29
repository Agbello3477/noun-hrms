import { enforceMakerChecker } from '../middleware/enforceMakerChecker';
import { authorizeStaffPostingHandler } from '../controllers/registrarPostingController';
import { clearStaffFileHandler } from '../controllers/registrarFileController';
import prisma from '../lib/prisma';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
    failed++;
  }
}

async function runTests() {
  console.log('🧪 Starting Dual-Control Maker-Checker Middleware & Controller Tests...\n');

  // Test 1: enforceMakerChecker rejects unauthenticated requests
  {
    const middleware = enforceMakerChecker({
      entityType: 'staffPosting',
      paramKey: 'id',
      imputerField: 'imputedById',
      statusField: 'status',
      allowedStatuses: ['PENDING_REGISTRAR_AUTHORIZATION']
    });

    const req: any = { params: { id: 'test-id' } };
    let statusSent = 0;
    let jsonSent: any = null;
    const res: any = {
      status: (code: number) => {
        statusSent = code;
        return {
          json: (data: any) => { jsonSent = data; }
        };
      }
    };
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });

    assert(statusSent === 401 && jsonSent?.success === false, 'Rejects unauthenticated request with HTTP 401');
    assert(!nextCalled, 'Next() is not called on unauthenticated request');
  }

  // Test 2: enforceMakerChecker rejects missing target ID param
  {
    const middleware = enforceMakerChecker({
      entityType: 'staffPosting',
      paramKey: 'id'
    });

    const req: any = { user: { id: 'authorizer-1', role: 'REGISTRAR' }, params: {} };
    let statusSent = 0;
    let jsonSent: any = null;
    const res: any = {
      status: (code: number) => {
        statusSent = code;
        return { json: (data: any) => { jsonSent = data; } };
      }
    };
    await middleware(req, res, () => {});

    assert(statusSent === 400 && jsonSent?.error?.includes('Missing target parameter'), 'Rejects missing route parameter with HTTP 400');
  }

  // Test 3: enforceMakerChecker rejects invalid entity type
  {
    const middleware = enforceMakerChecker({
      entityType: 'nonExistentEntity' as any,
      paramKey: 'id'
    });

    const req: any = { user: { id: 'authorizer-1', role: 'REGISTRAR' }, params: { id: '123' } };
    let statusSent = 0;
    const res: any = {
      status: (code: number) => {
        statusSent = code;
        return { json: () => {} };
      }
    };
    await middleware(req, res, () => {});

    assert(statusSent === 500, 'Returns HTTP 500 when database entity delegate is invalid');
  }

  // Test 4: Dual-Control Self-Authorization Prevention
  {
    const middleware = enforceMakerChecker({
      entityType: 'staffPosting',
      paramKey: 'id',
      imputerField: 'imputedById',
      statusField: 'status',
      allowedStatuses: ['PENDING_REGISTRAR_AUTHORIZATION']
    });

    // Mock findUnique to return a posting record where imputedById === currentUserId
    const originalFindUnique = (prisma as any).staffPosting?.findUnique;
    (prisma as any).staffPosting.findUnique = async () => ({
      id: 'posting-123',
      imputedById: 'officer-456',
      status: 'PENDING_REGISTRAR_AUTHORIZATION'
    });

    const req: any = {
      user: { id: 'officer-456', role: 'REGISTRAR' },
      params: { id: 'posting-123' }
    };
    let statusSent = 0;
    let jsonSent: any = null;
    const res: any = {
      status: (code: number) => {
        statusSent = code;
        return { json: (data: any) => { jsonSent = data; } };
      }
    };
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });

    assert(statusSent === 403, 'Rejects self-authorization with HTTP 403 Forbidden');
    assert(jsonSent?.code === 'ERR_MAKER_CHECKER_SELF_AUTHORIZATION', 'Returns ERR_MAKER_CHECKER_SELF_AUTHORIZATION error code');
    assert(jsonSent?.error?.includes('Dual-control violation'), 'Contains dual-control violation error message');
    assert(!nextCalled, 'Next() is not called on self-authorization attempt');

    (prisma as any).staffPosting.findUnique = originalFindUnique;
  }

  // Test 5: Rejects record when not in allowed pending status (HTTP 409 Conflict)
  {
    const middleware = enforceMakerChecker({
      entityType: 'staffPosting',
      paramKey: 'id',
      imputerField: 'imputedById',
      statusField: 'status',
      allowedStatuses: ['PENDING_REGISTRAR_AUTHORIZATION']
    });

    const originalFindUnique = (prisma as any).staffPosting?.findUnique;
    (prisma as any).staffPosting.findUnique = async () => ({
      id: 'posting-123',
      imputedById: 'imputer-789',
      status: 'AUTHORIZED' // Already authorized!
    });

    const req: any = {
      user: { id: 'authorizer-999', role: 'REGISTRAR' },
      params: { id: 'posting-123' }
    };
    let statusSent = 0;
    let jsonSent: any = null;
    const res: any = {
      status: (code: number) => {
        statusSent = code;
        return { json: (data: any) => { jsonSent = data; } };
      }
    };
    await middleware(req, res, () => {});

    assert(statusSent === 409, 'Returns HTTP 409 Conflict when record is not in allowed pending state');
    assert(jsonSent?.error?.includes('Action disallowed'), 'Explains record status is not pending authorization');

    (prisma as any).staffPosting.findUnique = originalFindUnique;
  }

  // Test 6: Successful Dual-Control Clearance & verifiedRecord attachment
  {
    const middleware = enforceMakerChecker({
      entityType: 'staffPosting',
      paramKey: 'id',
      imputerField: 'imputedById',
      statusField: 'status',
      allowedStatuses: ['PENDING_REGISTRAR_AUTHORIZATION']
    });

    const mockRecord = {
      id: 'posting-777',
      staffId: 'staff-100',
      imputedById: 'clerk-imputer',
      status: 'PENDING_REGISTRAR_AUTHORIZATION',
      destinationStationId: 'unit-dept-cs'
    };

    const originalFindUnique = (prisma as any).staffPosting?.findUnique;
    (prisma as any).staffPosting.findUnique = async () => mockRecord;

    const req: any = {
      user: { id: 'registrar-checker', role: 'REGISTRAR' },
      params: { id: 'posting-777' }
    };
    let nextCalled = false;
    const res: any = { status: () => ({ json: () => {} }) };

    await middleware(req, res, () => { nextCalled = true; });

    assert(nextCalled, 'Next() successfully called when imputer !== authorizer and status is valid');
    assert(req.verifiedRecord?.id === 'posting-777', 'Attaches verifiedRecord to request for controller efficiency');

    (prisma as any).staffPosting.findUnique = originalFindUnique;
  }

  // Test 7: authorizeStaffPostingHandler validates decision input
  {
    const req: any = {
      user: { id: 'registrar-checker' },
      verifiedRecord: { id: 'posting-777' },
      body: { decision: 'INVALID_DECISION' }
    };
    let statusSent = 0;
    let jsonSent: any = null;
    const res: any = {
      status: (code: number) => {
        statusSent = code;
        return { json: (data: any) => { jsonSent = data; } };
      }
    };
    await authorizeStaffPostingHandler(req, res);

    assert(statusSent === 400 && jsonSent?.error?.includes("must be 'APPROVED' or 'REJECTED'"), 'Posting handler validates decision parameter (HTTP 400)');
  }

  // Test 8: authorizeStaffPostingHandler commits transaction and audit trail
  {
    let updatedPostingData: any = null;
    let auditTrailData: any = null;

    const originalTransaction = prisma.$transaction;
    (prisma as any).$transaction = async (cb: any) => {
      const mockTx = {
        staffPosting: {
          update: async ({ data }: any) => {
            updatedPostingData = data;
            return { id: 'posting-777', ...data };
          }
        },
        staffProfile: {
          findFirst: async () => ({ id: 'prof-1', staffId: 'staff-100', lastPromotionDate: null }),
          update: async () => ({ id: 'prof-1' })
        },
        authorizationAuditTrail: {
          create: async ({ data }: any) => {
            auditTrailData = data;
            return { id: 'audit-1', ...data };
          }
        }
      };
      return cb(mockTx);
    };

    const req: any = {
      user: { id: 'registrar-checker' },
      verifiedRecord: {
        id: 'posting-777',
        staffId: 'staff-100',
        imputedById: 'clerk-imputer',
        destinationStationId: 'unit-dept-cs'
      },
      body: { decision: 'APPROVED', remarks: 'Ratified by Council' }
    };
    let statusSent = 0;
    let jsonSent: any = null;
    const res: any = {
      status: (code: number) => {
        statusSent = code;
        return { json: (data: any) => { jsonSent = data; } };
      }
    };

    await authorizeStaffPostingHandler(req, res);

    assert(statusSent === 200 && jsonSent?.success === true, 'Posting handler returns HTTP 200 on successful authorization');
    assert(updatedPostingData?.status === 'AUTHORIZED', 'Posting status transitioned to AUTHORIZED');
    assert(updatedPostingData?.authorizedById === 'registrar-checker', 'Posting authorizedById set to authorizer ID');
    assert(auditTrailData?.entityType === 'STAFF_POSTING', 'AuthorizationAuditTrail entityType set to STAFF_POSTING');
    assert(auditTrailData?.authorizerId === 'registrar-checker', 'AuthorizationAuditTrail captures authorizer');
    assert(auditTrailData?.imputerId === 'clerk-imputer', 'AuthorizationAuditTrail preserves original imputer ID');

    (prisma as any).$transaction = originalTransaction;
  }

  // Test 9: clearStaffFileHandler commits clearance and activates account
  {
    let updatedProfileData: any = null;
    let updatedUserData: any = null;
    let auditTrailData: any = null;

    const originalTransaction = prisma.$transaction;
    (prisma as any).$transaction = async (cb: any) => {
      const mockTx = {
        staffProfile: {
          update: async ({ data }: any) => {
            updatedProfileData = data;
            return { id: 'prof-2', ...data };
          }
        },
        user: {
          update: async ({ data }: any) => {
            updatedUserData = data;
            return { id: 'user-2', ...data };
          }
        },
        authorizationAuditTrail: {
          create: async ({ data }: any) => {
            auditTrailData = data;
            return { id: 'audit-2', ...data };
          }
        }
      };
      return cb(mockTx);
    };

    const req: any = {
      user: { id: 'registrar-checker', role: 'REGISTRAR' },
      verifiedRecord: {
        id: 'prof-2',
        userId: 'user-2',
        staffId: 'NOUN/2026/999',
        createdById: 'hr-clerk'
      },
      body: { remarks: 'Digital dossier verified' }
    };
    let statusSent = 0;
    let jsonSent: any = null;
    const res: any = {
      status: (code: number) => {
        statusSent = code;
        return { json: (data: any) => { jsonSent = data; } };
      }
    };

    await clearStaffFileHandler(req, res);

    assert(statusSent === 200 && jsonSent?.success === true, 'File clearance handler returns HTTP 200');
    assert(updatedProfileData?.accountStatus === 'CLEARED_ACTIVE', 'StaffProfile accountStatus transitioned to CLEARED_ACTIVE');
    assert(updatedProfileData?.isActivated === true, 'StaffProfile isActivated marked true');
    assert(updatedUserData?.isActive === true, 'User account activated (isActive = true)');
    assert(auditTrailData?.entityType === 'FILE_CREATION', 'AuthorizationAuditTrail entityType is FILE_CREATION');
    assert(auditTrailData?.imputerId === 'hr-clerk', 'AuthorizationAuditTrail records original imputer');

    (prisma as any).$transaction = originalTransaction;
  }

  console.log('\n================================');
  console.log(`🎉 Maker-Checker Guard & Controller Tests Completed!`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test run failed unexpectedly:', err);
  process.exit(1);
});
