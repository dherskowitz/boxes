import { expect, test } from '@playwright/test'

test.describe('single label print page', () => {
  test.use({ storageState: 'tests/e2e/.auth/dana.json' })

  test('renders a printable label with the code and a typeable fallback', async ({ page }) => {
    await page.goto('/box/seedbox1/print')
    await expect(page.getByText('Winter coats and boots')).toBeVisible()
    await expect(page.getByTestId('qr-code')).toBeVisible()
    // The human-readable fallback for when a scan fails (PRD §11)
    await expect(page.getByText('seedbox1')).toBeVisible()
  })

  test('shows a not-found state for an unknown code', async ({ page }) => {
    await page.goto('/box/nosuchbox/print')
    await expect(page.getByTestId('box-not-found')).toBeVisible()
  })

  test('encodes the app origin the page is actually served from, not a relative path', async ({ page }) => {
    await page.goto('/box/seedbox1/print')
    const qr = page.getByTestId('qr-code')
    await expect(qr).toBeVisible()
    await expect(qr).toHaveAttribute('data-qr-value', `${new URL(page.url()).origin}/box/seedbox1`)
  })
})
