import { expect, test } from '@playwright/test'
import { authedPb, throwawayBoxes } from './helpers'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

const throwaway = throwawayBoxes()

test('lists active boxes and hides archived ones by default', async ({ page }) => {
  await page.goto('/boxes')
  await expect(page.getByText('Winter coats and boots')).toBeVisible()
  await expect(page.getByText('Empty spare box')).toBeVisible()
  // seedbox5 is archived
  await expect(page.getByText('College photo albums')).toBeHidden()
})

test('adds archived boxes as a second section rather than swapping the list', async ({ page }) => {
  await page.goto('/boxes')
  await page.getByTestId('open-filters').click()
  await page.getByTestId('show-archived').click()
  await page.getByTestId('apply-filters').click()
  await expect(page.getByTestId('box-section-archived').getByText('College photo albums')).toBeVisible()
  // PRD §7.2: archived boxes are *included*, not substituted — the active
  // boxes must still be on screen.
  await expect(page.getByTestId('box-section-active').getByText('Winter coats and boots')).toBeVisible()
})

test('opens a box from its card', async ({ page }) => {
  await page.goto('/boxes')
  await page.getByText('Winter coats and boots').click()
  await expect(page).toHaveURL('/box/seedbox1')
})

test('shows the empty state when there are no active boxes', async ({ page }) => {
  // The index is a global list, so a genuinely empty database would mean
  // archiving boxes other spec files are reading concurrently. Stubbing the
  // list response exercises the same render branch and cannot corrupt a
  // shared fixture.
  await page.route('**/api/collections/storage_boxes/records?*', route =>
    route.fulfill({ json: { page: 1, perPage: 30, totalItems: 0, totalPages: 0, items: [] } })
  )
  await page.goto('/boxes')
  await expect(page.getByTestId('box-list-empty-active')).toBeVisible()
})

// The primary action lands on the label, not the box. A box exists to have a
// code on its side, and making that a second trip through the index is how one
// ends up taped shut and unlabelled.
test('creates a box with only a title and lands on its label', async ({ page }) => {
  await page.goto('/box/new')
  await page.getByLabel('Title').fill('Loft bedding and spare pillows')
  await page.getByTestId('box-submit').click()
  await expect(page).toHaveURL(/\/box\/[a-z0-9]{8}\/print$/)
  await expect(page.getByText('Loft bedding and spare pillows')).toBeVisible()

  const qrId = new URL(page.url()).pathname.split('/')[2]
  const pb = await authedPb()
  const created = await pb.collection('storage_boxes').getFirstListItem(pb.filter('qr_id = {:qrId}', { qrId }))
  throwaway.push(created.id)
})

// The header's Save is the other half: same create, but it stays out of the
// print flow for a box whose label is already on it.
test('the header save creates the box and lands on the box', async ({ page }) => {
  await page.goto('/box/new')
  await page.getByLabel('Title').fill('Spare curtain poles and brackets')
  await page.getByTestId('form-save').click()
  await expect(page).toHaveURL(/\/box\/[a-z0-9]{8}$/)
  await expect(page.getByText('Spare curtain poles and brackets')).toBeVisible()

  const qrId = new URL(page.url()).pathname.split('/').pop()
  const pb = await authedPb()
  const created = await pb.collection('storage_boxes').getFirstListItem(pb.filter('qr_id = {:qrId}', { qrId }))
  throwaway.push(created.id)
})

test('disables the submit button while the create request is pending', async ({ page }) => {
  // Hold the create request open. Against a local PocketBase the round trip
  // can finish inside a single assertion poll, which made this pass or fail on
  // machine load rather than on the pending state actually working.
  await page.route('**/api/collections/storage_boxes/records', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    await new Promise(resolve => setTimeout(resolve, 1500))
    return route.continue()
  })

  await page.goto('/box/new')
  await page.getByLabel('Title').fill('Loft bedding, take two')
  const button = page.getByTestId('box-submit')
  await button.click()
  // The pending state disables the button synchronously, before the request
  // resolves — this, not a race on a second click, is what actually prevents
  // a duplicate box on a fast double-tap.
  await expect(button).toBeDisabled()
  await expect(page).toHaveURL(/\/box\/[a-z0-9]{8}\/print$/)

  const qrId = new URL(page.url()).pathname.split('/')[2]
  const pb = await authedPb()
  const created = await pb.collection('storage_boxes').getFirstListItem(pb.filter('qr_id = {:qrId}', { qrId }))
  throwaway.push(created.id)
})
