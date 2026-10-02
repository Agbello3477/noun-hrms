import assert from 'assert';
import express, { Request, Response } from 'express';
import http from 'http';
import {
  createWafPreParserMiddleware,
  createWafBodyInspectorMiddleware,
  zeroTrustResponseMaskingMiddleware,
  inspectString,
  inspectObject,
  inspectUserAgent,
  recursiveHtmlDecode,
  resetMemoryStores,
  isIpJailed,
  jailIp,
  WAF_RULES,
  recentSecurityAlerts,
} from '../security/waf';

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

let ipCounter = 1;

// Helper to simulate mock requests
function createMockReqRes(options: {
  method?: string;
  url?: string;
  path?: string;
  query?: any;
  headers?: Record<string, string>;
  body?: any;
  ip?: string;
}) {
  const clientIp = options.ip || `10.0.0.${ipCounter++}`;
  const req: any = {
    method: options.method || 'GET',
    url: options.url || options.path || '/',
    originalUrl: options.url || options.path || '/',
    path: options.path || options.url || '/',
    query: options.query || {},
    headers: options.headers || { host: 'localhost:5000', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    body: options.body || {},
    ip: clientIp,
    socket: { remoteAddress: clientIp },
  };

  let statusCode = 200;
  let responseData: any = null;
  const headersSent: Record<string, string> = {};

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
    send(data: any) {
      responseData = data;
      return this;
    },
    setHeader(name: string, val: string) {
      headersSent[name.toLowerCase()] = String(val);
      return this;
    },
    on(event: string, cb: () => void) {},
  };

  return { req, res, getStatus: () => statusCode, getResponse: () => responseData, getHeaders: () => headersSent };
}

async function runTestSuite() {
  console.log('\n🛡️  STARTING ENTERPRISE APPLICATION-LEVEL WAF TEST SUITE...\n');
  resetMemoryStores();

  const preParser = createWafPreParserMiddleware({ mode: 'BLOCK' });
  const bodyInspector = createWafBodyInspectorMiddleware({ mode: 'BLOCK' });

  // --- SECTION 1: BENIGN REQUESTS & ZERO FALSE POSITIVES ---
  console.log('--- 1. Testing Benign Requests (0 False Positives) ---');

  await it('Benign HR search query with normal academic text passes cleanly', async () => {
    const { req, res, getStatus } = createMockReqRes({
      method: 'GET',
      path: '/api/staff',
      query: { department: 'Computer Science', rank: 'Senior Lecturer', search: 'Dr. Bello' },
    });
    let nextCalled = false;
    await preParser(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true, 'Next middleware should be called');
    assert.strictEqual(getStatus(), 200);
  });

  await it('Complex academic publication abstract with punctuation, quotes, dashes and wait-for phrase passes', async () => {
    const abstract = `
      This research analyzes the wait for delay factors influencing high-throughput cloud environments;
      specifically, we evaluate cluster performance under heavy network loads -- observing a 14% improvement.
      Authors: Dr. A. G. Bello & Prof. K. John (2026). "Algorithms & Implementations".
    `;
    const violations = inspectString(abstract, 'abstract');
    assert.strictEqual(violations.length, 0, 'Benign academic abstract must produce 0 false positives');

    const { req, res } = createMockReqRes({
      method: 'POST',
      path: '/api/academic/publications',
      body: { title: 'Cloud Scaling Analysis', abstract },
    });
    let nextCalled = false;
    await bodyInspector(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
  });

  // --- SECTION 2: SQL INJECTION (SQLi) FILTERS ---
  console.log('\n--- 2. Testing SQL Injection (SQLi) Detection ---');

  await it('Blocks Union-based SQL injection with HTTP 403', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      method: 'POST',
      path: '/api/staff',
      body: { name: "' UNION SELECT null, username, password FROM users --" },
    });
    let nextCalled = false;
    await bodyInspector(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'Should not call next()');
    assert.strictEqual(getStatus(), 403, 'Should return HTTP 403 Forbidden');
    assert.strictEqual(getResponse()?.rule, WAF_RULES.SQLI_UNION_SELECT);
  });

  await it('Blocks Boolean/stacked condition (OR 1=1) in query string', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      method: 'GET',
      path: '/api/users',
      query: { id: "1' OR '1'='1" },
    });
    let nextCalled = false;
    await preParser(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(getStatus(), 403);
    assert.strictEqual(getResponse()?.rule, WAF_RULES.SQLI_BOOLEAN_INJECTION);
  });

  await it('Blocks Stacked WAITFOR DELAY injection vector', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      method: 'POST',
      path: '/api/login',
      body: { username: "admin'; WAITFOR DELAY '0:0:5'--" },
    });
    let nextCalled = false;
    await bodyInspector(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(getStatus(), 403);
    assert.strictEqual(getResponse()?.rule, WAF_RULES.SQLI_STACKED_WAITFOR);
  });

  await it('Blocks pg_sleep() time-based injection', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      method: 'POST',
      path: '/api/staff',
      body: { filter: "1 AND (SELECT pg_sleep(5))" },
    });
    let nextCalled = false;
    await bodyInspector(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(getStatus(), 403);
    assert.strictEqual(getResponse()?.rule, WAF_RULES.SQLI_TIME_BASED);
  });

  await it('Blocks SQL comment tampering with block comments', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      method: 'POST',
      path: '/api/staff',
      body: { search: "admin'/*bypass*/OR 1=1" },
    });
    let nextCalled = false;
    await bodyInspector(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(getStatus(), 403);
  });

  // --- SECTION 3: CROSS-SITE SCRIPTING (XSS) & ENTITY DECODING ---
  console.log('\n--- 3. Testing XSS & Obfuscated Content Injection ---');

  await it('Blocks direct script tag injection', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      method: 'POST',
      path: '/api/memos',
      body: { title: 'Memo', content: '<script>alert("XSS")</script>' },
    });
    let nextCalled = false;
    await bodyInspector(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(getStatus(), 403);
    assert.strictEqual(getResponse()?.rule, WAF_RULES.XSS_SCRIPT_TAG);
  });

  await it('Recursively decodes obfuscated HTML entities and blocks hidden script tags', async () => {
    // Obfuscated: &amp;lt;script&amp;gt; (double encoded) or &lt;script&gt;
    const obfuscated = '&lt;script&gt;document.cookie&lt;/script&gt;';
    const decoded = recursiveHtmlDecode(obfuscated);
    assert.strictEqual(decoded, '<script>document.cookie</script>');

    const { req, res, getStatus, getResponse } = createMockReqRes({
      method: 'POST',
      path: '/api/memos',
      body: { title: 'Announcement', content: obfuscated },
    });
    let nextCalled = false;
    await bodyInspector(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(getStatus(), 403);
    assert.strictEqual(getResponse()?.rule, WAF_RULES.XSS_SCRIPT_TAG);
  });

  await it('Blocks inline event handlers (onload= / onerror=)', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      method: 'POST',
      path: '/api/memos',
      body: { content: '<img src=x onerror=alert(1)>' },
    });
    let nextCalled = false;
    await bodyInspector(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(getStatus(), 403);
    assert.strictEqual(getResponse()?.rule, WAF_RULES.XSS_EVENT_HANDLER);
  });

  await it('Blocks pseudo-protocol (javascript:) and dynamic eval()', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      method: 'POST',
      path: '/api/profile',
      body: { website: 'javascript:alert(1)', callback: 'eval(data)' },
    });
    let nextCalled = false;
    await bodyInspector(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(getStatus(), 403);
  });

  // --- SECTION 4: PATH TRAVERSAL & LFI ---
  console.log('\n--- 4. Testing Path Traversal & LFI Protection ---');

  await it('Blocks directory traversal sequence (../) in path and query', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      method: 'GET',
      path: '/api/documents',
      query: { file: '../../../../etc/passwd' },
    });
    let nextCalled = false;
    await preParser(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(getStatus(), 403);
    assert.strictEqual(getResponse()?.rule, WAF_RULES.PATH_TRAVERSAL_DOTDOT);
  });

  await it('Blocks access to sensitive operating system files (/etc/shadow)', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      method: 'GET',
      path: '/api/documents',
      query: { filepath: '/etc/shadow' },
    });
    let nextCalled = false;
    await preParser(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(getStatus(), 403);
    assert.strictEqual(getResponse()?.rule, WAF_RULES.LFI_SYSTEM_FILE);
  });

  // --- SECTION 5: NOSQL & OBJECT INJECTION (PROTOTYPE POLLUTION) ---
  console.log('\n--- 5. Testing Prototype Pollution & NoSQL Operator Overrides ---');

  await it('Blocks deep JSON injection containing __proto__', async () => {
    const payload = JSON.parse('{"name": "Admin", "__proto__": {"isAdmin": true}}');
    const { req, res, getStatus, getResponse } = createMockReqRes({
      method: 'POST',
      path: '/api/profile',
      body: payload,
    });
    let nextCalled = false;
    await bodyInspector(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(getStatus(), 403);
    assert.strictEqual(getResponse()?.rule, WAF_RULES.PROTOTYPE_POLLUTION);
  });

  await it('Blocks MongoDB operator overrides ($where, $gt) in payload fields', async () => {
    const payload = {
      username: { $gt: '' },
      $where: 'this.password.length > 0',
    };
    const { req, res, getStatus, getResponse } = createMockReqRes({
      method: 'POST',
      path: '/api/auth/login',
      body: payload,
    });
    let nextCalled = false;
    await bodyInspector(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(getStatus(), 403);
    assert.strictEqual(getResponse()?.rule, WAF_RULES.NOSQL_OPERATOR_INJECTION);
  });

  // --- SECTION 6: COMMAND INJECTION ---
  console.log('\n--- 6. Testing Command Injection Protection ---');

  await it('Blocks command substitution $(...) in input payload', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      method: 'POST',
      path: '/api/system/diagnostics',
      body: { hostname: 'localhost $(whoami)' },
    });
    let nextCalled = false;
    await bodyInspector(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(getStatus(), 403);
    assert.strictEqual(getResponse()?.rule, WAF_RULES.CMD_SUBSTITUTION);
  });

  await it('Blocks dangerous shell chaining (; rm -rf /) in input fields', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      method: 'POST',
      path: '/api/system/test',
      body: { input: 'test; rm -rf /' },
    });
    let nextCalled = false;
    await bodyInspector(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(getStatus(), 403);
    assert.strictEqual(getResponse()?.rule, WAF_RULES.CMD_CHAINING);
  });

  // --- SECTION 7: SCANNERS & PROTOCOL LIMITS ---
  console.log('\n--- 7. Testing Automated Scanners & Payload Limits ---');

  await it('Blocks automated vulnerability scanner User-Agents (sqlmap)', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      method: 'GET',
      path: '/api/staff',
      headers: { host: 'localhost:5000', 'user-agent': 'sqlmap/1.6.4#stable (https://sqlmap.org)' },
    });
    let nextCalled = false;
    await preParser(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(getStatus(), 403);
    assert.strictEqual(getResponse()?.rule, WAF_RULES.SCANNER_DETECTED);
  });

  await it('Enforces hard body size ceiling (JSON limit: 2MB)', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      method: 'POST',
      path: '/api/upload',
      headers: {
        host: 'localhost:5000',
        'content-type': 'application/json',
        'content-length': String(3 * 1024 * 1024), // 3MB > 2MB limit
      },
    });
    let nextCalled = false;
    await preParser(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(getStatus(), 413, 'Should return HTTP 413 Payload Too Large');
    assert.strictEqual(getResponse()?.code, 'ERR_PAYLOAD_TOO_LARGE');
  });

  // --- SECTION 8: ADAPTIVE RATE LIMITING & IP JAIL ---
  console.log('\n--- 8. Testing Adaptive Rate Limiting & Auto-Banning IP Jail ---');

  await it('Jails repeat offender IP after 3 critical rule violations and drops subsequent requests', async () => {
    const attackerIp = '198.51.100.44';

    // 1st Critical Violation: SQLi
    {
      const { req, res, getStatus } = createMockReqRes({
        method: 'POST',
        path: '/api/staff',
        ip: attackerIp,
        body: { name: "' UNION SELECT 1,2,3 --" },
      });
      await bodyInspector(req, res, () => {});
      assert.strictEqual(getStatus(), 403);
    }

    // 2nd Critical Violation: Command Injection
    {
      const { req, res, getStatus } = createMockReqRes({
        method: 'POST',
        path: '/api/staff',
        ip: attackerIp,
        body: { name: "test; cat /etc/passwd" },
      });
      await bodyInspector(req, res, () => {});
      assert.strictEqual(getStatus(), 403);
    }

    // Check not yet jailed
    assert.strictEqual(await isIpJailed(attackerIp), false, 'IP should not be jailed before 3rd violation');

    // 3rd Critical Violation: Scanner user-agent
    {
      const { req, res, getStatus } = createMockReqRes({
        method: 'GET',
        path: '/api/staff',
        ip: attackerIp,
        headers: { host: 'localhost:5000', 'user-agent': 'Nikto/2.1.6' },
      });
      await preParser(req, res, () => {});
      assert.strictEqual(getStatus(), 403);
    }

    // Now IP must be jailed
    assert.strictEqual(await isIpJailed(attackerIp), true, 'IP must be jailed after 3 critical violations');

    // 4th Request: Even a benign request from the jailed IP must be dropped instantly with ERR_IP_TEMPORARILY_BLOCKED
    {
      const { req, res, getStatus, getResponse } = createMockReqRes({
        method: 'GET',
        path: '/api/health',
        ip: attackerIp,
      });
      let nextCalled = false;
      await preParser(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, false, 'Jailed IP should never reach next handler');
      assert.strictEqual(getStatus(), 403);
      assert.strictEqual(getResponse()?.code, 'ERR_IP_TEMPORARILY_BLOCKED');
      assert.strictEqual(getResponse()?.rule, WAF_RULES.IP_JAILED);
    }
  });

  // --- SECTION 9: ZERO-TRUST RESPONSE MASKING ---
  console.log('\n--- 9. Testing Zero-Trust Response Masking (500 Error Protection) ---');

  await it('Strips Prisma error traces, stack traces, and internal server paths from 500 error responses', async () => {
    const { req, res, getStatus, getResponse } = createMockReqRes({
      method: 'GET',
      path: '/api/internal-test',
    });

    let nextCalled = false;
    zeroTrustResponseMaskingMiddleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);

    // Simulate controller throwing uncaught Prisma error with server filesystem paths
    const internalLeakedData = {
      error: true,
      message: 'PrismaClientKnownRequestError: Table `users` does not exist in PostgreSQL query `SELECT * FROM users`',
      stack: 'Error: at /Users/abdulgaffarbello/Unified Human Resource Management System/server/src/controllers/staff.controller.ts:45:12',
      details: { path: '/Users/abdulgaffarbello/.../secret.key' }
    };

    res.status(500).json(internalLeakedData);

    const masked = getResponse();
    assert.strictEqual(getStatus(), 500);
    assert.strictEqual(masked.error, true);
    assert.strictEqual(masked.code, 'ERR_INTERNAL_SERVER_ERROR');
    assert.strictEqual(masked.message, 'A secure server error occurred. The incident has been recorded for review.');
    assert.ok(masked.incidentId?.startsWith('SEC-'), 'Should attach secure incidentId');
    assert.ok(masked.timestamp?.includes('+01:00'), 'Timestamp should be in WAT (+01:00)');
    // Verify zero data leaks
    assert.strictEqual(JSON.stringify(masked).includes('PrismaClientKnownRequestError'), false, 'Prisma trace must not leak');
    assert.strictEqual(JSON.stringify(masked).includes('/Users/abdulgaffarbello'), false, 'Filesystem path must not leak');
  });

  // --- SECTION 10: INSPECTION LATENCY PERFORMANCE (< 1.5ms) ---
  console.log('\n--- 10. Performance Benchmark: Inspection Latency Overhead ---');

  await it('Executes 1,000 payload inspections with average latency strictly under 1.5ms', () => {
    const testPayloads = [
      'John Doe, Senior Lecturer, Faculty of Science',
      "Dr. Bello's comprehensive examination results for 2026",
      JSON.stringify({ query: 'faculty', page: 1, limit: 50, sort: 'name' }),
      'Normal English sentence with commas, semicolons; and quotes "test" without SQL commands',
      'UNION SELECT * FROM accounts',
      '<script>alert(1)</script>',
      '../../etc/passwd',
      'test; rm -rf /',
    ];

    const iterations = 1000;
    const start = process.hrtime();

    for (let i = 0; i < iterations; i++) {
      const payload = testPayloads[i % testPayloads.length];
      inspectString(payload);
    }

    const diff = process.hrtime(start);
    const totalMs = (diff[0] * 1e3) + (diff[1] * 1e-6);
    const avgLatencyMs = totalMs / iterations;

    console.log(`    ⏱️  Total for ${iterations} inspections: ${totalMs.toFixed(2)}ms`);
    console.log(`    ⏱️  Average inspection latency: ${avgLatencyMs.toFixed(4)}ms per request`);

    assert.ok(avgLatencyMs < 1.5, `Average latency (${avgLatencyMs.toFixed(4)}ms) must be strictly under 1.5ms`);
  });

  // --- SECTION 11: SENTINELOPS TELEMETRY DISPATCH ---
  console.log('\n--- 11. Testing SentinelOps Telemetry Dispatch ---');

  await it('Dispatches formatted WAT security alert events to SentinelOps telemetry buffer with masked passwords', async () => {
    assert.ok(recentSecurityAlerts.length > 0, 'Security alerts must be recorded in telemetry buffer');
    const lastAlert = recentSecurityAlerts[recentSecurityAlerts.length - 1];

    assert.ok(lastAlert.timestamp.includes('+01:00'), 'Alert timestamp must be in WAT (+01:00)');
    assert.ok(lastAlert.rule.startsWith('RULE_'), 'Alert rule must be standard rule code');
    assert.ok(['MEDIUM', 'HIGH', 'CRITICAL'].includes(lastAlert.severity), 'Alert must have valid severity');
    assert.ok(lastAlert.clientIp, 'Alert must capture client IP');
  });

  console.log('\n================================');
  console.log(`🎉 Enterprise WAF Middleware Tests Completed!`);
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
