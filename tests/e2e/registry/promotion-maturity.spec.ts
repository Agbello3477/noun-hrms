import { test, expect } from '@playwright/test';
import { MOCK_USERS, setupAuthRouteMocks, injectSessionStorageAuth } from '../fixtures/auth-fixtures';

const MOCK_PROMOTION_CANDIDATES = [
  {
    id: 'prof-001',
    staffId: 'NOUN/ACAD/2020/004',
    surname: 'Bello',
    otherNames: 'Abdulgaffar',
    title: 'Dr.',
    rank: 'Senior Lecturer',
    level: 'CONUASS 05',
    currentGradeLevel: 'CONUASS 05',
    cadre: 'ACADEMIC',
    cadreType: 'ACADEMIC',
    lastPromotionDate: '2023-10-01T00:00:00.000Z',
    nextDueYear: 2026,
    nextDueDate: '2026-10-01T00:00:00.000Z',
    eligibilityStatus: 'DUE_FOR_REVIEW',
    registryOverride: false,
    department: 'Computer Science',
    unit: { id: 'u-1', name: 'Department of Computer Science' },
    studyCenter: null,
    user: { id: 'u-bello', email: 'abello@noun.edu.ng', name: 'Dr. Abdulgaffar Bello' }
  },
  {
    id: 'prof-002',
    staffId: 'NOUN/ADM/2019/088',
    surname: 'Adeyemi',
    otherNames: 'Folashade',
    title: 'Mrs.',
    rank: 'Principal Assistant Registrar',
    level: 'CONTISS 13',
    currentGradeLevel: 'CONTISS 13',
    cadre: 'ADMINISTRATIVE',
    cadreType: 'SENIOR_ADMIN',
    lastPromotionDate: '2022-01-01T00:00:00.000Z',
    nextDueYear: 2026,
    nextDueDate: '2026-01-01T00:00:00.000Z',
    eligibilityStatus: 'UNDER_EVALUATION',
    registryOverride: true,
    overrideReason: 'Approved by Registrar for special Council consideration.',
    department: 'Registry HQ',
    unit: { id: 'u-2', name: 'Registry Directorate' },
    studyCenter: null,
    user: { id: 'u-adeyemi', email: 'fadeyemi@noun.edu.ng', name: 'Mrs. Folashade Adeyemi' }
  }
];

test.describe('Suite 4: Registry Promotion Maturity Tracking & Schedule Overrides', () => {

  test('should render promotion docket table with cadre intervals and allow schedule configuration', async ({ page }) => {
    // 1. Authenticate as Registry HR Admin
    await setupAuthRouteMocks(page, MOCK_USERS.registryAdmin);
    await injectSessionStorageAuth(page, MOCK_USERS.registryAdmin);

    // 2. Mock promotion due list endpoint
    await page.route('**/api/v1/registry/promotions/due-list*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: MOCK_PROMOTION_CANDIDATES,
          total: 2,
          page: 1,
          pages: 1,
          counts: {
            PENDING_MATURITY: 0,
            DUE_FOR_REVIEW: 1,
            UNDER_EVALUATION: 1,
            APPROVED: 0,
            DEFERRED: 0,
            TOTAL: 2
          },
          cycleYear: 2026
        })
      });
    });

    // Mock patch schedule endpoint
    await page.route('**/api/v1/registry/promotions/*/due-date', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Promotion schedule updated and audited successfully.',
          profile: {
            ...MOCK_PROMOTION_CANDIDATES[0],
            nextDueYear: 2025,
            registryOverride: true
          }
        })
      });
    });

    // 3. Navigate to Promotion Due List
    await page.goto('/dashboard/registry/due-for-promotion', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/dashboard\/registry\/due-for-promotion/);

    // 4. Verify Heading & KPI Metric Cards
    const heading = page.locator('h1');
    await expect(heading).toContainText('Staff Promotion & Annual Maturity Tracking');

    // Verify candidate rows rendered
    await expect(page.locator('text=Dr. Bello Abdulgaffar')).toBeVisible();
    await expect(page.locator('text=Mrs. Adeyemi Folashade')).toBeVisible();
    await expect(page.locator('tbody tr span:has-text("ACADEMIC")')).toBeVisible();
    await expect(page.locator('tbody tr span:has-text("SENIOR_ADMIN")')).toBeVisible();

    // 5. Open Schedule Configure & Override Modal for first candidate
    const editBtn = page.locator('button[title="Configure / Override Promotion Schedule"]').first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Verify Modal Contents
    const modalHeading = page.locator('h3:has-text("Configure Promotion Schedule & Override")');
    await expect(modalHeading).toBeVisible();

    // Verify Cadre rule dynamic banner
    await expect(page.locator('text=Cadre Statutory Rule:')).toBeVisible();

    // 6. Test Override checkbox toggle
    const overrideCheckbox = page.locator('input[type="checkbox"]');
    await expect(overrideCheckbox).toBeVisible();
    await overrideCheckbox.check();

    // Verify override justification textarea appears
    const reasonTextarea = page.locator('textarea');
    await expect(reasonTextarea).toBeVisible();
    await reasonTextarea.fill('Special research acceleration approved by University Council at 104th Meeting.');

    // Save schedule
    const saveBtn = page.locator('button:has-text("Save Schedule & Record Audit Log")');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Modal should close upon success
    await expect(modalHeading).not.toBeVisible();
  });

  test('should restrict non-administrative staff roles from accessing promotion governance console', async ({ page }) => {
    // 1. Authenticate as non-authorized user (Security Officer)
    await setupAuthRouteMocks(page, MOCK_USERS.securityOfficer);
    await injectSessionStorageAuth(page, MOCK_USERS.securityOfficer);

    // 2. Navigate to due-for-promotion page
    await page.goto('/dashboard/registry/due-for-promotion', { waitUntil: 'domcontentloaded' });

    // 3. Verify access is guarded by redirecting to /dashboard and non-visibility of promotion console
    await page.waitForURL(/\/dashboard/);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1')).not.toContainText('Staff Promotion & Annual Maturity Tracking');
  });

});
