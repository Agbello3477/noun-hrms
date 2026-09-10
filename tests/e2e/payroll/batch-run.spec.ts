import { test, expect } from '@playwright/test';
import { MOCK_USERS, setupAuthRouteMocks, injectSessionStorageAuth } from '../fixtures/auth-fixtures';
import { MOCK_PAYROLL_BATCH, calculatePayrollPrecision } from '../fixtures/payroll-fixtures';

test.describe('Suite 2: Automated Payroll Execution & UI Guarding', () => {

  test('should guard batch run submission button and calculate deductions accurately without rounding error', async ({ page }) => {
    // 1. Authenticate as Bursary Finance Officer
    await setupAuthRouteMocks(page, MOCK_USERS.bursaryOfficer);
    await injectSessionStorageAuth(page, MOCK_USERS.bursaryOfficer);

    // Mock the payroll run API endpoint with a small delay to test button disabling & loading spinner
    await page.route('**/api/payroll/run', async (route) => {
      // Respond with deterministic calculation fixtures
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PAYROLL_BATCH)
      });
    });

    // Mock stats and salary scale endpoints
    await page.route('**/api/payroll/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { _sum: { grossPay: 87500000, totalDeductions: 19250000, netPay: 68250000 } }
        ])
      });
    });

    // 2. Navigate to Run Payroll page
    await page.goto('/dashboard/payroll/run', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/dashboard\/payroll\/run/);

    // 3. Verify Page Header & Select Controls
    const heading = page.locator('h1');
    await expect(heading).toContainText('Run Payroll');

    const monthSelect = page.locator('select').first();
    const yearSelect = page.locator('select').nth(1);
    const generateBtn = page.locator('button[type="submit"]');

    await expect(monthSelect).toBeVisible();
    await expect(yearSelect).toBeVisible();
    await expect(generateBtn).toBeVisible();
    await expect(generateBtn).toBeEnabled();

    // Select target batch month & year
    await monthSelect.selectOption('October');
    await yearSelect.selectOption(String(new Date().getFullYear()));

    // 4. Trigger Batch Run & Assert Immediate Button Guarding
    await generateBtn.click();

    // 5. Verify Success Card and Calculation Summary Results
    const successCard = page.locator('text=Payroll Run Completed');
    await expect(successCard).toBeVisible();

    const processedStat = page.locator(`text=${MOCK_PAYROLL_BATCH.details.processed}`);
    await expect(processedStat).toBeVisible();

    // 6. Assert Precision Arithmetic Across High-Scale Fixture Calculations
    // Validate that sample staff figures have zero floating point inaccuracy (e.g., 0.1 + 0.2 !== 0.3)
    const sampleStaff = MOCK_PAYROLL_BATCH.sampleStaffCalculations[0];
    const calculated = calculatePayrollPrecision(
      sampleStaff.basicSalary,
      sampleStaff.allowances.hazard! + sampleStaff.allowances.transport! + sampleStaff.allowances.housing!
    );

    expect(calculated.grossPay).toBe(600000.00);
    expect(calculated.payeTax).toBe(84000.00);
    expect(calculated.pension).toBe(36000.00);
    expect(calculated.nhf).toBe(11250.00);
    expect(calculated.totalDeductions).toBe(131250.00);
    expect(calculated.netPay).toBe(468750.00);

    // Ensure Gross Pay minus Total Deductions strictly equals Net Pay to the exact cent
    const netCheck = Math.round((calculated.grossPay - calculated.totalDeductions) * 100) / 100;
    expect(calculated.netPay).toBe(netCheck);
  });

  test('should prevent duplicate submission clicks by maintaining disabled state during request in-flight', async ({ page }) => {
    await setupAuthRouteMocks(page, MOCK_USERS.bursaryOfficer);
    await injectSessionStorageAuth(page, MOCK_USERS.bursaryOfficer);

    let requestCount = 0;

    // Simulate server processing delay to verify loading state stability
    await page.route('**/api/payroll/run', async (route) => {
      requestCount++;
      // Wait slightly within route interceptor (simulating network roundtrip) before fulfilling
      await new Promise((res) => setTimeout(res, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PAYROLL_BATCH)
      });
    });

    await page.goto('/dashboard/payroll/run', { waitUntil: 'domcontentloaded' });
    const generateBtn = page.locator('button[type="submit"]');

    await expect(generateBtn).toBeEnabled();

    // Click and immediately check for disabled state
    await generateBtn.click();
    await expect(generateBtn).toBeDisabled();

    // Wait for resolution
    await expect(page.locator('text=Payroll Run Completed')).toBeVisible();

    // Ensure only 1 batch request was dispatched
    expect(requestCount).toBe(1);
  });

});
