import { defineConfig, devices } from '@playwright/test'

// Bind explicitly to 127.0.0.1: `localhost` resolves to ::1 on some hosts while
// Chromium dials 127.0.0.1, which makes the suite fail intermittently.
const PORT = process.env.E2E_PORT ?? '3000'
const BASE = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: 'tests/e2e',
  // The first navigation against a freshly started dev server compiles the
  // route's full dependency graph on demand and can take longer than the
  // 30s default, failing only the first test in a run.
  timeout: 60_000,
  expect: { timeout: 15_000 },

  // One worker on purpose. With two, /tags intermittently renders its empty
  // state instead of the tag list — but only in a full parallel run: it passes
  // in isolation, passes paired with reports.spec.ts, passes serially, and the
  // fixture is provably intact each time (all five seeded tags still present).
  // Raising the expect timeout to 30s did NOT help, so it is not slowness.
  // The shared resource is the single Nuxt dev server both contexts compile
  // against, not the app or the database — real users get their own client and
  // cache. Serial costs about a minute (5.3m vs 4.3m) and is deterministic.
  workers: 1,
  use: {
    baseURL: BASE,
    // `page.route` does not intercept service-worker-initiated requests, and a
    // StaleWhileRevalidate cache serves a test its own pre-write list back.
    // Blocked by default; offline.spec.ts opts back in — it tests the worker.
    serviceWorkers: 'block',
    // mobile-first app — test the primary target
    ...devices['Pixel 7']
  },
  webServer: {
    command: `pnpm dev --host 127.0.0.1 --port ${PORT}`,
    // Suppresses the Nuxt DevTools launcher — see nuxt.config.ts.
    env: { E2E: '1' },
    url: BASE,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'mobile',
      // The desktop layout gets its own project and its own viewport. Run this
      // spec at 412px and it asserts a rail exists exactly where it must not.
      testIgnore: /responsive\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
      dependencies: ['setup']
    },
    {
      name: 'desktop',
      testMatch: /responsive\.spec\.ts/,
      // An explicit viewport rather than devices['Desktop Chrome']: that preset
      // carries `channel: 'chrome'`, which needs real Chrome installed rather
      // than the bundled Chromium every other project uses. `isMobile` and
      // `hasTouch` must be turned off by hand, because the top-level `use`
      // spreads Pixel 7 and those would otherwise be inherited as true.
      use: {
        viewport: { width: 1280, height: 800 },
        isMobile: false,
        hasTouch: false,
        deviceScaleFactor: 1
      },
      dependencies: ['setup']
    }
  ]
})
