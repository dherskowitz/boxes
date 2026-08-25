import { expect, test } from '@playwright/test'

// dana owns the seeded boxes, so /boxes has enough cards to prove a grid.
test.use({ storageState: 'tests/e2e/.auth/dana.json' })

const TABLET = { width: 768, height: 1024 }

test.describe('desktop shell', () => {
  test('navigates from a side rail, not the floating pill', async ({ page }) => {
    await page.goto('/boxes')
    await expect(page.getByTestId('nav-rail')).toBeVisible()
    await expect(page.getByTestId('nav-pill')).toHaveCount(0)
    // One nav in the DOM at a time: two would make every existing
    // getByTestId('nav-*') in the suite ambiguous.
    await expect(page.getByTestId('nav-boxes')).toHaveCount(1)
  })

  test('falls back to the pill at tablet width', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await page.goto('/boxes')
    await expect(page.getByTestId('nav-pill')).toBeVisible()
    await expect(page.getByTestId('nav-rail')).toHaveCount(0)
    await expect(page.getByTestId('nav-boxes')).toHaveCount(1)
  })

  test('shows the rail on a screen that hides the pill', async ({ page }) => {
    // Box detail sets `nav: false` because the pill covers the thumb zone it
    // needs for Add item. A side rail takes no thumb zone, so it stays.
    await page.goto('/boxes')
    await page.getByTestId('box-card').first().click()
    await expect(page.getByTestId('add-item')).toBeVisible()
    await expect(page.getByTestId('nav-rail')).toBeVisible()
  })

  test('leaves the scanner chromeless', async ({ page }) => {
    await page.goto('/scan')
    await expect(page.getByTestId('nav-rail')).toHaveCount(0)
    await expect(page.getByTestId('nav-pill')).toHaveCount(0)
  })

  test('caps the content measure on a very wide window', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1200 })
    await page.goto('/boxes')
    const body = page.locator('.sb-body')
    await expect(body).toBeVisible()
    const box = await body.boundingBox()
    if (!box) throw new Error('expected a measured content region')
    // 72rem at the app's 16px root.
    expect(box.width).toBeLessThanOrEqual(1152)
  })

  test('keeps the content clear of the rail', async ({ page }) => {
    await page.goto('/boxes')
    const card = page.getByTestId('box-card').first()
    await expect(card).toBeVisible()
    const rail = await page.getByTestId('nav-rail').boundingBox()
    const first = await card.boundingBox()
    if (!rail || !first) throw new Error('expected a rail and a first card')
    expect(first.x).toBeGreaterThanOrEqual(rail.x + rail.width)
  })
})
