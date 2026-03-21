// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02, // allow 2% pixel diff before failing visual tests
    },
  },
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:8888',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    // Mobile emulation uses Chromium with mobile viewport + touch support
    {
      name: 'mobile-android',
      use: { ...devices['Pixel 5'], browserName: 'chromium' },
    },
    // Uncomment once `npx playwright install webkit` has been run:
    // { name: 'mobile-iphone', use: { ...devices['iPhone 13'] } },
  ],
});
