import assert from 'assert';
import prisma from '../prisma';
import {
  submitApplication,
  resubmitApplication,
  directorAction,
  registryAcknowledge,
  registrarDecision,
  getMyApplications,
  getDirectorQueue,
  getRegistryQueue,
  getRegistrarQueue,
  getMasterArchive,
} from '../controllers/applicationWorkflowController';

let passed = 0;
let failed = 0;

function it(desc: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          console.log(`✅ PASS: ${desc}`);
          passed++;
        })
        .catch((err) => {
          console.error(`❌ FAIL: ${desc}`);
          console.error(err);
          failed++;
        });
    } else {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    }
  } catch (err) {
    console.error(`❌ FAIL: ${desc}`);
    console.error(err);
    failed++;
  }
}

// Mock req/res helper
function createMockReqRes(options: {
  user?: { id: string; role: string; name?: string; email?: string };
  params?: any;
  body?: any;
  query?: any;
}) {
  const req: any = {
    user: options.user || { id: 'user-staff-1', role: 'STAFF', name: 'Dr. Jane Doe', email: 'jane.doe@noun.edu.ng' },
    params: options.params || {},
    body: options.body || {},
    query: options.query || {},
  };

  let statusCode = 200;
  let responseData: any = null;

  const res: any = {
    statusCode: 200,
    status(code: number) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      responseData = data;
      return this;
    },
  };

  return { req, res, getStatus: () => statusCode, getResponse: () => responseData };
}

async function runTestSuite() {
  console.log('\n🏛️  STARTING INSTITUTIONAL APPLICATION DOCKET WORKFLOW TEST SUITE...\n');

  // In-memory mock database store for clean zero-database test execution
  const mockDb = {
    users: new Map<string, any>(),
    staffProfiles: new Map<string, any>(),
    units: new Map<string, any>(),
    applications: new Map<string, any>(),
    revisions: [] as any[],
    archives: new Map<string, any>(),
  };

  // Seed baseline users
  mockDb.users.set('staff-101', { id: 'staff-101', name: 'Dr. Jane Staff', email: 'jane@noun.edu.ng', role: 'STAFF', isActive: true });
  mockDb.users.set('director-202', { id: 'director-202', name: 'Prof. Ade Director', email: 'director@noun.edu.ng', role: 'UNIT_HEAD', isActive: true });
  mockDb.users.set('registry-clerk-303', { id: 'registry-clerk-303', name: 'Mr. Inward Clerk', email: 'clerk@noun.edu.ng', role: 'REGISTRY_ADMIN', isActive: true });
  mockDb.users.set('registrar-404', { id: 'registrar-404', name: 'University Registrar', email: 'registrar@noun.edu.ng', role: 'REGISTRAR', isActive: true });

  mockDb.units.set('unit-cs', { id: 'unit-cs', name: 'Computer Science', headId: 'director-202' });
  mockDb.staffProfiles.set('prof-101', { id: 'prof-101', userId: 'staff-101', staffId: 'NOUN/2026/00142', unitId: 'unit-cs', rank: 'Senior Lecturer' });

  // Hook Prisma delegates
  const originalCount = prisma.institutionalApplication.count;
  const originalFindUnique = prisma.institutionalApplication.findUnique;
  const originalFindMany = prisma.institutionalApplication.findMany;
  const originalCreate = prisma.institutionalApplication.create;
  const originalUpdate = prisma.institutionalApplication.update;
  const originalTransaction = prisma.$transaction;

  (prisma as any).institutionalApplication.count = async (args: any) => {
    return mockDb.applications.size;
  };

  (prisma as any).institutionalApplication.findUnique = async ({ where }: any) => {
    if (where.id) {
      const app = mockDb.applications.get(where.id);
      if (!app) return null;
      return {
        ...app,
        applicant: mockDb.users.get(app.applicantId),
        director: mockDb.users.get(app.directorId),
        revisions: mockDb.revisions.filter((r) => r.applicationId === app.id),
      };
    }
    if (where.referenceNumber) {
      for (const app of mockDb.applications.values()) {
        if (app.referenceNumber === where.referenceNumber) return app;
      }
    }
    if (where.registryDocketNumber) {
      for (const app of mockDb.applications.values()) {
        if (app.registryDocketNumber === where.registryDocketNumber) return app;
      }
    }
    return null;
  };

  (prisma as any).institutionalApplication.findMany = async (args: any) => {
    let list = Array.from(mockDb.applications.values());
    if (args?.where?.applicantId) list = list.filter((a) => a.applicantId === args.where.applicantId);
    if (args?.where?.directorId) list = list.filter((a) => a.directorId === args.where.directorId);
    if (args?.where?.status) {
      if (typeof args.where.status === 'string') list = list.filter((a) => a.status === args.where.status);
      if (args.where.status.in) list = list.filter((a) => args.where.status.in.includes(a.status));
    }
    return list.map((a) => ({
      ...a,
      applicant: mockDb.users.get(a.applicantId),
      director: mockDb.users.get(a.directorId),
      revisions: mockDb.revisions.filter((r) => r.applicationId === a.id),
    }));
  };

  (prisma as any).user.findUnique = async ({ where }: any) => {
    return mockDb.users.get(where.id) || null;
  };

  (prisma as any).staffProfile.findUnique = async ({ where }: any) => {
    const prof = Array.from(mockDb.staffProfiles.values()).find((p) => p.userId === where.userId);
    if (!prof) return null;
    return { ...prof, unit: mockDb.units.get(prof.unitId) };
  };

  (prisma as any).$transaction = async (cb: any) => {
    const tx = {
      institutionalApplication: {
        create: async ({ data }: any) => {
          const created = { id: `app-${Date.now()}`, ...data, createdAt: new Date(), updatedAt: new Date() };
          mockDb.applications.set(created.id, created);
          return created;
        },
        update: async ({ where, data }: any) => {
          const existing = mockDb.applications.get(where.id);
          const updated = { ...existing, ...data, updatedAt: new Date() };
          mockDb.applications.set(where.id, updated);
          return updated;
        },
      },
      applicationRevisionHistory: {
        create: async ({ data }: any) => {
          const rev = { id: `rev-${Date.now()}`, ...data, createdAt: new Date() };
          mockDb.revisions.push(rev);
          return rev;
        },
      },
      registryApplicationArchive: {
        create: async ({ data }: any) => {
          const arc = { id: `arc-${Date.now()}`, ...data, archivedAt: new Date() };
          mockDb.archives.set(arc.applicationId, arc);
          return arc;
        },
      },
    };
    return cb(tx);
  };

  (prisma as any).registryApplicationArchive.findMany = async (args: any) => {
    const archives = Array.from(mockDb.archives.values()).map((arc) => {
      const app = mockDb.applications.get(arc.applicationId);
      return {
        ...arc,
        application: {
          ...app,
          applicant: mockDb.users.get(app.applicantId),
          director: mockDb.users.get(app.directorId),
        },
      };
    });
    return archives;
  };

  let createdAppId = '';
  let refNumber = '';

  // --- TIER 1 TESTS: SUBMISSION & RESUBMISSION ---
  console.log('--- 1. Testing Tier 1: Staff Submission & Directorate Auto-Resolution ---');

  await it('Staff successfully submits application with auto-resolved Director', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      user: mockDb.users.get('staff-101'),
      body: {
        subject: 'Application for Study Fellowship (2026/2027 Session)',
        category: 'STUDY_FELLOWSHIP',
        content: '# Formal Request\nI respectfully apply for fellowship sponsorship for my Ph.D. program.',
        attachmentUrls: ['https://storage.noun.edu.ng/fellowship_admission.pdf'],
      },
    });

    await submitApplication(req, res);

    assert.strictEqual(getStatus(), 201, 'Should return HTTP 201 Created');
    const data = getResponse()?.data;
    assert.ok(data?.id, 'Should create application with ID');
    assert.strictEqual(data?.directorId, 'director-202', 'Should auto-resolve Director from unit headId');
    assert.ok(data?.referenceNumber.startsWith('NOUN/'), 'Should format reference number correctly');
    assert.ok(!data?.referenceNumber.includes('APP'), 'Should not contain APP prefix');

    createdAppId = data.id;
    refNumber = data.referenceNumber;
  });

  await it('Rejects submission with missing mandatory subject or content', async () => {
    const { req, res, getStatus } = createMockReqRes({
      user: mockDb.users.get('staff-101'),
      body: { category: 'CONCURRENCE' },
    });
    await submitApplication(req, res);
    assert.strictEqual(getStatus(), 400);
  });

  // --- TIER 2 TESTS: DIRECTOR VETTING & CRITIQUE ---
  console.log('\n--- 2. Testing Tier 2: Directorate Vetting & Action ---');

  await it('Director requests rewrite with mandatory critique instructions', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      user: mockDb.users.get('director-202'),
      params: { id: createdAppId },
      body: {
        decision: 'REWRITE',
        directorRemarks: 'Please attach your departmental recommendation letter and proof of registration.',
      },
    });

    await directorAction(req, res);

    assert.strictEqual(getStatus(), 200);
    const data = getResponse()?.data;
    assert.strictEqual(data?.status, 'RETURNED_FOR_REWRITE');
    assert.strictEqual(data?.currentHolderRole, 'STAFF');
    assert.ok(data?.directorRemarks.includes('departmental recommendation'));
  });

  await it('Applicant successfully revises and resubmits application', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      user: mockDb.users.get('staff-101'),
      params: { id: createdAppId },
      body: {
        content: '# Revised Application\nAttached is my departmental letter and registration proof.',
        attachmentUrls: [
          'https://storage.noun.edu.ng/fellowship_admission.pdf',
          'https://storage.noun.edu.ng/hod_letter.pdf',
        ],
        applicantRemarks: 'Updated with requested departmental letter.',
      },
    });

    await resubmitApplication(req, res);

    assert.strictEqual(getStatus(), 200);
    const data = getResponse()?.data;
    assert.strictEqual(data?.status, 'SUBMITTED_TO_DIRECTOR');
    assert.strictEqual(data?.currentHolderRole, 'DIRECTOR');
    assert.strictEqual(data?.attachmentUrls.length, 2);
  });

  await it('Director officially recommends application to Registry with minutes', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      user: mockDb.users.get('director-202'),
      params: { id: createdAppId },
      body: {
        decision: 'RECOMMEND',
        directorRemarks: 'Strongly recommended. The staff member has fulfilled all requirements.',
      },
    });

    await directorAction(req, res);

    assert.strictEqual(getStatus(), 200);
    const data = getResponse()?.data;
    assert.strictEqual(data?.status, 'RECOMMENDED_TO_REGISTRY');
    assert.strictEqual(data?.currentHolderRole, 'REGISTRY_ADMIN');
    assert.ok(data?.directorRecommendedAt, 'directorRecommendedAt should be set');
  });

  // --- TIER 3 TESTS: REGISTRY DOCKETING & FOLIO ISSUANCE ---
  console.log('\n--- 3. Testing Tier 3: Registry Inward Desk (Docketing & Folio Stamping) ---');

  await it('Registry Inward Desk acknowledges application, stamps Folio, and routes to Registrar', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      user: mockDb.users.get('registry-clerk-303'),
      params: { id: createdAppId },
      body: { remarks: 'Entered into Central Inward Register Folio #12' },
    });

    await registryAcknowledge(req, res);

    assert.strictEqual(getStatus(), 200);
    const data = getResponse()?.data;
    assert.strictEqual(data?.status, 'DOCKETED_PENDING_REGISTRAR');
    assert.strictEqual(data?.currentHolderRole, 'REGISTRAR');
    assert.ok(data?.registryDocketNumber.startsWith('NOUN/REG/FOLIO/'), 'Folio number generated');
    assert.ok(data?.registryAcknowledgedAt, 'registryAcknowledgedAt should be set');
    assert.strictEqual(data?.registryClerkId, 'registry-clerk-303');
  });

  // --- TIER 4 TESTS: REGISTRAR DETERMINATION & MAKER-CHECKER ---
  console.log('\n--- 4. Testing Tier 4: Registrar Final Determination & Dual-Control Guard ---');

  await it('Enforces Dual-Control Maker-Checker: Self-authorization is strictly blocked', async () => {
    // If the registrar happens to be the applicant
    const { req, res, getStatus, getResponse } = createMockReqRes({
      user: { id: 'staff-101', role: 'REGISTRAR' },
      params: { id: createdAppId },
      body: { decision: 'APPROVED', registrarRemarks: 'Self approval' },
    });

    await registrarDecision(req, res);

    assert.strictEqual(getStatus(), 403, 'Should reject self-authorization with HTTP 403');
    assert.strictEqual(getResponse()?.code, 'ERR_MAKER_CHECKER_SELF_AUTHORIZATION');
  });

  await it('Registrar grants executive approval and permanently archives master record', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      user: mockDb.users.get('registrar-404'),
      params: { id: createdAppId },
      body: {
        decision: 'APPROVED',
        registrarRemarks: 'Approved for sponsorship under the 2026 Academic Staff Training Scheme.',
      },
    });

    await registrarDecision(req, res);

    assert.strictEqual(getStatus(), 200);
    const data = getResponse()?.data;
    assert.strictEqual(data?.status, 'APPROVED_BY_REGISTRAR');
    assert.strictEqual(data?.registrarId, 'registrar-404');
    assert.ok(data?.registrarDecidedAt);

    // Verify Master Archive entry was written
    const archive = mockDb.archives.get(createdAppId);
    assert.ok(archive, 'RegistryApplicationArchive record must exist');
    assert.strictEqual(archive?.finalStatus, 'APPROVED');
    assert.ok(archive?.fullAuditCopy?.digitalStamp, 'Must contain digital signature stamp');
  });

  // --- REJECTION FLOW & AUTO-ARCHIVING ---
  console.log('\n--- 5. Testing Director Rejection Flow & Master Archiving ---');

  await it('Director rejection immediately transitions to REJECTED_BY_DIRECTOR and auto-archives', async () => {
    // 1. Create a second test application
    const app2 = {
      id: 'app-second-999',
      referenceNumber: 'NOUN/2026/00999',
      applicantId: 'staff-101',
      directorId: 'director-202',
      subject: 'Special Administrative Appeal',
      category: 'ADMINISTRATIVE_APPEAL',
      content: 'Appeal request',
      attachmentUrls: [],
      status: 'SUBMITTED_TO_DIRECTOR',
      currentHolderRole: 'DIRECTOR',
      createdAt: new Date(),
    };
    mockDb.applications.set(app2.id, app2);

    const { req, res, getStatus, getResponse } = createMockReqRes({
      user: mockDb.users.get('director-202'),
      params: { id: app2.id },
      body: {
        decision: 'REJECT',
        directorRemarks: 'Not within statutory mandate of this Directorate.',
      },
    });

    await directorAction(req, res);

    assert.strictEqual(getStatus(), 200);
    const data = getResponse()?.data;
    assert.strictEqual(data?.status, 'REJECTED_BY_DIRECTOR');

    // Verify auto-archive
    const archive2 = mockDb.archives.get(app2.id);
    assert.ok(archive2, 'Archive must be created for Director rejection');
    assert.strictEqual(archive2?.finalStatus, 'REJECTED_BY_DIRECTOR');
  });

  // --- QUEUES & AUDIT ARCHIVE SEARCH ---
  console.log('\n--- 6. Testing Queues & Master Archive Search ---');

  await it('Staff can retrieve their personal application docket history', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      user: mockDb.users.get('staff-101'),
    });
    await getMyApplications(req, res);
    assert.strictEqual(getStatus(), 200);
    assert.strictEqual(getResponse()?.data?.length, 2);
  });

  await it('Master Archive allows search by academic year and category', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      user: mockDb.users.get('registry-clerk-303'),
      query: { academicYear: '2026', finalStatus: 'APPROVED' },
    });
    await getMasterArchive(req, res);
    assert.strictEqual(getStatus(), 200);
    assert.ok(getResponse()?.data?.length >= 1, 'Should find approved archive record');
  });

  // Restore mocks
  (prisma as any).institutionalApplication.count = originalCount;
  (prisma as any).institutionalApplication.findUnique = originalFindUnique;
  (prisma as any).institutionalApplication.findMany = originalFindMany;
  (prisma as any).institutionalApplication.create = originalCreate;
  (prisma as any).institutionalApplication.update = originalUpdate;
  (prisma as any).$transaction = originalTransaction;

  console.log('\n================================');
  console.log(`🎉 Application Docket Workflow Tests Completed!`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite failed unexpectedly:', err);
  process.exit(1);
});
