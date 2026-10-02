import assert from 'assert';
import prisma from '../prisma';
import {
  lodgeRequisition,
  acknowledgeRequisition,
  registrarAuthorizeRequisition,
  dispatchRequisition,
  returnRequisition,
  getRegistryInwardQueue,
  getRegistrarPendingQueue,
  getReadyForDispatchQueue,
  getMyRequisitions,
  getRequisitionById,
  getCustodyAuditLedger,
  getDigitalTranscript,
} from '../controllers/fileRequisition.controller';
import {
  FileRequisitionStatus,
  FileRequisitionUrgency,
  FileRequestedFormat,
  FileCustodyAction,
  Role,
} from '@prisma/client';

let passed = 0;
let failed = 0;

async function it(desc: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      await res;
    }
    console.log(`✅ PASS: ${desc}`);
    passed++;
  } catch (err: any) {
    console.error(`❌ FAIL: ${desc}`);
    console.error(err);
    failed++;
  }
}

function createMockReqRes(options: {
  user?: { id: string; role: Role; name?: string; email?: string };
  params?: any;
  body?: any;
  query?: any;
  headers?: any;
}) {
  const req: any = {
    user: options.user || {
      id: 'user-requester-1',
      role: Role.STAFF,
      name: 'Dr. Requester',
      email: 'requester@noun.edu.ng',
    },
    params: options.params || {},
    body: options.body || {},
    query: options.query || {},
    headers: options.headers || { 'x-forwarded-for': '192.168.1.50', 'user-agent': 'JestTestRunner/2.0' },
    socket: { remoteAddress: '127.0.0.1' },
  };

  let statusCode = 200;
  let responseData: any = null;
  let headersSent: Record<string, string> = {};

  const res: any = {
    statusCode: 200,
    status(code: number) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      headersSent[name] = value;
      return this;
    },
    json(data: any) {
      responseData = data;
      return this;
    },
    send(data: any) {
      responseData = data;
      return this;
    },
  };

  return {
    req,
    res,
    getStatus: () => statusCode,
    getResponse: () => responseData,
    getHeaders: () => headersSent,
  };
}

async function runTestSuite() {
  console.log('\n=============================================================');
  console.log('🏛️  NOUN-HRMS: FILE REQUISITION & CUSTODY TRACKING TEST SUITE');
  console.log('=============================================================\n');

  // In-memory mock database store
  const mockDb = {
    users: new Map<string, any>(),
    staffProfiles: new Map<string, any>(),
    fileRequisitions: new Map<string, any>(),
    auditTrails: [] as any[],
  };

  // Seed test users
  mockDb.users.set('user-staff-1', {
    id: 'user-staff-1',
    name: 'Prof. Subject Staff',
    email: 'subject@noun.edu.ng',
    role: Role.STAFF,
    isActive: true,
  });

  mockDb.users.set('user-requester-1', {
    id: 'user-requester-1',
    name: 'Dr. Jane Requester',
    email: 'requester@noun.edu.ng',
    role: Role.STAFF,
    isActive: true,
  });

  mockDb.users.set('user-registry-admin', {
    id: 'user-registry-admin',
    name: 'Registry Vault Custodian',
    email: 'vault@noun.edu.ng',
    role: Role.REGISTRY_ADMIN,
    isActive: true,
  });

  mockDb.users.set('user-registrar', {
    id: 'user-registrar',
    name: 'University Registrar',
    email: 'registrar@noun.edu.ng',
    role: Role.REGISTRAR,
    isActive: true,
  });

  // Seed staff profile for subject
  mockDb.staffProfiles.set('profile-subject-1', {
    id: 'profile-subject-1',
    userId: 'user-staff-1',
    staffId: 'NOUN/ACA/2026/0881',
    rank: 'Professor of Computing',
    level: 'CONUASS 07',
    step: '5',
    cadre: 'ACADEMIC',
    department: 'Computer Science',
    highestQualification: 'PHD',
    employmentCategory: 'PERMANENT',
    hasActiveDisciplinaryBlock: false,
    user: mockDb.users.get('user-staff-1'),
  });

  // Also seed profile for Registrar to test subject Maker-Checker rule
  mockDb.staffProfiles.set('profile-registrar', {
    id: 'profile-registrar',
    userId: 'user-registrar',
    staffId: 'NOUN/ADM/2026/0001',
    rank: 'University Registrar',
    level: 'CONTISS 15',
    hasActiveDisciplinaryBlock: false,
    user: mockDb.users.get('user-registrar'),
  });

  // Hook Prisma delegates
  const originalStaffProfileFindUnique = (prisma as any).staffProfile.findUnique;
  const originalFileRequisitionCount = (prisma as any).fileRequisition.count;
  const originalFileRequisitionFindUnique = (prisma as any).fileRequisition.findUnique;
  const originalFileRequisitionFindMany = (prisma as any).fileRequisition.findMany;
  const originalFileRequisitionCreate = (prisma as any).fileRequisition.create;
  const originalFileRequisitionUpdate = (prisma as any).fileRequisition.update;
  const originalFileCustodyAuditTrailCreate = (prisma as any).fileCustodyAuditTrail.create;
  const originalFileCustodyAuditTrailFindMany = (prisma as any).fileCustodyAuditTrail.findMany;
  const originalTransaction = prisma.$transaction;
  const originalUserFindMany = prisma.user.findMany;
  const originalNotificationCreate = prisma.notification.create;

  (prisma as any).staffProfile.findUnique = async ({ where, include }: any) => {
    const prof = mockDb.staffProfiles.get(where.id);
    if (!prof) return null;
    return {
      ...prof,
      user: {
        ...mockDb.users.get(prof.userId),
        transferredStaff: [],
      },
      unit: { name: 'Faculty of Science', code: 'SCI', type: 'FACULTY' },
      studyCenter: { name: 'Abuja Model Study Center', code: 'ABJ01' },
    };
  };

  (prisma as any).fileRequisition.count = async (args: any) => {
    return mockDb.fileRequisitions.size;
  };

  (prisma as any).fileRequisition.findUnique = async ({ where }: any) => {
    if (where.requisitionNumber) {
      for (const r of mockDb.fileRequisitions.values()) {
        if (r.requisitionNumber === where.requisitionNumber) return r;
      }
      return null;
    }
    if (where.dispatchReceiptNumber) {
      for (const r of mockDb.fileRequisitions.values()) {
        if (r.dispatchReceiptNumber === where.dispatchReceiptNumber) return r;
      }
      return null;
    }
    if (where.id) {
      const r = mockDb.fileRequisitions.get(where.id);
      if (!r) return null;
      return {
        ...r,
        staffProfile: mockDb.staffProfiles.get(r.staffProfileId),
        requester: mockDb.users.get(r.requesterId),
        acknowledgedBy: r.acknowledgedById ? mockDb.users.get(r.acknowledgedById) : null,
        authorizedBy: r.authorizedById ? mockDb.users.get(r.authorizedById) : null,
        dispatchedBy: r.dispatchedById ? mockDb.users.get(r.dispatchedById) : null,
        receivingOfficer: r.receivingOfficerId ? mockDb.users.get(r.receivingOfficerId) : null,
        custodyAuditTrail: mockDb.auditTrails.filter((a) => a.requisitionId === r.id),
      };
    }
    return null;
  };

  (prisma as any).fileRequisition.findMany = async (args: any) => {
    const results = Array.from(mockDb.fileRequisitions.values()).map((r) => ({
      ...r,
      staffProfile: mockDb.staffProfiles.get(r.staffProfileId),
      requester: mockDb.users.get(r.requesterId),
      acknowledgedBy: r.acknowledgedById ? mockDb.users.get(r.acknowledgedById) : null,
      authorizedBy: r.authorizedById ? mockDb.users.get(r.authorizedById) : null,
      dispatchedBy: r.dispatchedById ? mockDb.users.get(r.dispatchedById) : null,
    }));

    if (args?.where?.requesterId) {
      return results.filter((r) => r.requesterId === args.where.requesterId);
    }
    if (args?.where?.status) {
      if (typeof args.where.status === 'object' && args.where.status.in) {
        return results.filter((r) => args.where.status.in.includes(r.status));
      }
      return results.filter((r) => r.status === args.where.status);
    }
    return results;
  };

  (prisma as any).fileCustodyAuditTrail.findMany = async (args: any) => {
    return mockDb.auditTrails.map((a) => {
      const r = mockDb.fileRequisitions.get(a.requisitionId);
      return {
        ...a,
        actor: mockDb.users.get(a.actorId),
        requisition: r
          ? {
              ...r,
              staffProfile: mockDb.staffProfiles.get(r.staffProfileId),
              requester: mockDb.users.get(r.requesterId),
            }
          : null,
      };
    });
  };

  (prisma as any).$transaction = async (fn: any) => {
    const tx = {
      fileRequisition: {
        create: async ({ data }: any) => {
          const id = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const created = {
            id,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            staffProfile: mockDb.staffProfiles.get(data.staffProfileId),
            requester: mockDb.users.get(data.requesterId),
          };
          mockDb.fileRequisitions.set(id, created);
          return created;
        },
        update: async ({ where, data }: any) => {
          const existing = mockDb.fileRequisitions.get(where.id);
          if (!existing) throw new Error('Not found');
          const updated = { ...existing, ...data, updatedAt: new Date() };
          mockDb.fileRequisitions.set(where.id, updated);
          return updated;
        },
      },
      fileCustodyAuditTrail: {
        create: async ({ data }: any) => {
          const audit = {
            id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            ...data,
            createdAt: new Date(),
          };
          mockDb.auditTrails.push(audit);
          return audit;
        },
      },
    };
    return fn(tx);
  };

  (prisma as any).user.findMany = async () => [];
  (prisma as any).notification.create = async () => ({ id: 'notif-1' });
  (prisma as any).fcmToken = { findMany: async () => [] };

  try {
    let createdReqId = '';
    let reqNumber = '';

    // ─────────────────────────────────────────────────────────────────────────
    // TEST TIER 1: LODGE REQUISITION
    // ─────────────────────────────────────────────────────────────────────────
    await it('Tier 1: Lodges a file requisition, generates NOUN/REQ/FILE reference, and sets SUBMITTED', async () => {
      const { req, res, getStatus, getResponse } = createMockReqRes({
        user: { id: 'user-requester-1', role: Role.STAFF, name: 'Dr. Jane Requester' },
        body: {
          staffProfileId: 'profile-subject-1',
          requesterDepartment: 'Directorate of Academic Planning',
          purposeOfRequest: 'Verification of credentials for National Universities Commission (NUC) accreditation.',
          urgencyLevel: 'URGENT',
          requestedFileFormat: 'BOTH',
          expectedReturnDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        },
      });

      await lodgeRequisition(req, res);

      assert.strictEqual(getStatus(), 201, `Expected status 201, got ${getStatus()}`);
      const data = getResponse().data;
      assert(data.id, 'Expected generated UUID');
      assert(data.requisitionNumber.startsWith('NOUN/REQ/FILE/'), 'Expected NOUN/REQ/FILE pattern');
      assert.strictEqual(data.status, FileRequisitionStatus.SUBMITTED);
      assert.strictEqual(data.urgencyLevel, 'URGENT');
      assert.strictEqual(data.requestedFileFormat, 'BOTH');

      createdReqId = data.id;
      reqNumber = data.requisitionNumber;

      // Verify audit trail entry
      const audit = mockDb.auditTrails.find((a) => a.requisitionId === createdReqId);
      assert(audit, 'Expected audit trail logged');
      assert.strictEqual(audit.action, FileCustodyAction.REQUISITION_SUBMITTED);
      assert.strictEqual(audit.actorId, 'user-requester-1');
    });

    await it('Tier 1: Validation fails with 400 when required fields are missing', async () => {
      const { req, res, getStatus } = createMockReqRes({
        user: { id: 'user-requester-1', role: Role.STAFF },
        body: {
          staffProfileId: 'profile-subject-1',
          // missing requesterDepartment and purposeOfRequest
        },
      });

      await lodgeRequisition(req, res);
      assert.strictEqual(getStatus(), 400);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST TIER 2: REGISTRY INTAKE & ACKNOWLEDGMENT
    // ─────────────────────────────────────────────────────────────────────────
    await it('Tier 2: Registry Acknowledges receipt, assigns vault folio reference, and forwards to Registrar', async () => {
      const { req, res, getStatus, getResponse } = createMockReqRes({
        user: { id: 'user-registry-admin', role: Role.REGISTRY_ADMIN, name: 'Registry Custodian' },
        params: { id: createdReqId },
        body: {
          action: 'ACKNOWLEDGE',
          registryFolioReference: 'NOUN/FOLIO/VAULT/VOL-III/091',
          adminAcknowledgmentRemarks: 'Physical dossier retrieved from Archive Section B. Condition: Good.',
        },
      });

      await acknowledgeRequisition(req, res);

      assert.strictEqual(getStatus(), 200);
      const data = getResponse().data;
      assert.strictEqual(data.status, FileRequisitionStatus.ACKNOWLEDGED_PENDING_REGISTRAR);
      assert.strictEqual(data.registryFolioReference, 'NOUN/FOLIO/VAULT/VOL-III/091');
      assert.strictEqual(data.acknowledgedById, 'user-registry-admin');

      const audit = mockDb.auditTrails.find((a) => a.action === FileCustodyAction.ACKNOWLEDGED_AND_FORWARDED);
      assert(audit, 'Expected ACKNOWLEDGED_AND_FORWARDED audit trail');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST TIER 3: REGISTRAR EXECUTIVE AUTHORIZATION & MAKER-CHECKER
    // ─────────────────────────────────────────────────────────────────────────
    await it('Tier 3 [Maker-Checker]: Requester cannot authorize their own requisition -> 403 Forbidden', async () => {
      const { req, res, getStatus, getResponse } = createMockReqRes({
        user: { id: 'user-requester-1', role: Role.REGISTRAR }, // Even if they claim Registrar role
        params: { id: createdReqId },
        body: {
          action: 'APPROVE',
          registrarRemarks: 'Self-approving my own request.',
        },
      });

      await registrarAuthorizeRequisition(req, res);

      assert.strictEqual(getStatus(), 403);
      assert(
        getResponse().error.includes('Maker-Checker Violation'),
        'Expected Maker-Checker violation message'
      );
    });

    await it('Tier 3 [Maker-Checker]: Registrar cannot authorize release of their own personnel file -> 403 Forbidden', async () => {
      // Create a requisition targeting the Registrar's own profile
      const reqIdSelf = 'req-registrar-self';
      mockDb.fileRequisitions.set(reqIdSelf, {
        id: reqIdSelf,
        requisitionNumber: 'NOUN/REQ/FILE/2026/00999',
        staffProfileId: 'profile-registrar', // Registrar is the subject
        requesterId: 'another-user',
        status: FileRequisitionStatus.ACKNOWLEDGED_PENDING_REGISTRAR,
      });

      const { req, res, getStatus, getResponse } = createMockReqRes({
        user: { id: 'user-registrar', role: Role.REGISTRAR },
        params: { id: reqIdSelf },
        body: {
          action: 'APPROVE',
          registrarRemarks: 'Approving file release concerning myself.',
        },
      });

      await registrarAuthorizeRequisition(req, res);

      assert.strictEqual(getStatus(), 403);
      assert(
        getResponse().error.includes('Maker-Checker Violation'),
        'Expected Maker-Checker violation message for self-subject'
      );
    });

    await it('Tier 3: Neutral Registrar approves release -> AUTHORIZED_BY_REGISTRAR', async () => {
      const { req, res, getStatus, getResponse } = createMockReqRes({
        user: { id: 'user-registrar', role: Role.REGISTRAR, name: 'University Registrar' },
        params: { id: createdReqId },
        body: {
          action: 'APPROVE',
          registrarRemarks: 'Executive clearance granted for NUC accreditation review. Strict custody duration applies.',
        },
      });

      await registrarAuthorizeRequisition(req, res);

      assert.strictEqual(getStatus(), 200);
      const data = getResponse().data;
      assert.strictEqual(data.status, FileRequisitionStatus.AUTHORIZED_BY_REGISTRAR);
      assert.strictEqual(data.authorizedById, 'user-registrar');
      assert(data.authorizedAt);

      const audit = mockDb.auditTrails.find((a) => a.action === FileCustodyAction.REGISTRAR_AUTHORIZED);
      assert(audit, 'Expected REGISTRAR_AUTHORIZED audit log');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST TIER 4: REGISTRY PHYSICAL DISPATCH & DIGITAL TOKEN
    // ─────────────────────────────────────────────────────────────────────────
    let generatedToken = '';
    let dispatchReceipt = '';

    await it('Tier 4: Registry dispatches file, generates NOUN/DISPATCH receipt & secure digital token', async () => {
      const { req, res, getStatus, getResponse } = createMockReqRes({
        user: { id: 'user-registry-admin', role: Role.REGISTRY_ADMIN },
        params: { id: createdReqId },
        body: {
          trackingNotes: 'Physical file delivered to DAP office. Digital single-session view activated for 48 hours.',
          digitalAccessHours: 48,
        },
      });

      await dispatchRequisition(req, res);

      assert.strictEqual(getStatus(), 200);
      const data = getResponse().data;
      assert.strictEqual(data.status, FileRequisitionStatus.DISPATCHED_RELEASED);
      assert(data.dispatchReceiptNumber.startsWith('NOUN/DISPATCH/'), 'Expected NOUN/DISPATCH pattern');
      assert(data.digitalAccessToken, 'Expected digital access token for BOTH format');
      assert(data.digitalAccessExpiresAt, 'Expected digital expiration timestamp');

      generatedToken = data.digitalAccessToken;
      dispatchReceipt = data.dispatchReceiptNumber;

      const audit = mockDb.auditTrails.find((a) => a.action === FileCustodyAction.FILE_DISPATCHED);
      assert(audit, 'Expected FILE_DISPATCHED audit trail');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST SECURE DIGITAL TRANSCRIPT VIEWER
    // ─────────────────────────────────────────────────────────────────────────
    await it('Digital Viewer: Unauthenticated or invalid token is blocked with 403 Forbidden', async () => {
      const { req, res, getStatus } = createMockReqRes({
        user: { id: 'random-unauthorized-user', role: Role.STAFF },
        params: { id: createdReqId },
        query: { token: 'invalid-fake-token-123' },
      });

      await getDigitalTranscript(req, res);
      assert.strictEqual(getStatus(), 403);
    });

    await it('Digital Viewer: Valid digital access token returns sanitized confidential staff dossier', async () => {
      const { req, res, getStatus, getResponse } = createMockReqRes({
        user: { id: 'user-requester-1', role: Role.STAFF },
        params: { id: createdReqId },
        query: { token: generatedToken },
      });

      await getDigitalTranscript(req, res);

      assert.strictEqual(getStatus(), 200);
      const data = getResponse().data;
      assert.strictEqual(data.profile.staffId, 'NOUN/ACA/2026/0881');
      assert.strictEqual(data.profile.rank, 'Professor of Computing');
      assert.strictEqual(data.profile.disciplinaryClearance, 'CLEARED');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST TIER 5: FILE RETURN & RE-ARCHIVING
    // ─────────────────────────────────────────────────────────────────────────
    await it('Tier 5: Logs physical file return to Vault, sets RETURNED_ARCHIVED, and revokes digital token', async () => {
      const { req, res, getStatus, getResponse } = createMockReqRes({
        user: { id: 'user-registry-admin', role: Role.REGISTRY_ADMIN },
        params: { id: createdReqId },
        body: {
          returnNotes: 'File returned intact with all folios verified. Restored to Vault Section B.',
        },
      });

      await returnRequisition(req, res);

      assert.strictEqual(getStatus(), 200);
      const data = getResponse().data;
      assert.strictEqual(data.status, FileRequisitionStatus.RETURNED_ARCHIVED);
      assert(data.returnedAt);
      assert.strictEqual(data.receivingOfficerId, 'user-registry-admin');
      assert.strictEqual(data.digitalAccessToken, null, 'Digital token must be revoked upon return');

      const audit = mockDb.auditTrails.find((a) => a.action === FileCustodyAction.FILE_RETURN_LOGGED);
      assert(audit, 'Expected FILE_RETURN_LOGGED audit log');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST QUEUES & AUDIT LEDGER EXPORT
    // ─────────────────────────────────────────────────────────────────────────
    await it('Queues & Ledger: getCustodyAuditLedger exports valid CSV format for University Council', async () => {
      const { req, res, getStatus, getResponse, getHeaders } = createMockReqRes({
        user: { id: 'user-registrar', role: Role.REGISTRAR },
        query: { format: 'csv' },
      });

      await getCustodyAuditLedger(req, res);

      assert.strictEqual(getStatus(), 200);
      assert.strictEqual(getHeaders()['Content-Type'], 'text/csv');
      const csv = getResponse();
      assert(typeof csv === 'string', 'Expected string CSV output');
      assert(csv.includes('Timestamp,Requisition No,Subject Staff ID'), 'Expected standard CSV headers');
      assert(csv.includes(reqNumber), 'Expected requisition number in CSV rows');
    });

    await it('Queues & Ledger: getMyRequisitions returns list for logged-in applicant', async () => {
      const { req, res, getStatus, getResponse } = createMockReqRes({
        user: { id: 'user-requester-1', role: Role.STAFF },
      });

      await getMyRequisitions(req, res);

      assert.strictEqual(getStatus(), 200);
      assert(getResponse().data.length >= 1);
      assert.strictEqual(getResponse().data[0].id, createdReqId);
    });

    await it('Queues & Ledger: getRequisitionById returns full relational timeline', async () => {
      const { req, res, getStatus, getResponse } = createMockReqRes({
        user: { id: 'user-registry-admin', role: Role.REGISTRY_ADMIN },
        params: { id: createdReqId },
      });

      await getRequisitionById(req, res);

      assert.strictEqual(getStatus(), 200);
      const data = getResponse().data;
      assert.strictEqual(data.custodyAuditTrail.length, 5, 'Expected 5 chronological custody actions');
    });

  } finally {
    // Restore Prisma methods
    (prisma as any).staffProfile.findUnique = originalStaffProfileFindUnique;
    (prisma as any).fileRequisition.count = originalFileRequisitionCount;
    (prisma as any).fileRequisition.findUnique = originalFileRequisitionFindUnique;
    (prisma as any).fileRequisition.findMany = originalFileRequisitionFindMany;
    (prisma as any).fileCustodyAuditTrail.findMany = originalFileCustodyAuditTrailFindMany;
    prisma.$transaction = originalTransaction;
    prisma.user.findMany = originalUserFindMany;
    prisma.notification.create = originalNotificationCreate;
  }

  console.log('\n-------------------------------------------------------------');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('-------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
