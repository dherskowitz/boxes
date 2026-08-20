import { expect, test, type Page } from '@playwright/test'
import { pocketbaseUrl } from './helpers'

// Service workers are blocked suite-wide (playwright.config.ts). These tests
// are about what the worker writes into `pb-api-storage`, so they need it —
// and they need no session, because the poisoning happens while signed out.
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'allow' })

const DIRECTORY_PATH = '/api/collections/storage_app_users/records'
// A Workbox cache is keyed by the full URL, so these have to match what the app
// asks for character for character. Both come from `getFullList`'s batch of
// 1000; `useAppUsers()` adds `sort: 'name'` and `login()` does not.
const DIRECTORY_URLS = [
  `${pocketbaseUrl()}${DIRECTORY_PATH}?page=1&perPage=1000&skipTotal=1`,
  `${pocketbaseUrl()}${DIRECTORY_PATH}?page=1&perPage=1000&skipTotal=1&sort=name`
]

/**
 * Wait until the worker actually controls this page.
 *
 * An uncontrolled page's fetches never reach the worker, so without this both
 * tests would pass for the wrong reason.
 */
async function awaitServiceWorker(page: Page) {
  await page.waitForFunction(
    async () => {
      await navigator.serviceWorker.ready
      return navigator.serviceWorker.controller !== null
    },
    null,
    { timeout: 30_000 }
  )
}

/** The `pb-api-storage` entries for the membership directory, if any. */
function cachedDirectoryEntries(page: Page): Promise<string[]> {
  return page.evaluate(async (path) => {
    if (!(await caches.has('pb-api-storage'))) return []
    const cache = await caches.open('pb-api-storage')
    return (await cache.keys()).map(r => r.url).filter(u => u.includes(path))
  }, DIRECTORY_PATH)
}

/**
 * Read the membership directory from the page with no session.
 *
 * PocketBase answers an unauthorised list read with 200 and an empty array —
 * it applies a list rule as a filter, not a rejection — so this is a perfectly
 * cacheable "you are a member of nothing".
 */
async function fetchDirectorySignedOut(page: Page, urls: string[]) {
  const bodies = await page.evaluate(
    us => Promise.all(us.map(u => fetch(u).then(r => r.text()))),
    urls
  )
  for (const body of bodies) expect(JSON.parse(body).items).toEqual([])
  // The worker writes to the cache after the response is handed back, so give
  // it a moment before anything reads the cache or relies on the entry.
  await page.waitForTimeout(1_000)
}

test('a signed-out directory read is never written to the API cache', async ({ page }) => {
  await page.goto('/login')
  await awaitServiceWorker(page)

  await fetchDirectorySignedOut(page, DIRECTORY_URLS)

  expect(await cachedDirectoryEntries(page)).toEqual([])
})

test('an owner signs in normally after the app was opened signed out', async ({ page }) => {
  await page.goto('/login')
  await awaitServiceWorker(page)
  await fetchDirectorySignedOut(page, DIRECTORY_URLS)

  await page.getByLabel('Email').fill('dana@local.test')
  await page.getByLabel('Password').fill('storagedev123')
  await page.getByRole('button', { name: 'Sign in' }).click()

  // The service worker sits *below* the SDK, so `login()`'s deliberate
  // read-past-nuxt-query is still served from `pb-api-storage` — a poisoned
  // entry rejects a genuine owner at the login screen, not just in the layout,
  // which is why this stops at /login rather than reaching the dashboard.
  // 45s for the same reason auth.setup.ts uses it: signing in lands on the
  // dashboard, whose first cold compile pulls in nuxt-charts.
  await expect(page).toHaveURL('/', { timeout: 45_000 })
  await expect(page.getByTestId('access-denied')).toBeHidden()
  await expect(page.getByTestId('membership-error')).toBeHidden()
  await expect(page.getByTestId('total-boxes')).toBeVisible({ timeout: 90_000 })
})

test.describe('signed in', () => {
  test.use({ storageState: 'tests/e2e/.auth/dana.json' })

  // The guard above must not go too far: `pb-api-storage` is what makes the
  // offline read in PRD §3 possible at all, and every request the SDK sends
  // for a signed-in user carries the header it looks for.
  test('a signed-in read is still cached, which is what offline reads rely on', async ({ page }) => {
    await page.goto('/')
    await awaitServiceWorker(page)
    // Reload once the worker has claimed this client: requests made during the
    // very first load happen before it activates and never reach it at all.
    await page.reload()
    await expect(page.getByTestId('total-boxes')).toBeVisible({ timeout: 90_000 })

    await expect.poll(() => cachedDirectoryEntries(page), { timeout: 15_000 })
      .toContain(DIRECTORY_URLS[1])
  })
})
