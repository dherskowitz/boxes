import { defineConfig, devices } from '@playwright/test'

// Bind explicitly to 127.0.0.1: `localhost` resolves to ::1 on some hosts while
// Chromium dials 127.0.0.1, which makes the suite fail intermittently.
const PORT = process.env.E2E_PORT ?? '3000'
const BASE = `http://127.0.0.1:${PORT}`

// Offline reads cannot be verified against `pnpm dev`: the dev service worker's
// precache manifest is exactly `[{ url: '/' }]`, because `globPatterns` is only
// applied at build time, and its navigation route carries a dev-only
// `allowlist: [/^\/$/]`. Reloading a box offline there fails with
// ERR_INTERNET_DISCONNECTED however correct the caching config is. So
// `offline.spec.ts` gets built output on its own port, and its own auth setup:
// Playwright scopes `storageState` per origin, so the dev server's sessions do
// not carry across.
const BUILD_PORT = process.env.E2E_BUILD_PORT ?? '3100'
const BUILD_BASE = `http://127.0.0.1:${BUILD_PORT}`

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
  webServer: [
    {
      command: `pnpm dev --host 127.0.0.1 --port ${PORT}`,
      // Suppresses the Nuxt DevTools launcher — see nuxt.config.ts.
      env: { E2E: '1' },
      url: BASE,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI
    },
    {
      // Both servers start on every run, whatever `--project` was asked for,
      // so this build is a fixed cost of `pnpm test:e2e`. It is the only way
      // the service worker under test exists at all.
      // Its own build directory: `nuxt build` clears and locks the one it is
      // given, and the dev server above is live in `.nuxt` for the whole run.
      command: `pnpm build && pnpm preview --port ${BUILD_PORT}`,
      env: { NUXT_BUILD_DIR: '.nuxt-e2e' },
      url: BUILD_BASE,
      // A cold `nuxt build` is well past the dev server's two minutes.
      timeout: 600_000,
      // Same footgun as the dev server: a preview left running on this port is
      // reused as-is, serving whatever was built last. Kill it after changing
      // anything the worker precaches.
      reuseExistingServer: !process.env.CI
    }
  ],
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    // The same sign-ins again, against the build. `auth.setup.ts` writes to a
    // `-build` suffix when it runs here, so the two sets never clobber.
    {
      name: 'setup-build',
      testMatch: /auth\.setup\.ts/,
      use: { baseURL: BUILD_BASE }
    },
    {
      name: 'mobile',
      // The desktop layout and the offline reads each get their own project:
      // run responsive.spec.ts at 412px and it asserts a rail exists exactly
      // where it must not, and offline.spec.ts needs built output.
      testIgnore: /(responsive|offline)\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
      dependencies: ['setup']
    },
    {
      name: 'offline',
      testMatch: /offline\.spec\.ts/,
      use: { ...devices['Pixel 7'], baseURL: BUILD_BASE },
      dependencies: ['setup-build']
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
