import { defineConfig } from '@playwright/test';
import brand from './playwright.brand.config';
export default defineConfig({
  ...brand,
  testMatch: 'protest-guide.spec.ts',
  testIgnore: [],
  projects: [320, 390, 768, 1440].map(width => ({name: `guide-${width}`, use: {viewport: {width, height: 1000}}})),
  reporter: [['list'], ['html', {open:'never',outputFolder:'guide-report'}]],
  outputDir: 'guide-test-results',
});
