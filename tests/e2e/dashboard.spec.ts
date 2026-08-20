import { expect, test } from '@playwright/test'
import { authedPb } from './helpers'
import type { ReportBoxFill, ReportTagUsage, StorageBox } from '~/types/pocketbase'

test.use({ storageState: 'tests/e2e/.auth/rae.json' })

// The dashboard pulls in nuxt-charts' Unovis dependency graph for its one
// chart, exactly as /reports does — the same cold-compile budget applies.
const CHART_TIMEOUT = 90_000
test.describe.configure({ timeout: 150_000 })

/** What the recent-boxes block should be showing, read from the API. */
const RECENT_LIMIT = 6

async function recentActiveBoxes(): Promise<StorageBox[]> {
  const pb = await authedPb()
  const page = await pb.collection('storage_boxes').getList<StorageBox>(1, RECENT_LIMIT, {
    filter: pb.filter('status = {:status}', { status: 'active' }),
    sort: '-created'
  })
  return page.items
}

test('shows totals, a chart and recent boxes', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('total-boxes')).toBeVisible({ timeout: CHART_TIMEOUT })

  // Every other spec file creates and deletes its own boxes, so these
  // database-wide aggregates are a moving target — read the same views the
  // page queries rather than hardcoding the seed's counts (CLAUDE.md).
  const pb = await authedPb()
  const [boxFill, tagUsage] = await Promise.all([
    pb.collection('storage_report_box_fill').getFullList<ReportBoxFill>(),
    pb.collection('storage_report_tag_usage').getFullList<ReportTagUsage>()
  ])
  await expect(page.getByTestId('total-boxes')).toHaveText(String(boxFill.length))
  await expect(page.getByTestId('total-items')).toHaveText(
    String(boxFill.reduce((sum, box) => sum + box.item_count, 0))
  )
  await expect(page.getByTestId('total-tags')).toHaveText(String(tagUsage.length))
  await expect(page.getByTestId('total-photos')).toHaveText(
    String(boxFill.reduce((sum, box) => sum + box.photo_count, 0))
  )

  await expect(page.getByTestId('items-per-box-chart')).toBeVisible()

  // The block shows six; the seeded fixture holds five boxes, one of them
  // archived. Assert against what the fixture actually has rather than a
  // hardcoded six.
  const recent = page.getByTestId('recent-boxes')
  const expected = await recentActiveBoxes()
  expect(expected.length).toBeGreaterThan(0)
  await expect(recent.getByTestId('box-card')).toHaveCount(expected.length)
  for (const box of expected) {
    await expect(recent.getByText(box.title)).toBeVisible()
  }
  // PRD §7.2: archived boxes are not in the default view. seedbox5 is archived.
  await expect(recent.getByText('College photo albums')).toBeHidden()
})

test('links to the full reports screen', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('dashboard-reports-link').click()
  await expect(page).toHaveURL('/reports')
  await expect(page.getByTestId('growth-chart')).toBeVisible({ timeout: CHART_TIMEOUT })
})

test('offline, warns the figures are stale but still lists boxes', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByTestId('total-boxes')).toBeVisible({ timeout: CHART_TIMEOUT })
  // Wait for the chart while still online. It is a <LazyReportItemsPerBox>, so
  // its chunk arrives on its own dynamic import after the tiles paint, and this
  // spec runs with service workers blocked — flipping offline mid-import would
  // fail on a race rather than on the offline behaviour being tested. In the
  // built PWA the chunk is precached by globPatterns; here the online wait is
  // what stands in for that.
  await expect(page.getByTestId('items-per-box-chart')).toBeVisible({ timeout: CHART_TIMEOUT })
  const expected = await recentActiveBoxes()
  const first = expected[0]
  expect(first).toBeDefined()

  await context.setOffline(true)
  // No `page.reload()`: this spec runs with service workers blocked
  // (playwright.config.ts), and even in offline.spec.ts the dev server's
  // service worker precaches only `/` itself and none of its modules — an
  // offline navigation dies with net::ERR_INTERNET_DISCONNECTED before the app
  // renders. See docs/testing-offline.md. The live transition exercises the
  // same `useOnline()` signal the notice is built on.
  await expect(page.getByTestId('dashboard-stale')).toBeVisible()

  // This is the offline decision, not the notice. The front door must still
  // show the user their own boxes and the cached figures — a warning that
  // replaced them would be the wall the amendment exists to remove.
  await expect(page.getByTestId('recent-boxes').getByText(first?.title ?? '')).toBeVisible()
  await expect(page.getByTestId('total-boxes')).toBeVisible()
  await expect(page.getByTestId('items-per-box-chart')).toBeVisible()

  // Recent boxes are not covered by the notice — a cached box list is the
  // offline read v1 already promises and needs no apology.
  await expect(page.getByTestId('recent-boxes').getByTestId('dashboard-stale')).toBeHidden()

  // And the notice is not unconditional.
  await context.setOffline(false)
  await expect(page.getByTestId('dashboard-stale')).toBeHidden()
})

// PRD §7.11 lists search on the dashboard too. searchIndexBar.spec.ts covers
// the /boxes copy; without this one a change to the query param would go red
// there and silently break the front door.
test('searching from the dashboard lands on the search page with results', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Search').fill('Winter coats')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page).toHaveURL(/\/search\?q=Winter(\+|%20)coats/)
  await expect(page.getByTestId('search-result-box').getByText('Winter coats and boots')).toBeVisible()
})
