import { expect, test } from '@playwright/test'
import { authedPb, createBox, createItem, throwawayBoxes } from './helpers'

// These tests exist to prove the service worker caches — it must run here.
test.use({ storageState: 'tests/e2e/.auth/dana.json', serviceWorkers: 'allow' })

// Nothing here touches a seeded record: the write test builds its own box and
// item and hands them to the shared teardown, which runs in `afterEach` so a
// hard-killed test still cleans up. Comments go with the item on cascade.
const throwaway = throwawayBoxes()

test('a previously-viewed box still opens with no network', async ({ page, context }) => {
  // Prime the cache while online.
  await page.goto('/box/seedbox1')
  await expect(page.getByText('Winter coats and boots')).toBeVisible()
  await expect(page.getByText('Navy wool peacoat')).toBeVisible()

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
  // but under `pnpm dev` the SPA is still pulling its module graph from Vite
  // over the network at that point — going offline a moment too early kills
  // those imports and the app never mounts at all, which tests the dev server
  // rather than the write guard.
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
