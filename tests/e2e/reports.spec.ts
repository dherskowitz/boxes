import { expect, test } from '@playwright/test'

test.use({ storageState: 'tests/e2e/.auth/rae.json' })

test('shows collection totals to any member', async ({ page }) => {
  await page.goto('/reports')
  await expect(page.getByTestId('total-boxes')).toHaveText('5')
  await expect(page.getByTestId('total-items')).toHaveText('9')
  await expect(page.getByTestId('total-tags')).toHaveText('5')
  // The seed uploads no images — zero is correct, not a bug.
  await expect(page.getByTestId('total-photos')).toHaveText('0')
})
