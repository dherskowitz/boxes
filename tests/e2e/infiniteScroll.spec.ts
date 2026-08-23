import { expect, test } from '@playwright/test'
import { authedPb, createBox, createItem, throwawayBoxes } from './helpers'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

const throwaway = throwawayBoxes()

// PER_PAGE is 30, so a box holding 34 items spans two pages. Built here rather
// than seeded: the shared fixture is small on purpose, and every other spec
// asserts against its exact contents.
const PER_PAGE = 30
const OVERFLOW = PER_PAGE + 4

test.describe.configure({ timeout: 180_000 })

test('loads the next page of items on scroll, without a pager', async ({ page }) => {
  const pb = await authedPb()
  const box = await createBox(pb, { title: 'Loft: the whole cable drawer' })
  throwaway.push(box.id)

  // Sequential, not Promise.all: the SDK cancels concurrent requests to the
  // same endpoint, and the cancelled ones still land server-side afterwards.
  for (let n = 1; n <= OVERFLOW; n++) {
    await createItem(pb, { boxId: box.id, title: `Cable ${String(n).padStart(2, '0')}` })
  }

  await page.goto(`/box/${box.qr_id}`)
  await expect(page.getByTestId('item-row')).toHaveCount(PER_PAGE)
  // Sorted newest first, so the *first* cable made is the one on page two.
  await expect(page.getByText('Cable 01')).toBeHidden()

  // Scrolling to the foot is what asks for the next page — no page numbers.
  await page.getByTestId('infinite-more').scrollIntoViewIfNeeded()
  await expect(page.getByTestId('item-row')).toHaveCount(OVERFLOW)
  await expect(page.getByText('Cable 01')).toBeVisible()

  // And it says so once there is nothing left to fetch.
  await expect(page.getByTestId('infinite-end')).toContainText(`All ${OVERFLOW} items`)
  await expect(page.getByTestId('infinite-more')).toBeHidden()
})

test('the foot is a button too, for a reader who never scrolls it into view', async ({ page }) => {
  const pb = await authedPb()
  const box = await createBox(pb, { title: 'Spare parts, unsorted' })
  throwaway.push(box.id)
  for (let n = 1; n <= OVERFLOW; n++) {
    await createItem(pb, { boxId: box.id, title: `Bracket ${String(n).padStart(2, '0')}` })
  }

  await page.goto(`/box/${box.qr_id}`)
  await expect(page.getByTestId('item-row')).toHaveCount(PER_PAGE)
  // An IntersectionObserver never fires for someone driving by keyboard.
  await page.getByRole('button', { name: 'Load more' }).click()
  await expect(page.getByTestId('item-row')).toHaveCount(OVERFLOW)
})

// Narrowing has to start the list again, not append a filtered page to an
// unfiltered one. The query key carries the filters, so changing them drops
// the accumulated pages — this is the assertion that keeps that true.
test('starts again from the first page when the filter changes', async ({ page }) => {
  await page.goto('/items')
  await expect(page.getByTestId('item-row').first()).toBeVisible()

  await page.getByTestId('search-input').fill('returns')
  await expect(page).toHaveURL(/q=returns/)
  await expect(page.getByText('2019 returns and receipts')).toBeVisible()
  await expect(page.getByText('Navy wool peacoat')).toBeHidden()
})
