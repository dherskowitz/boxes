import { expect, test } from '@playwright/test'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

test('searching from the box index lands on the search page with results', async ({ page }) => {
  await page.goto('/boxes')
  await page.getByLabel('Search').fill('Winter coats')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page).toHaveURL(/\/search\?q=Winter(\+|%20)coats/)
  await expect(page.getByTestId('search-result-box').getByText('Winter coats and boots')).toBeVisible()
})
