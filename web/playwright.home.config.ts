import { defineConfig } from '@playwright/test';
import brand from './playwright.brand.config';

// Never point the fixture suite at a deployed database. All RPCs stay on loopback.
export default defineConfig({
  testDir: './tests',
  testMatch: ['brand/search.spec.ts', 'brand/home-regression.spec.ts', 'regression/**/*.spec.ts'],
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: {
    ...brand.use,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    ...[375, 768, 1440].map(width => ({
      name: `chromium-${width}`,
      use: { browserName: 'chromium' as const, viewport: { width, height: 1000 } },
    })),
    { name: 'firefox-1440', use: { browserName: 'firefox', viewport: { width: 1440, height: 1000 } } },
    { name: 'webkit-375', use: { browserName: 'webkit', viewport: { width: 375, height: 1000 }, hasTouch: true } },
  ],
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'home-report' }],
    ['json', { outputFile: 'home-report/results.json' }],
    ['junit', { outputFile: 'home-report/results.xml' }],
  ],
  outputDir: 'home-test-results',
  webServer: brand.webServer,
});
