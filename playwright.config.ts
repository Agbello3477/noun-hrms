import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Suite Configuration
 * Supporting multi-role authentication, batch payroll validation, and WebRTC fake media streaming.
 */
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3001';

export default defineConfig({
  testDir: './tests/e2e',
  /* Maximum time one test can run for. */
  timeout: 60 * 1000,
  expect: {
    /* Maximum time expect() should wait for condition to be met. */
    timeout: 10 * 1000,
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI if resource-constrained */
  workers: process.env.CI ? 2 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: BASE_URL,

    /* Capture network traces on first retry */
    trace: 'on-first-retry',

    /* Video recording on test failure (enabled on CI) */
    video: process.env.CI ? 'retain-on-failure' : 'off',

    /* Screenshot only on failure */
    screenshot: 'only-on-failure',

    /* Action and navigation timeouts */
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,

    /* Grant camera and microphone permissions by default for WebRTC calls */
    permissions: ['microphone', 'camera'],

    /* Ignore HTTPS certificate errors if testing on local/staging environments */
    ignoreHTTPSErrors: true,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.CI ? undefined : 'chrome',
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--allow-file-access-from-files',
            '--use-file-for-fake-audio-capture',
            '--autoplay-policy=no-user-gesture-required',
            '--disable-web-security',
          ],
        },
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'media.navigator.streams.fake': true,
            'media.navigator.permission.disabled': true,
            'media.autoplay.default': 0,
          },
        },
      },
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
      },
    },
  ],

  /* Run local dev/prod server before starting the tests */
  webServer: {
    command: 'npm run start --workspace=client -- -p 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
