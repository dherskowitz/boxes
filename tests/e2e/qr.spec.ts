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

test.describe('batch print sheet', () => {
  test.use({ storageState: 'tests/e2e/.auth/dana.json' })

  test('shows nothing selected until boxes are ticked', async ({ page }) => {
    await page.goto('/print-sheet')
    await expect(page.getByTestId('print-sheet-nothing-selected')).toBeVisible()
    await expect(page.getByTestId(`print-label-seedbox1`)).toBeHidden()
  })

  test('renders one label per selected box, and only for what was selected', async ({ page }) => {
    await page.goto('/print-sheet')
    await page.getByTestId('select-box-seedbox1').click()
    await page.getByTestId('select-box-seedbox2').click()

    await expect(page.getByTestId('print-sheet-nothing-selected')).toBeHidden()
    await expect(page.getByTestId('print-label-seedbox1')).toBeVisible()
    await expect(page.getByTestId('print-label-seedbox2')).toBeVisible()
    await expect(page.getByTestId('print-label-seedbox3')).toBeHidden()

    await expect(page.getByTestId('print-label-seedbox1').getByTestId('qr-code')).toBeVisible()
  })

  test('select-all and clear-all act on the loaded page of boxes', async ({ page }) => {
    await page.goto('/print-sheet')
    await page.getByRole('button', { name: 'Select all' }).click()
    // seedbox5 is archived and excluded by default, consistent with the index
    await expect(page.getByTestId('print-label-seedbox1')).toBeVisible()
    await expect(page.getByTestId('print-label-seedbox4')).toBeVisible()
    await expect(page.getByTestId('select-box-seedbox5')).toHaveCount(0)

    await page.getByRole('button', { name: 'Clear all' }).click()
    await expect(page.getByTestId('print-sheet-nothing-selected')).toBeVisible()
  })
})
