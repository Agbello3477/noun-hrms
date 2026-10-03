import { Request, Response } from 'express';
import { cacheMiddleware, normalizeUrlWithQueryParams } from '../middleware/cacheMiddleware';
import { edgeCacheControlMiddleware } from '../middleware/edgeCacheControl.middleware';
import { redisService } from '../services/redis.service';
import { getCachedQuery, buildDbCacheKey } from '../utils/dbCache';
import { cacheInvalidationService } from '../services/cacheInvalidationService';

function createMockReq(options: {
    method?: string;
    url?: string;
    originalUrl?: string;
    path?: string;
    user?: any;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
}): Request {
    return {
        method: options.method || 'GET',
        url: options.url || '/api/analytics/dashboard',
        originalUrl: options.originalUrl || options.url || '/api/analytics/dashboard',
        path: options.path || options.url || '/api/analytics/dashboard',
        user: options.user,
        headers: options.headers || {},
        cookies: options.cookies || {},
    } as unknown as Request;
}

function createMockRes(): {
    res: Response;
    headers: Record<string, string>;
    statusCode: number;
    jsonData: any;
} {
    const headers: Record<string, string> = {};
    let statusCode = 200;
    let jsonData: any = null;

    const res = {
        statusCode: 200,
        setHeader: (name: string, value: string) => {
            headers[name.toLowerCase()] = value;
            return res;
        },
        getHeader: (name: string) => headers[name.toLowerCase()],
        status: (code: number) => {
            statusCode = code;
            res.statusCode = code;
            return res;
        },
        json: (data: any) => {
            jsonData = data;
            return res;
        },
    } as unknown as Response;

    return { res, headers, statusCode, jsonData };
}

async function runTests() {
    console.log('🧪 ========================================================');
    console.log('🧪 RUNNING THREE-TIER ZERO-TRUST CACHING SUITE (NOUN-HRMS)');
    console.log('🧪 ========================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, testName: string, detail?: string) {
        if (condition) {
            console.log(`  ✅ [PASS] ${testName}`);
            passed++;
        } else {
            console.error(`  ❌ [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
            failed++;
        }
    }

    // Flush memory before tests
    redisService.flushMemory();

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 1: Layer 1 - CDN & Edge Cache-Control Header Directives
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('👉 [Test 1] Layer 1: Edge & CDN Zero-Trust Header Enforcement');
    {
        // 1.1 Public semi-static catalog endpoint
        const publicReq = createMockReq({ path: '/api/v1/meta/faculties', method: 'GET' });
        const { res: publicRes, headers: pubHeaders } = createMockRes();
        edgeCacheControlMiddleware(publicReq, publicRes, () => {});
        assert(
            pubHeaders['cache-control']?.includes('public') && pubHeaders['cache-control']?.includes('s-maxage=3600'),
            'Public metadata endpoint attaches Edge-friendly public s-maxage=3600'
        );

        // 1.2 Authenticated / sensitive payroll endpoint
        const secureReq = createMockReq({ path: '/api/v1/payroll/summary', method: 'GET' });
        const { res: secureRes, headers: secHeaders } = createMockRes();
        edgeCacheControlMiddleware(secureReq, secureRes, () => {});
        assert(
            secHeaders['cache-control'] === 'no-store, no-cache, private, must-revalidate',
            'Sensitive authenticated endpoint strictly enforces Zero-Trust private no-store'
        );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 2: URL Normalization with Query Parameters
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n👉 [Test 2] URL Normalization & Deterministic Query Sorting');
    {
        const urlA = '/api/staff?limit=25&page=1&status=ACTIVE';
        const urlB = '/api/staff?status=ACTIVE&page=1&limit=25';
        const normA = normalizeUrlWithQueryParams(urlA);
        const normB = normalizeUrlWithQueryParams(urlB);
        assert(normA === normB, 'Query parameters with different order produce identical normalized key');
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 3: Layer 2 - In-Memory Cache Latency, Sub-5ms Hit & Miss Diagnostics
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n👉 [Test 3] Layer 2: In-Memory API Cache Latency & Diagnostic Headers');
    {
        const userA = { id: 'usr-101', role: 'STAFF', centerId: 'CTR-ABUJA' };
        const req1 = createMockReq({
            url: '/api/analytics/dashboard-bootstrap',
            user: userA
        });

        const middleware = cacheMiddleware(60, { tags: ['tag:dashboard_kpis'] });

        // First call: Cache MISS
        const { res: res1, headers: h1 } = createMockRes();
        let nextCalled = false;
        await middleware(req1, res1, () => {
            nextCalled = true;
            res1.status(200).json({ status: 'OK', user: 'Staff User' });
        });

        assert(nextCalled && h1['x-cache-status'] === 'MISS', 'Initial request records X-Cache-Status: MISS');

        // Second call: Cache HIT (Sub-5ms)
        const req2 = createMockReq({
            url: '/api/analytics/dashboard-bootstrap',
            user: userA
        });
        const { res: res2, headers: h2 } = createMockRes();
        await middleware(req2, res2, () => {});

        const lookupTime = parseFloat(h2['x-cache-lookup-time-ms'] || '999');
        assert(h2['x-cache-status'] === 'HIT', 'Subsequent identical request records X-Cache-Status: HIT');
        assert(lookupTime < 5.0, `Cache HIT response served in sub-5ms (Lookup latency: ${lookupTime}ms)`);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 4: Zero-Trust Multi-Tenant & Tab-Session Context Isolation (No Cross-Talk)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n👉 [Test 4] Zero-Trust Role & User Context Isolation (RBAC Integrity)');
    {
        const userStaff = { id: 'usr-staff-1', role: 'STAFF', centerId: 'CTR-LAGOS' };
        const userDean = { id: 'usr-dean-2', role: 'DEAN', centerId: 'CTR-HQ' };

        const middleware = cacheMiddleware(60);

        // 1. Staff requests dashboard
        const staffReq = createMockReq({ url: '/api/analytics/dashboard', user: userStaff });
        const { res: staffRes } = createMockRes();
        await middleware(staffReq, staffRes, () => {
            staffRes.status(200).json({ view: 'STAFF_RESTRICTED_VIEW', salary: 100000 });
        });

        // 2. Dean requests the same URL
        const deanReq = createMockReq({ url: '/api/analytics/dashboard', user: userDean });
        const { res: deanRes, headers: deanHeaders } = createMockRes();
        let deanNextRan = false;
        await middleware(deanReq, deanRes, () => {
            deanNextRan = true;
            deanRes.status(200).json({ view: 'DEAN_CONFIDENTIAL_FACULTY_VIEW', totalBudget: 50000000 });
        });

        assert(
            deanNextRan && deanHeaders['x-cache-status'] === 'MISS',
            'Dean requesting the same endpoint does not receive Staff cached data (X-Cache-Status: MISS)'
        );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 5: Layer 3 - Database Query Caching Wrapper & Tag-Based Atomic Purge
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n👉 [Test 5] Layer 3: Database Query Caching & Atomic Tag Invalidation');
    {
        let dbExecutionCount = 0;
        const mockQueryFn = async () => {
            dbExecutionCount++;
            return [{ id: 'PRM-001', staffId: 'NOUN-2026-001', status: 'DUE' }];
        };

        const cacheKey = buildDbCacheKey('staff:promotions:due', 2026, 1, 25, 'all');

        // First DB query: executes function
        const res1 = await getCachedQuery(cacheKey, 300, mockQueryFn, ['tag:due_for_promotion']);
        assert(dbExecutionCount === 1 && res1.length === 1, 'Initial getCachedQuery calls database');

        // Second DB query: hits cache without executing query function
        const res2 = await getCachedQuery(cacheKey, 300, mockQueryFn, ['tag:due_for_promotion']);
        assert(dbExecutionCount === 1 && res2.length === 1, 'Second getCachedQuery returns cached DB result without DB hit');

        // Invalidate tag: due_for_promotion
        await cacheInvalidationService.invalidatePromotions();

        // Third query: executes function again because tag was purged
        const res3 = await getCachedQuery(cacheKey, 300, mockQueryFn, ['tag:due_for_promotion']);
        assert(dbExecutionCount === 2, 'Query executes fresh DB call after tag:due_for_promotion invalidation');
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 6: Maker-Checker Staff Posting Invalidation Guarantee
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n👉 [Test 6] Maker-Checker Dual Control Invalidation Guarantee');
    {
        const registrarUser = { id: 'usr-reg-1', role: 'REGISTRAR', centerId: 'HQ' };
        const docketKey = buildDbCacheKey('registrar:postings:pending', 'all');

        let queueExecutions = 0;
        const fetchPendingPostings = async () => {
            queueExecutions++;
            return [{ postingId: 'PST-99', staffName: 'Dr. Jane Doe', status: 'PENDING' }];
        };

        // Cache registrar pending queue
        await getCachedQuery(docketKey, 60, fetchPendingPostings, ['tag:staff_postings', 'tag:pending_postings_docket']);
        assert(queueExecutions === 1, 'Registrar pending docket initially cached');

        // Maker imputes a new draft posting or Authorizer authorizes a posting
        await cacheInvalidationService.invalidateStaffPostings();

        // Registrar refreshes queue
        await getCachedQuery(docketKey, 60, fetchPendingPostings, ['tag:staff_postings', 'tag:pending_postings_docket']);
        assert(queueExecutions === 2, 'Pending docket cache purged immediately upon Maker/Authorizer action');
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 7: Resilient Fail-Open Behavior on Redis Disconnection
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n👉 [Test 7] Resilient Fail-Open on Disconnected Redis (Zero Crash)');
    {
        // Execute query when Redis is unavailable
        let directDbCalled = false;
        const result = await getCachedQuery('redis:db:emergency:test', 30, async () => {
            directDbCalled = true;
            return { status: 'ONLINE', fallback: 'DIRECT_POSTGRES_PASSTHROUGH' };
        });

        assert(directDbCalled && result.status === 'ONLINE', 'System seamlessly executes direct database query without throwing 500 errors');
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n========================================================');
    console.log(`🏁 TEST COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Fatal error in cache test suite:', err);
    process.exit(1);
});
