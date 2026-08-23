import { expect, test } from '@playwright/test'

test.use({ storageState: 'tests/e2e/.auth/rae.json' })

test('names who is signed in and what they can do', async ({ page }) => {
  await page.goto('/more')
  await expect(page.getByText('Rae Lindqvist')).toBeVisible()
  await expect(page.getByTestId('more-role')).toContainText('Member')
})

// The nav pill carries five slots; everything else in the app hangs off here,
// so a broken link on this page makes a whole screen unreachable.
test('reaches the screens the nav pill has no room for', async ({ page }) => {
  for (const [name, url] of [
    ['Tags', '/tags'],
    ['Items', '/items'],
    ['Print sheet', '/print-sheet']
  ] as const) {
    await page.goto('/more')
    await page.getByRole('link', { name, exact: false }).first().click()
    await expect(page).toHaveURL(url)
  }
})

test('sets the theme, and it survives a navigation', async ({ page }) => {
  await page.goto('/more')
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.goto('/boxes')
  await expect(page.locator('html')).toHaveClass(/dark/)
  // Put it back to following the phone, which is where it starts: colour mode
  // is stored per origin, and every later test in this worker shares it.
  await page.goto('/more')
  await page.getByRole('button', { name: 'Auto', exact: true }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
})

test('signs out and lands back on the login screen', async ({ page }) => {
  await page.goto('/more')
  await page.getByTestId('sign-out').click()
  await expect(page).toHaveURL('/login')
  await expect(page.getByTestId('nav-more')).toBeHidden()
})
