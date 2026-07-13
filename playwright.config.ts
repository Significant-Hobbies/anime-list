import { defineConfig, devices } from '@playwright/test';

// Plain Playwright config (formerly @saas-maker/test-config/playwright factory, inlined).
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 2 : 0,
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://anime.significanthobbies.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
});
