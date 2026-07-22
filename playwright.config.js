// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0, // absorb external-network flakes (Google Maps) in CI
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3300',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'vercel dev --listen 3300 --yes',
    url: 'http://localhost:3300',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
