import { readFileSync } from 'node:fs'
import PocketBase from 'pocketbase'
import { expect, test } from '@playwright/test'

// The bulk-move test temporarily moves a seeded item into seedbox4 (the
// empty-box fixture used by another test in this file) and restores it
// afterward — run the whole file serially so the two can't race.
test.describe.configure({ mode: 'serial' })

function pocketbaseUrl(): string {
  const env = readFileSync('.env', 'utf-8')
  const match = env.match(/NUXT_PUBLIC_POCKETBASE_URL=(.+)/)
  const url = match?.[1]
  if (!url) throw new Error('NUXT_PUBLIC_POCKETBASE_URL not set in .env')
  return url.trim()
}

async function authedPb(): Promise<PocketBase> {
  const pb = new PocketBase(pocketbaseUrl())
  await pb.collection('users').authWithPassword('dana@local.test', 'storagedev123')
  return pb
}

test.describe('as the box creator', () => {
  test.use({ storageState: 'tests/e2e/.auth/dana.json' })

  test('sees edit and delete controls', async ({ page }) => {
    await page.goto('/box/seedbox1')
    await expect(page.getByTestId('edit-box')).toBeVisible()
    await expect(page.getByTestId('delete-box')).toBeVisible()
  })

  test('lists the items in the box', async ({ page }) => {
    await page.goto('/box/seedbox1')
    await expect(page.getByText('Navy wool peacoat')).toBeVisible()
  })

  test('shows an empty state for a box with no items', async ({ page }) => {
    await page.goto('/box/seedbox4')
    await expect(page.getByTestId('item-list-empty')).toBeVisible()
  })

  test('shows a not-found state for an unknown code', async ({ page }) => {
    await page.goto('/box/nosuchbox')
    await expect(page.getByTestId('box-not-found')).toBeVisible()
  })

  test('can bulk-move items to another box and back', async ({ page }) => {
    await page.goto('/box/seedbox2')
    await page.getByTestId('toggle-select').click()
    await page.getByTestId('item-select').first().click()
    await page.getByTestId('move-items').click()
    await page.getByTestId('move-target').click()
    await page.getByRole('option', { name: 'Empty spare box' }).click()
    await page.getByTestId('confirm-move').click()
    await expect(page.getByTestId('move-target')).toBeHidden()

    await page.goto('/box/seedbox4')
    await expect(page.getByTestId('item-list-empty')).toBeHidden()

    // restore seed data for the other bulk-move-adjacent tests in this file
    const pb = await authedPb()
    const moved = await pb.collection('storage_items').getFirstListItem(
      pb.filter('box.qr_id = {:qrId}', { qrId: 'seedbox4' })
    )
    const original = await pb.collection('storage_boxes').getFirstListItem(
      pb.filter('qr_id = {:qrId}', { qrId: 'seedbox2' })
    )
    await pb.collection('storage_items').update(moved.id, { box: original.id })
  })
})

test.describe('as a granted editor', () => {
  test.use({ storageState: 'tests/e2e/.auth/sam.json' })

  test('can edit the box they were granted, but not delete it', async ({ page }) => {
    await page.goto('/box/seedbox1')
    await expect(page.getByTestId('edit-box')).toBeVisible()
    await expect(page.getByTestId('delete-box')).toBeHidden()
  })

  test('cannot edit a box they were not granted', async ({ page }) => {
    await page.goto('/box/seedbox2')
    await expect(page.getByTestId('edit-box')).toBeHidden()
  })
})

test.describe('as a read-only member', () => {
  test.use({ storageState: 'tests/e2e/.auth/rae.json' })

  test('can view every box but edit none', async ({ page }) => {
    await page.goto('/box/seedbox1')
    await expect(page.getByText('Winter coats and boots')).toBeVisible()
    await expect(page.getByTestId('edit-box')).toBeHidden()
    await expect(page.getByTestId('add-item')).toBeHidden()
  })
})
