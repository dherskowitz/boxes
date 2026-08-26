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

test.describe('list grids', () => {
  /** Two elements are side by side when they share a row and do not overlap. */
  async function assertSideBySide(page: import('@playwright/test').Page, testId: string) {
    const cards = page.getByTestId(testId)
    await expect(cards.first()).toBeVisible()
    const a = await cards.nth(0).boundingBox()
    const b = await cards.nth(1).boundingBox()
    if (!a || !b) throw new Error(`expected at least two ${testId} elements`)
    expect(Math.abs(b.y - a.y)).toBeLessThan(2)
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.width)
  }

  test('lays boxes out side by side', async ({ page }) => {
    await page.goto('/boxes')
    await assertSideBySide(page, 'box-card')
  })

  test('lays items out side by side', async ({ page }) => {
    await page.goto('/items')
    await assertSideBySide(page, 'item-row')
  })

  test('grids at tablet width too', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await page.goto('/boxes')
    await assertSideBySide(page, 'box-card')
  })

  test('every card fits its frame', async ({ page }) => {
    // Asserting the document does not scroll sideways proves nothing when a
    // container clips: `overflow: hidden` turns an overflow bug into a silent
    // cropping bug and the check still passes. Measure each card instead.
    await page.goto('/boxes')
    await expect(page.getByTestId('box-card').first()).toBeVisible()
    const overflowing = await page
      .getByTestId('box-card')
      .evaluateAll(els => els.filter(el => el.scrollWidth > el.clientWidth + 1).length)
    expect(overflowing).toBe(0)
  })
})

test.describe('promoted actions', () => {
  test('offers New box in the header, not as a floating button', async ({ page }) => {
    await page.goto('/boxes')
    await expect(page.getByTestId('new-box')).toBeVisible()
    // Still in the DOM, hidden by CSS — assert visibility, not count.
    await expect(page.getByTestId('new-box-fab')).toBeHidden()
  })

  test('keeps the floating button at tablet width', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await page.goto('/boxes')
    await expect(page.getByTestId('new-box-fab')).toBeVisible()
    await expect(page.getByTestId('new-box')).toBeHidden()
  })

  test('New box in the header actually opens the form', async ({ page }) => {
    await page.goto('/boxes')
    await page.getByTestId('new-box').click()
    await expect(page).toHaveURL('/box/new')
  })

  test('sits Add item beside the Items heading, not over the page', async ({ page }) => {
    await page.goto('/boxes')
    await page.getByTestId('box-card').first().click()
    const add = page.getByTestId('add-item')
    await expect(add).toBeVisible()
    // Static, not fixed: a floating bar across a wide window reads as
    // leftover phone chrome, and it would sit under the rail.
    const position = await add.evaluate(el => {
      const bar = el.closest('.sb-action-bar')
      if (!bar) throw new Error('expected Add item inside .sb-action-bar')
      return getComputedStyle(bar).position
    })
    expect(position).toBe('static')
  })
})

test.describe('article and form measures', () => {
  test('reads an item as one narrow column', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1200 })
    await page.goto('/items')
    await page.getByTestId('item-card').first().click()
    const article = page.locator('.sb-measure-article')
    await expect(article).toBeVisible()
    const box = await article.boundingBox()
    if (!box) throw new Error('expected a measured article region')
    expect(box.width).toBeLessThanOrEqual(768) // 48rem
  })

  test('holds a form to a form-sized measure', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1200 })
    await page.goto('/box/new')
    const form = page.locator('.sb-measure-form')
    await expect(form).toBeVisible()
    const box = await form.boundingBox()
    if (!box) throw new Error('expected a measured form region')
    expect(box.width).toBeLessThanOrEqual(672) // 42rem
  })
})

test.describe('phone layout', () => {
  // Task 2 swapped every list wrapper from `flex flex-col` to `grid` so the
  // `md:` column counts have something to apply to. `display: grid` with no
  // template columns must still stack — if someone drops an `md:` prefix and
  // a grid gets columns at phone width, this is what catches it.
  test('stacks boxes in one column at phone width', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 })
    await page.goto('/boxes')
    const cards = page.getByTestId('box-card')
    await expect(cards.first()).toBeVisible()
    const a = await cards.nth(0).boundingBox()
    const b = await cards.nth(1).boundingBox()
    if (!a || !b) throw new Error('expected at least two box cards')
    expect(b.x).toBeCloseTo(a.x, 0)
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height)
  })
})

test.describe('login', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('centres its card instead of stretching it', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1200 })
    await page.goto('/login')
    const field = page.getByLabel('Email')
    await expect(field).toBeVisible()
    const box = await field.boundingBox()
    if (!box) throw new Error('expected a measured email field')
    expect(box.width).toBeLessThanOrEqual(600)
    // Centred, not pinned left: the card's midpoint sits near the viewport's.
    expect(box.x + box.width / 2).toBeGreaterThan(900)
  })
})

// What the wide-screen screenshot sweep turned up. Each of these renders
// correctly on a phone and only comes apart once there is room to spare.
test.describe('sweep fixes', () => {
  test('lines Add item up with the Items heading', async ({ page }) => {
    await page.goto('/boxes')
    await page.getByTestId('box-card').first().click()
    const add = page.getByTestId('add-item')
    await expect(add).toBeVisible()
    const heading = page.getByRole('heading', { level: 2, name: /^Items/ })
    const a = await add.boundingBox()
    const h = await heading.boundingBox()
    if (!a || !h) throw new Error('expected Add item and the Items heading')
    // Same row: the two boxes overlap vertically. Left as its own row it sat
    // in a band of empty space between the heading and the first card.
    expect(a.y).toBeLessThan(h.y + h.height)
    expect(a.y + a.height).toBeGreaterThan(h.y)
  })

  test('fits the archived title on one line once there is room', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await page.goto('/archived')
    const title = page.getByRole('heading', { level: 1, name: 'Archived boxes' })
    await expect(title).toBeVisible()
    const box = await title.boundingBox()
    if (!box) throw new Error('expected a measured archived title')
    // The phone breaks it over two lines on purpose; at 30px type a second
    // line puts this over 70px.
    expect(box.height).toBeLessThan(50)
  })

  test('wraps the recent locations rather than clipping them', async ({ page }) => {
    await page.goto('/box/new')
    const chip = page.locator('[data-testid^="recent-location-"]').first()
    await expect(chip).toBeVisible()
    // The row scrolls sideways on a phone by design. Inside the desktop form
    // measure that cut the last suggestion in half with the page half empty.
    const overflowing = await chip.evaluate((el) => {
      const row = el.parentElement
      if (!row) throw new Error('expected a suggestions row')
      return row.scrollWidth > row.clientWidth + 1
    })
    expect(overflowing).toBe(false)
  })
})
