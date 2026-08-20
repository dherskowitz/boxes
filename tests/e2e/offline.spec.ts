import { expect, test } from '@playwright/test'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

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
  await context.setOffline(true)
  await page.getByLabel('Title').fill('Loft bedding')
  await page.getByRole('button', { name: 'Create box' }).click()

  await expect(page.getByText(/connect/i)).toBeVisible()
  // The user's input must survive — losing it is the failure PRD §7.8 forbids.
  await expect(page.getByLabel('Title')).toHaveValue('Loft bedding')

  await context.setOffline(false)
})
