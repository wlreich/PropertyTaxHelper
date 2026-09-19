import { defineConfig } from '@playwright/test';

const baseURL = process.env.HOME_BASE_URL || 'https://property-tax-helper.vercel.app';
const target = new URL(baseURL);
if (target.protocol !== 'https:' || target.username || target.password || target.pathname !== '/') {
  throw new Error('HOME_BASE_URL must be an HTTPS origin without credentials or a path.');
}

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: target.origin,
    browserName: 'chromium',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [375, 1440].map(width => ({ name: `live-${width}`, use: { viewport: { width, height: 1000 } } })),
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'smoke-report' }],
    ['json', { outputFile: 'smoke-report/results.json' }],
    ['junit', { outputFile: 'smoke-report/results.xml' }],
  ],
  outputDir: 'smoke-test-results',
});
