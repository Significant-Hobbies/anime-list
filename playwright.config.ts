import { devices } from '@playwright/test';
import { definePlaywrightConfig } from '@saas-maker/test-config/playwright';

/**
 * Desktop baseline + a mobile-viewport project (iPhone 13 = 390px, the Wave 1
 * mobile target) so mobile-layout regressions are caught.
 *
 * Run only the mobile project:  pnpm exec playwright test --project=mobile
 */
export default definePlaywrightConfig({
  testDir: './e2e',
  baseURL: process.env.E2E_BASE_URL || 'https://anime-list-9lk.pages.dev',
  viewportMatrix: false,
  smoke: false,
  extend: {
    projects: [
      { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
      { name: 'mobile', use: { ...devices['iPhone 13'] } },
    ],
  },
});
