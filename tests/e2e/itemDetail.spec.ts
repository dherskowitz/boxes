import { readFileSync } from 'node:fs'
import PocketBase from 'pocketbase'
import { expect, test } from '@playwright/test'

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

// A minimal valid 1x1 PNG, generated on the fly rather than committing a binary fixture.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

test.describe('as the box creator', () => {
  test.use({ storageState: 'tests/e2e/.auth/dana.json' })

  test('opens an item from the box detail page and shows its description and notes', async ({ page }) => {
    await page.goto('/box/seedbox1')
    await page.getByText('Navy wool peacoat').click()
    await expect(page).toHaveURL(/\/item\/\w+$/)
    await expect(page.getByText('Navy wool peacoat')).toBeVisible()
    await expect(page.getByText('Size M, from the Boston winters')).toBeVisible()
    await expect(page.getByText('Dry clean before wearing')).toBeVisible()
  })

  test('shows the empty-gallery state for an item with no photos', async ({ page }) => {
    await page.goto('/box/seedbox1')
    await page.getByText('Navy wool peacoat').click()
    await expect(page.getByTestId('item-gallery-empty')).toBeVisible()
  })

  test('shows a not-found state for an unknown item id', async ({ page }) => {
    await page.goto('/item/nosuchitem')
    await expect(page.getByTestId('item-not-found')).toBeVisible()
  })

  test('adds an item with multiple photos and sees them in a gallery', async ({ page }) => {
    await page.goto('/box/seedbox4')
    await page.getByTestId('add-item').click()
    await page.getByLabel('Title').fill('Spare duvet and two pillows')
    await page.getByLabel('Photos').setInputFiles([
      { name: 'a.png', mimeType: 'image/png', buffer: TINY_PNG },
      { name: 'b.png', mimeType: 'image/png', buffer: TINY_PNG }
    ])
    await page.getByRole('button', { name: 'Add item' }).click()
    await expect(page.getByText('Spare duvet and two pillows')).toBeVisible()

    await page.getByText('Spare duvet and two pillows').click()
    await expect(page).toHaveURL(/\/item\/\w+$/)
    await expect(page.getByTestId('item-gallery-image')).toHaveCount(2)

    const itemId = page.url().split('/').pop()
    const pb = await authedPb()
    if (itemId) await pb.collection('storage_items').delete(itemId)
  })

  test('can edit and delete an item on their own box', async ({ page }) => {
    await page.goto('/box/seedbox3')
    await page.getByText('2019 returns and receipts').click()
    await expect(page.getByTestId('edit-item')).toBeVisible()
    await expect(page.getByTestId('delete-item')).toBeVisible()
  })
})

test.describe('as a read-only member', () => {
  test.use({ storageState: 'tests/e2e/.auth/rae.json' })

  test('can view an item but not edit or delete it', async ({ page }) => {
    await page.goto('/box/seedbox1')
    await page.getByText('Navy wool peacoat').click()
    await expect(page.getByText('Navy wool peacoat')).toBeVisible()
    await expect(page.getByTestId('edit-item')).toBeHidden()
    await expect(page.getByTestId('delete-item')).toBeHidden()
  })
})
