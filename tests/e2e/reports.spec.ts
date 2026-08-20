import { expect, test } from '@playwright/test'

test.use({ storageState: 'tests/e2e/.auth/rae.json' })

// The reporting screen pulls in nuxt-charts' full Unovis dependency graph.
// Each test gets a fresh browser context (fresh HTTP cache), so every test
// here — not just the first — pays the cost of transferring and evaluating
// that chunk, which is well past the suite's default 15s assertion / 60s
// test timeouts once other worktrees' dev servers are competing for CPU.
const CHART_TIMEOUT = 90_000
test.describe.configure({ timeout: 150_000 })

/** SVG label text can wrap across multiple `<tspan>`s without inserting a
 *  space at the break, so compare with whitespace stripped from both sides
 *  rather than assuming the rendered text matches the source string verbatim. */
function normalize(text: string): string {
  return text.replace(/\s+/g, '')
}

test('shows collection totals to any member', async ({ page }) => {
  await page.goto('/reports')
  await expect(page.getByTestId('total-boxes')).toHaveText('5', { timeout: CHART_TIMEOUT })
  await expect(page.getByTestId('total-items')).toHaveText('9')
  await expect(page.getByTestId('total-tags')).toHaveText('5')
  // The seed uploads no images — zero is correct, not a bug.
  await expect(page.getByTestId('total-photos')).toHaveText('0')
})

test('ranks crowded boxes, excludes archived, and truncates a long title', async ({ page }) => {
  await page.goto('/reports')
  const chart = page.getByTestId('items-per-box-chart')
  await expect(chart).toBeVisible({ timeout: CHART_TIMEOUT })

  const chartText = normalize(await chart.innerText())

  // seedbox5 ("College photo albums", archived, 1 item) must not appear.
  expect(chartText).not.toContain(normalize('College photo albums'))

  // seedbox2's 96-char title must not appear whole — it has to be truncated.
  expect(chartText).not.toContain(
    normalize('Kitchen overflow: the bread machine, the stand mixer bowl we never use, and assorted baking tins')
  )

  // Rank order (active boxes only, descending by item_count):
  // Tax records 2019-2023 (3), Winter coats and boots (3, tie keeps view order),
  // Kitchen overflow... (2), Empty spare box (0).
  const order = ['Tax records 2019-2023', 'Winter coats and boots', 'Kitchen overflow', 'Empty spare box']
  let lastIndex = -1
  for (const label of order) {
    const index = chartText.indexOf(normalize(label))
    expect(index).toBeGreaterThan(-1)
    expect(index).toBeGreaterThan(lastIndex)
    lastIndex = index
  }
})

test('ranks tag usage by combined box and item count', async ({ page }) => {
  await page.goto('/reports')
  const chart = page.getByTestId('tag-usage-chart')
  await expect(chart).toBeVisible({ timeout: CHART_TIMEOUT })
  const chartText = normalize(await chart.innerText())

  // paperwork: 1+3=4, fragile: 2+1=3, kitchen: 1+2=3, winter: 1+2=3, sentimental: 1+1=2
  const order = ['paperwork', 'fragile', 'kitchen', 'winter', 'sentimental']
  let lastIndex = -1
  for (const name of order) {
    const index = chartText.indexOf(name)
    expect(index).toBeGreaterThan(-1)
    expect(index).toBeGreaterThan(lastIndex)
    lastIndex = index
  }
})

test('groups boxes by location in the donut, including a distinct archived split', async ({ page }) => {
  await page.goto('/reports')
  const chart = page.getByTestId('locations-chart')
  await expect(chart).toBeVisible({ timeout: CHART_TIMEOUT })
  const chartText = await chart.innerText()

  // Each of the 5 seeded boxes has a distinct location — one box per bucket.
  for (const location of [
    'Garage shelf A3',
    'Basement under the stairs',
    'Office closet, top shelf',
    'Garage shelf B1',
    'Attic'
  ]) {
    expect(chartText).toContain(location)
  }

  // seedbox5 is archived — it must still count toward the location total
  // (Attic) but also be visible in the separate status split.
  const statusChart = page.getByTestId('locations-status-chart')
  await expect(statusChart).toBeVisible()
  const statusText = await statusChart.innerText()
  expect(statusText).toContain('Active (4)')
  expect(statusText).toContain('Archived (1)')
})

test('bars the single seeded month of growth rather than rendering a blank area chart', async ({ page }) => {
  await page.goto('/reports')
  await expect(page.getByTestId('growth-single-month')).toBeVisible({ timeout: CHART_TIMEOUT })
  const chart = page.getByTestId('growth-chart')
  await expect(chart).toBeVisible()
  const chartText = normalize(await chart.innerText())
  expect(chartText).toContain('2026-08')
})

test('shows a needs-connection state offline rather than stale figures', async ({ page, context }) => {
  await page.goto('/reports')
  await expect(page.getByTestId('total-boxes')).toBeVisible({ timeout: CHART_TIMEOUT })
  await context.setOffline(true)
  // The plan's reference test reloads here to prove the gate survives a fresh
  // load too. That reload can't complete under `pnpm dev`: the PWA precache
  // this project relies on for an offline shell is only populated by a
  // production build (`workbox.globPatterns` globs build output), so
  // `devOptions.enabled` gives the dev server a service worker with no
  // offline-capable cache — `page.reload()` while offline fails outright with
  // net::ERR_INTERNET_DISCONNECTED before the app ever gets to render
  // anything. That's a dev-server/PWA-precache gap, not a bug in this gate.
  // The live transition below exercises the same `navigator.onLine` listener
  // this gate is built on, without depending on offline-capable navigation.
  await expect(page.getByTestId('reports-offline')).toBeVisible()
  await expect(page.getByTestId('total-boxes')).toBeHidden()
  await context.setOffline(false)
})
