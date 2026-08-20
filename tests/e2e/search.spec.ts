import { expect, test } from '@playwright/test'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

test('shows the idle state before a term is entered', async ({ page }) => {
  await page.goto('/search')
  await expect(page.getByTestId('search-idle')).toBeVisible()
  await expect(page.getByTestId('search-no-results')).toBeHidden()
})

test('finds a box by title', async ({ page }) => {
  await page.goto('/search?q=Winter%20coats')
  await expect(page.getByTestId('search-result-box').getByText('Winter coats and boots')).toBeVisible()
})

test('finds an item by a word that appears only in its notes', async ({ page }) => {
  await page.goto('/search?q=Dry%20clean')
  await expect(page.getByTestId('search-result-item').getByText('Navy wool peacoat')).toBeVisible()
})

test('excludes an archived box from results by default', async ({ page }) => {
  await page.goto('/search?q=College%20photo')
  await expect(page.getByTestId('search-no-results')).toBeVisible()
})

test("excludes an archived box's item, even though the item has no status of its own", async ({ page }) => {
  await page.goto('/search?q=Graduation%20album')
  await expect(page.getByTestId('search-no-results')).toBeVisible()
})

test('shows no-results for a term that matches nothing', async ({ page }) => {
  await page.goto('/search?q=zzznonexistentzzz')
  await expect(page.getByTestId('search-no-results')).toBeVisible()
})

test('an item result shows its parent box and links to the item detail page', async ({ page }) => {
  await page.goto('/search?q=Dry%20clean')
  const result = page.getByTestId('search-result-item')
  await expect(result.getByText('Winter coats and boots')).toBeVisible()
  await result.click()
  await expect(page).toHaveURL(/\/item\/.+/)
})

test('a box result links to the box detail page', async ({ page }) => {
  await page.goto('/search?q=Winter%20coats')
  await page.getByTestId('search-result-box').click()
  await expect(page).toHaveURL('/box/seedbox1')
})
