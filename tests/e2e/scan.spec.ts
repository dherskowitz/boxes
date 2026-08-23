import { expect, test } from '@playwright/test'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

test('the nav pill reaches the scanner', async ({ page }) => {
  await page.goto('/boxes')
  await page.getByTestId('nav-scan').click()
  await expect(page).toHaveURL('/scan')
  await expect(page.getByTestId('qr-scanner')).toBeVisible()
})

// PRD §7.3's manual fallback: the printed code under the QR square, typed in
// when the label will not scan. The headless browser has no camera, so this
// is also the only path through this screen a machine can take.
test('typing a printed code opens that box', async ({ page }) => {
  await page.goto('/scan')
  await page.getByTestId('scan-enter-code').click()
  await page.getByTestId('scan-code-input').fill('SEEDBOX1')
  await page.getByTestId('scan-code-submit').click()
  await expect(page).toHaveURL('/box/seedbox1')
  await expect(page.getByText('Winter coats and boots')).toBeVisible()
})

test('refuses a code that is not eight characters rather than routing to a 404', async ({ page }) => {
  await page.goto('/scan')
  await page.getByTestId('scan-enter-code').click()
  await page.getByTestId('scan-code-input').fill('abc')
  await page.getByTestId('scan-code-submit').click()
  await expect(page.getByText('A box code is eight letters and digits.')).toBeVisible()
  await expect(page).toHaveURL('/scan')
})
