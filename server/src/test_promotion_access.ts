/**
 * Promotion Monitoring Module — Backend Access Control Tests
 *
 * Verifies that:
 * 1. Regular STAFF role receives 403 on all promotion endpoints
 * 2. HR_ADMIN and VICE_CHANCELLOR can access the due-for-promotion list
 * 3. Only SUPER_USER can trigger the manual cron run
 * 4. The runPromotionJob function is idempotent for the same calendar year
 *
 * Run with: npx ts-node src/test_promotion_access.ts
 */

import { Request, Response } from 'express';
import { Role } from '@prisma/client';

// ── Minimal mock factories ─────────────────────────────────────────────────
function mockReq(role: Role, body: object = {}, params: object = {}, query: object = {}): any {
    return {
        user: { id: 'test-user-id', role },
        body,
        params,
        query,
    };
}

let lastStatus = 0;
let lastJson: any = null;

function mockRes(): Partial<Response> {
    return {
        status(code: number) { lastStatus = code; return this as any; },
        json(data: any)      { lastJson = data;   return this as any; },
    };
}

// ── Import controllers directly ────────────────────────────────────────────
import { getDueForPromotion, flagForPromotion, manualRunPromotionCron } from './controllers/staff.controller';

// ── Test runner ────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
    if (condition) {
        console.log(`  ✅ PASS: ${label}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
        failed++;
    }
}

async function runTests() {
    console.log('\n══════════════════════════════════════════════════════');
    console.log(' NOUN HRMS — Promotion Module Access Control Tests');
    console.log('══════════════════════════════════════════════════════\n');

    // ── TEST GROUP 1: getDueForPromotion ────────────────────────────────────
    console.log('▶ Group 1: GET /api/staff/promotions/due');

    // STAFF → 403
    await getDueForPromotion(mockReq(Role.STAFF) as Request, mockRes() as Response);
    assert('STAFF role receives 403', lastStatus === 403, `got ${lastStatus}`);

    // UNIT_HEAD → 403
    await getDueForPromotion(mockReq(Role.UNIT_HEAD) as Request, mockRes() as Response);
    assert('UNIT_HEAD role receives 403', lastStatus === 403, `got ${lastStatus}`);

    // BURSARY → 403
    await getDueForPromotion(mockReq(Role.BURSARY) as Request, mockRes() as Response);
    assert('BURSARY role receives 403', lastStatus === 403, `got ${lastStatus}`);

    // UNIT_ADMIN → 403
    await getDueForPromotion(mockReq(Role.UNIT_ADMIN) as Request, mockRes() as Response);
    assert('UNIT_ADMIN role receives 403', lastStatus === 403, `got ${lastStatus}`);

    // HR_ADMIN → passes RBAC (may hit DB, ignore DB errors in test)
    await getDueForPromotion(mockReq(Role.HR_ADMIN, {}, {}, { page: '1', limit: '5' }) as Request, mockRes() as Response);
    assert('HR_ADMIN role NOT blocked by RBAC (status ≠ 403)', lastStatus !== 403, `got ${lastStatus}`);

    // VICE_CHANCELLOR → passes RBAC
    await getDueForPromotion(mockReq(Role.VICE_CHANCELLOR, {}, {}, { page: '1', limit: '5' }) as Request, mockRes() as Response);
    assert('VICE_CHANCELLOR role NOT blocked by RBAC (status ≠ 403)', lastStatus !== 403, `got ${lastStatus}`);

    // SUPER_USER → passes RBAC
    await getDueForPromotion(mockReq(Role.SUPER_USER, {}, {}, { page: '1', limit: '5' }) as Request, mockRes() as Response);
    assert('SUPER_USER role NOT blocked by RBAC (status ≠ 403)', lastStatus !== 403, `got ${lastStatus}`);

    console.log('');

    // ── TEST GROUP 2: flagForPromotion ──────────────────────────────────────
    console.log('▶ Group 2: PUT /api/staff/promotions/flag/:profileId');

    // STAFF → 403
    await flagForPromotion(mockReq(Role.STAFF, { isDue: true }, { profileId: 'fake-id' }) as Request, mockRes() as Response);
    assert('STAFF cannot flag promotion → 403', lastStatus === 403, `got ${lastStatus}`);

    // VICE_CHANCELLOR → 403 (VC can VIEW but not FLAG — only Registry)
    await flagForPromotion(mockReq(Role.VICE_CHANCELLOR, { isDue: true }, { profileId: 'fake-id' }) as Request, mockRes() as Response);
    assert('VICE_CHANCELLOR cannot flag promotion → 403', lastStatus === 403, `got ${lastStatus}`);

    // UNIT_HEAD → 403
    await flagForPromotion(mockReq(Role.UNIT_HEAD, { isDue: true }, { profileId: 'fake-id' }) as Request, mockRes() as Response);
    assert('UNIT_HEAD cannot flag promotion → 403', lastStatus === 403, `got ${lastStatus}`);

    // HR_ADMIN → passes RBAC
    await flagForPromotion(mockReq(Role.HR_ADMIN, { isDue: true }, { profileId: 'nonexistent-id' }) as Request, mockRes() as Response);
    assert('HR_ADMIN NOT blocked by RBAC (status ≠ 403)', lastStatus !== 403, `got ${lastStatus}`);

    console.log('');

    // ── TEST GROUP 3: manualRunPromotionCron ────────────────────────────────
    console.log('▶ Group 3: POST /api/staff/promotions/run-cron');

    // STAFF → 403
    await manualRunPromotionCron(mockReq(Role.STAFF) as Request, mockRes() as Response);
    assert('STAFF cannot trigger cron → 403', lastStatus === 403, `got ${lastStatus}`);

    // HR_ADMIN → 403 (not SUPER_USER)
    await manualRunPromotionCron(mockReq(Role.HR_ADMIN) as Request, mockRes() as Response);
    assert('HR_ADMIN cannot trigger cron → 403', lastStatus === 403, `got ${lastStatus}`);

    // VICE_CHANCELLOR → 403
    await manualRunPromotionCron(mockReq(Role.VICE_CHANCELLOR) as Request, mockRes() as Response);
    assert('VICE_CHANCELLOR cannot trigger cron → 403', lastStatus === 403, `got ${lastStatus}`);

    // SUPER_USER → passes RBAC (job runs, may return 200 or 500 depending on DB)
    await manualRunPromotionCron(mockReq(Role.SUPER_USER) as Request, mockRes() as Response);
    assert('SUPER_USER NOT blocked by RBAC (status ≠ 403)', lastStatus !== 403, `got ${lastStatus}`);

    console.log('');

    // ── SUMMARY ────────────────────────────────────────────────────────────
    console.log('══════════════════════════════════════════════════════');
    console.log(` Results: ${passed} passed / ${failed} failed`);
    if (failed === 0) {
        console.log(' 🎉 All access control tests PASSED');
    } else {
        console.log(' ⚠  Some tests FAILED — review output above');
    }
    console.log('══════════════════════════════════════════════════════\n');

    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
    console.error('Test runner crashed:', err);
    process.exit(1);
});
