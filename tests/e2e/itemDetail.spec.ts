import { expect, test } from '@playwright/test'
import { authedPb, createBox, createItem, throwawayBoxes } from './helpers'

// Every test that writes creates its own box — nothing here touches a seeded
// box's contents, so this file can run beside any other spec file.

// A minimal valid 1x1 PNG, generated on the fly rather than committing a binary fixture.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

test.describe('as the box creator', () => {
  test.use({ storageState: 'tests/e2e/.auth/dana.json' })

  const throwaway = throwawayBoxes()

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

  test('adds an item with multiple photos and sees them in a described gallery', async ({ page }) => {
    const pb = await authedPb()
    const box = await createBox(pb, { title: 'Guest room linens' })
    throwaway.push(box.id)

    await page.goto(`/box/${box.qr_id}`)
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
    // A photo with no alt text is invisible to a screen reader.
    await expect(page.getByTestId('item-gallery-image').first())
      .toHaveAttribute('alt', 'Spare duvet and two pillows, photo 1')
  })

  test('edits an item title through the UI and sees it on the page', async ({ page }) => {
    const pb = await authedPb()
    const box = await createBox(pb, { title: 'Bike spares' })
    throwaway.push(box.id)
    const item = await createItem(pb, { boxId: box.id, title: 'Inner tubes, 700x25' })

    await page.goto(`/item/${item.id}`)
    await page.getByTestId('edit-item').click()
    await page.getByLabel('Title').fill('Inner tubes, 700x25c, box of six')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { name: 'Inner tubes, 700x25c, box of six' })).toBeVisible()

    // A real PATCH, not a payload assertion: the update rule rejects any body
    // that carries created_by at all.
    const reloaded = await pb.collection('storage_items').getOne(item.id)
    expect(reloaded.title).toBe('Inner tubes, 700x25c, box of six')
  })

  test('deletes an item only after confirming', async ({ page }) => {
    const pb = await authedPb()
    const box = await createBox(pb, { title: 'Old cables' })
    throwaway.push(box.id)
    const item = await createItem(pb, { boxId: box.id, title: 'VGA cable, 2m' })

    await page.goto(`/item/${item.id}`)
    await page.getByTestId('delete-item').click()
    await expect(page.getByTestId('delete-item-confirm')).toContainText('VGA cable, 2m')
    await page.getByTestId('cancel-delete-item').click()
    await expect(page).toHaveURL(`/item/${item.id}`)

    await page.getByTestId('delete-item').click()
    await page.getByTestId('confirm-delete-item').click()
    await expect(page).toHaveURL(`/box/${box.qr_id}`)
    await expect(page.getByTestId('item-list-empty')).toBeVisible()
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
