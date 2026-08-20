import { expect, test } from '@playwright/test'

// These tests exist to prove the service worker caches — it must run here.
test.use({ storageState: 'tests/e2e/.auth/dana.json', serviceWorkers: 'allow' })

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
