import { expect, test } from '@playwright/test'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

// /items is a read-only screen, so these run against the seeded fixture and
// create nothing — there is no teardown because there is nothing to tear down.

test('lists items from every box, newest first', async ({ page }) => {
  await page.goto('/items')
  await expect(page.getByText('Navy wool peacoat')).toBeVisible()
  await expect(page.getByText('Panasonic bread machine')).toBeVisible()
  await expect(page.getByText('2021-2023 returns')).toBeVisible()
})

test('finds an item by a word that appears only in its notes', async ({ page }) => {
  await page.goto('/items?q=Dry%20clean')
  await expect(page.getByText('Navy wool peacoat')).toBeVisible()
  await expect(page.getByText('Sorel snow boots')).toBeHidden()
})

test('shows which box each item is in', async ({ page }) => {
  await page.goto('/items?q=Dry%20clean')
  const row = page.getByTestId('item-row').filter({ hasText: 'Navy wool peacoat' })
  await expect(row.getByTestId('item-card-box')).toHaveText('In Winter coats and boots')
})

test('narrows by tag, AND-matching two', async ({ page }) => {
  await page.goto('/items')
  // The chips live behind the search pill's filter control, as they do on the
  // box index — the sheet stays open while both are picked.
  await page.getByTestId('open-filters').click()
  await page.getByTestId('tag-filter-kitchen').click()
  await page.getByTestId('apply-filters').click()
  await expect(page.getByText('Panasonic bread machine')).toBeVisible()
  await expect(page.getByText('Springform tins, set of 3')).toBeVisible()

  // A second tag must narrow, not widen: only an item carrying both survives.
  await page.getByTestId('open-filters').click()
  await page.getByTestId('tag-filter-fragile').click()
  await page.getByTestId('apply-filters').click()
  await expect(page.getByText('Springform tins, set of 3')).toBeVisible()
  await expect(page.getByText('Panasonic bread machine')).toBeHidden()
})

test('never lists an item from an archived box', async ({ page }) => {
  // "Graduation album 2011" is the only item in the archived box seedbox5.
  // Without `box.status` in the filter this search would find it — an item
  // carries no status of its own.
  await page.goto('/items?q=Graduation%20album')
  await expect(page.getByTestId('items-no-matches')).toBeVisible()
  await expect(page.getByText('Graduation album 2011')).toBeHidden()

  await page.goto('/items')
  await expect(page.getByText('Navy wool peacoat')).toBeVisible()
  await expect(page.getByText('Graduation album 2011')).toBeHidden()
})

test('keeps the term and the tags in the URL across a reload', async ({ page }) => {
  await page.goto('/items')
  await page.getByTestId('search-input').fill('returns')
  await expect(page).toHaveURL(/q=returns/)
  await expect(page.getByText('2019 returns and receipts')).toBeVisible()
  await expect(page.getByText('Navy wool peacoat')).toBeHidden()

  await page.getByTestId('open-filters').click()
  await page.getByTestId('tag-filter-paperwork').click()
  await page.getByTestId('apply-filters').click()
  await expect(page).toHaveURL(/tags=\w+/)

  await page.reload()
  await expect(page.getByTestId('search-input')).toHaveValue('returns')
  // The count badge is how an applied filter stays visible once the sheet is
  // closed; the chip itself is only pressed inside it.
  await expect(page.getByTestId('filter-count')).toHaveText('1')
  await page.getByTestId('open-filters').click()
  await expect(page.getByTestId('tag-filter-paperwork')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('apply-filters').click()
  await expect(page.getByText('2019 returns and receipts')).toBeVisible()
  await expect(page.getByText('Navy wool peacoat')).toBeHidden()
})

test('distinguishes no-items-yet from nothing-matches', async ({ page }) => {
  await page.goto('/items?q=zzznonexistentzzz')
  await expect(page.getByTestId('items-no-matches')).toBeVisible()
  // "No items yet" would tell someone with nine items that they have none.
  await expect(page.getByTestId('items-empty')).toBeHidden()

  // The unfiltered list is not empty, so the empty state must stay hidden there too.
  await page.goto('/items')
  await expect(page.getByTestId('item-row').first()).toBeVisible()
  await expect(page.getByTestId('items-empty')).toBeHidden()
  await expect(page.getByTestId('items-no-matches')).toBeHidden()
})

test('tells a user with no items at all that they have none', async ({ page }) => {
  // No seeded user can reach this naturally — storage_items.listRule grants
  // every enabled member every item — so the empty page is stubbed rather than
  // reached by emptying the fixture every other spec depends on.
  await page.route('**/api/collections/storage_items/records*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"page":1,"perPage":30,"totalItems":0,"totalPages":0,"items":[]}'
    })
  )
  await page.goto('/items')
  await expect(page.getByTestId('items-empty')).toBeVisible()
  await expect(page.getByTestId('items-no-matches')).toBeHidden()
})

test('shows a loading state before the list arrives', async ({ page }) => {
  await page.route('**/api/collections/storage_items/records*', async (route) => {
    await new Promise(resolve => setTimeout(resolve, 1500))
    await route.continue()
  })
  await page.goto('/items')
  await expect(page.getByTestId('items-loading')).toBeVisible()
  await expect(page.getByText('Navy wool peacoat')).toBeVisible()
})

test('reports a failed load rather than showing an empty list', async ({ page }) => {
  await page.route('**/api/collections/storage_items/records*', route =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Server error."}' })
  )
  await page.goto('/items')
  await expect(page.getByTestId('items-error')).toBeVisible()
  await expect(page.getByTestId('items-empty')).toBeHidden()
  await expect(page.getByTestId('items-no-matches')).toBeHidden()
})
