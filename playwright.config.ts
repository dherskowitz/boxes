import { defineConfig, devices } from '@playwright/test'

// Bind explicitly to 127.0.0.1: `localhost` resolves to ::1 on some hosts while
// Chromium dials 127.0.0.1, which makes the suite fail intermittently.
const BASE = 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: 'tests/e2e',
  // The first navigation against a freshly started dev server compiles the
  // route's full dependency graph on demand and can take longer than the
  // 30s default, failing only the first test in a run.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE,
    // mobile-first app — test the primary target
    ...devices['Pixel 7']
  },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 3000',
    url: BASE,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      dependencies: ['setup']
    }
  ]
})
