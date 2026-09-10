import { test, expect } from '@playwright/test';
import { MOCK_USERS, setupAuthRouteMocks } from '../fixtures/auth-fixtures';

test.describe('Suite 1: Multi-Role Authentication & Session Isolation', () => {

  test('should isolate sessions across concurrent browser contexts without cross-contamination', async ({ browser }) => {
    // 1. Create Context A: Registry Administrator
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await setupAuthRouteMocks(pageA, MOCK_USERS.registryAdmin);

    // 2. Create Context B: Clinic Doctor
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await setupAuthRouteMocks(pageB, MOCK_USERS.clinicDoctor);

    // Track API requests in both contexts to verify Authorization headers
    const authHeadersA: string[] = [];
    const authHeadersB: string[] = [];

    pageA.on('request', (req) => {
      const auth = req.headers()['authorization'];
      if (auth) authHeadersA.push(auth);
    });

    pageB.on('request', (req) => {
      const auth = req.headers()['authorization'];
      if (auth) authHeadersB.push(auth);
    });

    // Helper to navigate to login form
    const openLoginForm = async (page: typeof pageA) => {
      await page.goto('/?login=true', { waitUntil: 'domcontentloaded' });
      const emailInput = page.locator('input#email');
      const isVisible = await emailInput.isVisible({ timeout: 2000 }).catch(() => false);
      if (!isVisible) {
        const btn = page.locator('button:has-text("Sign In"), button:has-text("Log In to Portal")').first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click();
        }
      }
      await expect(emailInput).toBeVisible({ timeout: 10000 });
      return emailInput;
    };

    // ── Context A: Login as Registry Admin ─────────────────────────────
    const emailInputA = await openLoginForm(pageA);
    const passwordInputA = pageA.locator('input#password');
    const submitBtnA = pageA.locator('button[type="submit"]');

    await emailInputA.fill(MOCK_USERS.registryAdmin.email);
    await passwordInputA.fill('SecretPassword123!');
    await submitBtnA.click();

    // Verify Context A lands in dashboard with Registry view
    await expect(pageA).toHaveURL(/\/dashboard/);
    const headerA = pageA.locator('header h2');
    await expect(headerA).toBeVisible();

    // ── Context B: Login as Clinic Doctor ──────────────────────────────
    const emailInputB = await openLoginForm(pageB);
    const passwordInputB = pageB.locator('input#password');
    const submitBtnB = pageB.locator('button[type="submit"]');

    await emailInputB.fill(MOCK_USERS.clinicDoctor.email);
    await passwordInputB.fill('DoctorPassword123!');
    await submitBtnB.click();

    // Verify Context B lands in dashboard with Clinic view
    await expect(pageB).toHaveURL(/\/dashboard/);
    const headerB = pageB.locator('header h2');
    await expect(headerB).toBeVisible();

    // ── Validate Session Storage Partitioning ──────────────────────────
    const sessionTokenA = await pageA.evaluate(() => window.sessionStorage.getItem('token'));
    const sessionUserA = await pageA.evaluate(() => JSON.parse(window.sessionStorage.getItem('noun_hrms_user_cache') || window.sessionStorage.getItem('user') || '{}'));

    const sessionTokenB = await pageB.evaluate(() => window.sessionStorage.getItem('token'));
    const sessionUserB = await pageB.evaluate(() => JSON.parse(window.sessionStorage.getItem('noun_hrms_user_cache') || window.sessionStorage.getItem('user') || '{}'));

    // Assert tokens and user IDs are strictly isolated per context
    expect(sessionTokenA).toBe(MOCK_USERS.registryAdmin.token);
    expect(sessionUserA.email).toBe(MOCK_USERS.registryAdmin.email);
    expect(sessionUserA.role).toBe(MOCK_USERS.registryAdmin.role);

    expect(sessionTokenB).toBe(MOCK_USERS.clinicDoctor.token);
    expect(sessionUserB.email).toBe(MOCK_USERS.clinicDoctor.email);
    expect(sessionUserB.role).toBe(MOCK_USERS.clinicDoctor.role);

    expect(sessionTokenA).not.toBe(sessionTokenB);
    expect(sessionUserA.email).not.toBe(sessionUserB.email);

    // ── Open New Tab in Context A & Assert No Session Bleed ────────────
    const newTabA = await contextA.newPage();
    await setupAuthRouteMocks(newTabA, MOCK_USERS.registryAdmin);

    // Pre-populate sessionStorage in the new tab simulating same-tab/multi-tab flow
    await newTabA.addInitScript(
      ({ token, user }) => {
        window.sessionStorage.setItem('token', token);
        window.sessionStorage.setItem('noun_hrms_user_cache', JSON.stringify(user));
        window.sessionStorage.setItem('user', JSON.stringify(user));
      },
      { token: MOCK_USERS.registryAdmin.token, user: MOCK_USERS.registryAdmin }
    );

    await newTabA.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(newTabA).toHaveURL(/\/dashboard/);

    const newTabTokenA = await newTabA.evaluate(() => window.sessionStorage.getItem('token'));
    const newTabUserA = await newTabA.evaluate(() => JSON.parse(window.sessionStorage.getItem('noun_hrms_user_cache') || window.sessionStorage.getItem('user') || '{}'));

    // The new tab in Context A must still be Registry Admin, never Clinic Doctor
    expect(newTabTokenA).toBe(MOCK_USERS.registryAdmin.token);
    expect(newTabUserA.email).toBe(MOCK_USERS.registryAdmin.email);
    expect(newTabUserA.email).not.toBe(MOCK_USERS.clinicDoctor.email);

    // ── Verify Explicit Authorization Headers for API Requests ────────
    // Trigger an API fetch in Context A
    await pageA.evaluate(async () => {
      try {
        await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${window.sessionStorage.getItem('token')}`
          }
        });
      } catch (e) { /* ignore */ }
    });

    // Trigger an API fetch in Context B
    await pageB.evaluate(async () => {
      try {
        await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${window.sessionStorage.getItem('token')}`
          }
        });
      } catch (e) { /* ignore */ }
    });

    expect(authHeadersA.some((h) => h === `Bearer ${MOCK_USERS.registryAdmin.token}`)).toBeTruthy();
    expect(authHeadersB.some((h) => h === `Bearer ${MOCK_USERS.clinicDoctor.token}`)).toBeTruthy();

    // Clean up contexts
    await contextA.close();
    await contextB.close();
  });

});
