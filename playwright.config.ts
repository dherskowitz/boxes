import { defineConfig, devices } from '@playwright/test'

// Bind explicitly to 127.0.0.1: `localhost` resolves to ::1 on some hosts while
// Chromium dials 127.0.0.1, which makes the suite fail intermittently.
const PORT = process.env.E2E_PORT ?? '3000'
const BASE = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },

  // The suite ran on one worker for a long time because two against the *dev*
  // server made /tags intermittently render its empty state. The shared
  // resource that was blamed is that server's on-demand compilation, and built
  // output does not do any — so the contention goes with it.
  workers: Number(process.env.E2E_WORKERS ?? 4),

  use: {
    baseURL: BASE,
    // `page.route` does not intercept service-worker-initiated requests, and a
    // StaleWhileRevalidate cache serves a test its own pre-write list back.
    // Blocked by default; offline.spec.ts opts back in — it tests the worker.
    serviceWorkers: 'block',
    // mobile-first app — test the primary target
    ...devices['Pixel 7']
  },

  // Built output, not `pnpm dev`, for the whole suite.
  //
  // Two reasons. Offline reads cannot be tested against the dev server at all:
  // its precache manifest is exactly `[{ url: '/' }]`, because `globPatterns`
  // is applied at build time only, and its navigation route carries a dev-only
  // `allowlist: [/^\/$/]` — so reloading a box offline fails with
  // ERR_INTERNET_DISCONNECTED however correct the caching config is. And the
  // dev server compiles each route's dependency graph on first visit, which
  // cost more than everything the suite asserts put together: the median test
  // took 5.9s to sign in, open one page and read one string.
  webServer: {
    // Its own build directory, so a dev server left running elsewhere keeps
    // `.nuxt` — `nuxt build` clears and locks the directory it is given.
    command: `pnpm build && pnpm preview --port ${PORT}`,
    env: { NUXT_BUILD_DIR: '.nuxt-e2e' },
    url: BASE,
    // A cold `nuxt build` is well past a dev server's two minutes.
    timeout: 600_000,
    // Never reuse. A preview already on this port serves whatever was built
    // last, so reusing it would run the suite against stale code and pass —
    // the one failure worse than being slow.
    reuseExistingServer: false
  },

  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    // Read-only specs that assert over the *whole* database — collection
    // totals, the crowded-box ranking, the location donut, the newest items
    // across every box. They create nothing, and they are only correct while
    // the seeded fixture is all there is, so they run in a phase of their own
    // and everything that builds a fixture waits on them. Serialising these
    // three files is what parallelism costs; it is seconds.
    {
      name: 'baseline',
      testMatch: /(reports|items|dashboard)\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
      dependencies: ['setup']
    },
    {
      name: 'mobile',
      // The desktop layout and the offline reads each get their own project:
      // run responsive.spec.ts at 412px and it asserts a rail exists exactly
      // where it must not, and offline.spec.ts needs the service worker the
      // rest of the suite blocks.
      testIgnore: /(responsive|offline|reports|items|dashboard)\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
      dependencies: ['baseline']
    },
    {
      name: 'offline',
      testMatch: /offline\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
      dependencies: ['baseline']
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
      dependencies: ['baseline']
    }
  ]
})
