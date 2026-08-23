import { expect, test } from '@playwright/test'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

// A wrong address is the most likely way to land here: a QR label for a box
// that has since been deleted resolves to a real route, but a mistyped or
// stale link resolves to nothing at all.
test('an unknown route gets the app-styled not-found screen, not a blank page', async ({ page }) => {
  await page.goto('/no-such-screen')
  await expect(page.getByTestId('error-page')).toBeVisible()
  await expect(page.getByTestId('error-status')).toHaveText('404')
  await expect(page.getByText('Nothing here')).toBeVisible()
  // Nothing diagnostic on a 404 — the router's own "Page not found: /x" says
  // nothing the heading has not.
  await expect(page.getByTestId('error-detail')).toBeHidden()
  // No retry either: reloading a wrong address gets you the same wrong address.
  await expect(page.getByTestId('error-retry')).toBeHidden()
})

test('offers a way back into the app rather than a dead end', async ({ page }) => {
  await page.goto('/no-such-screen')
  await page.getByTestId('error-home').click()
  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('error-page')).toBeHidden()
})

test('reaches the scanner from the not-found screen', async ({ page }) => {
  await page.goto('/no-such-screen')
  await page.getByTestId('error-scan').click()
  await expect(page).toHaveURL('/scan')
})
