import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  // first request to a cold dev server triggers Vite dep pre-bundling
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:3000',
    // mobile-first app — test the primary target
    ...devices['Pixel 7']
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI
  }
})
