import { expect, test } from '@playwright/test'
import { authedPb, createBox, createItem, throwawayBoxes } from './helpers'

// These tests exist to prove the service worker caches — it must run here.
// The build's origin, not the dev server's — this spec runs in the `offline`
// project, which is the only one with a service worker worth testing.
test.use({ storageState: 'tests/e2e/.auth/dana-build.json', serviceWorkers: 'allow' })

// Nothing here touches a seeded record: the write test builds its own box and
// item and hands them to the shared teardown, which runs in `afterEach` so a
// hard-killed test still cleans up. Comments go with the item on cascade.
const throwaway = throwawayBoxes()

test('a previously-viewed box still opens with no network', async ({ page, context }) => {
  // Prime the cache while online.
  await page.goto('/box/seedbox1')
  await expect(page.getByText('Winter coats and boots')).toBeVisible()
  await expect(page.getByText('Navy wool peacoat')).toBeVisible()

  // The worker is registered by this load but does not serve it: it installs,
  // precaches and only then claims the page. Cutting the network before that
  // leaves the reload with nothing to answer it, which is the same
  // ERR_INTERNET_DISCONNECTED a broken cache config gives — so wait for the
  // claim rather than reading that failure as a caching bug.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 })

  // Then prime again, because claiming an open page does not retrospectively
  // cache what it already fetched: the box, its items and the membership
  // directory all went out before the worker existed. This second load is the
  // one the runtime caching rules actually see. A real user gets this for free
  // on their second visit; the test has to do it in one.
  await page.reload()
  await expect(page.getByText('Navy wool peacoat')).toBeVisible()

  // `setOffline` on a live page fires `offline` and flips `navigator.onLine`,
  // which is why the write tests below need nothing extra. A reload starts a
  // fresh document that reports online again, and that property is the only
  // thing the banner reads — so the signal has to be supplied here. The cache
  // half is real: everything below goes through the worker with no network.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true })
  })
  await context.setOffline(true)
  await page.reload()

  // The layout gates every page on the membership directory — if that is not
  // cached, this fails here rather than on the box content, which is the whole
  // reason this assertion comes first.
  await expect(page.getByTestId('access-denied')).toBeHidden()
  await expect(page.getByTestId('membership-error')).toBeHidden()

  await expect(page.getByText('Winter coats and boots')).toBeVisible()
  await expect(page.getByText('Navy wool peacoat')).toBeVisible()
  await expect(page.getByTestId('offline-banner')).toBeVisible()

  // In flow, not over the page. As a fixed overlay the banner landed on top of
  // each screen's own header — the back chevron, the kebab, the search field —
  // so the notice about not being able to edit was itself the thing in the way.
  const banner = await page.getByTestId('offline-banner').boundingBox()
  const header = await page.locator('header.sb-header').first().boundingBox()
  if (!banner || !header) throw new Error('offline banner and page header must both be on screen')
  expect(banner.y + banner.height).toBeLessThanOrEqual(header.y)

  await context.setOffline(false)
})

test('a write attempted offline says it needs connectivity', async ({ page, context }) => {
  await page.goto('/box/new')
  // Wait for the form before cutting the network. `goto` resolves on `load`,
  // while the SPA is still fetching the chunks it needs to mount — going
  // offline a moment too early kills those and the app never mounts at all,
  // which tests the loader rather than the write guard.
  await expect(page.getByLabel('Title')).toBeVisible()

  await context.setOffline(true)
  await page.getByLabel('Title').fill('Loft bedding')
  await page.getByRole('button', { name: 'Create box' }).click()

  // Scoped to the form's own error, not the page: the offline banner also says
  // "reconnect", so an unscoped text match resolves to two elements and would
  // pass on the banner alone — which proves nothing about the write.
  await expect(page.getByTestId('box-form-error')).toContainText(/connect/i)
  // The user's input must survive — losing it is the failure PRD §7.8 forbids.
  await expect(page.getByLabel('Title')).toHaveValue('Loft bedding')
  // And the control must be usable again, not stuck in its loading state.
  await expect(page.getByRole('button', { name: 'Create box' })).toBeEnabled()

  await context.setOffline(false)
})

// The service worker is what makes this file worth having, and it is also
// where the app's worst class of bug lives: a cached read served back to the
// refetch a write just triggered. Every other spec runs with
// `serviceWorkers: 'block'`, so none of them can see it.
//
// This was real. `pb-api-storage` used StaleWhileRevalidate, so posting a
// comment invalidated the query, the worker answered the refetch from cache,
// and the new comment did not appear until the page was reloaded — while the
// fresh copy sat in the cache with nothing reading it.
test('a write is visible immediately, not on the next reload', async ({ page }) => {
  const pb = await authedPb()
  const box = await createBox(pb, { title: 'Loft insulation offcuts' })
  throwaway.push(box.id)
  const item = await createItem(pb, { boxId: box.id, title: 'Two rolls, part used' })

  await page.goto(`/item/${item.id}`)
  await expect(page.getByTestId('comment-input')).toBeVisible()

  const text = 'Checked against the paper copy'
  await page.getByTestId('comment-input').fill(text)
  await page.getByTestId('comment-submit').click()

  // No reload between the write and this assertion — that is the whole test.
  await expect(page.getByTestId('comment-thread').getByText(text)).toBeVisible()
})
