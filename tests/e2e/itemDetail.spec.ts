import { expect, test } from '@playwright/test'
import { authedPb, createBox, createItem, itemAction, openItemActions, throwawayBoxes } from './helpers'

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

  // Enter writes a newline here, unlike a chat box: a note about a stored item
  // is often two lines, and losing the second one to a reflex keypress is the
  // more expensive mistake. Send is the button.
  test('writes a new line on Enter and posts from the button', async ({ page }) => {
    const pb = await authedPb()
    const box = await createBox(pb, { title: 'Loft: cables and adaptors' })
    throwaway.push(box.id)
    const item = await createItem(pb, { boxId: box.id, title: 'Kettle lead, 2m' })

    await page.goto(`/item/${item.id}`)
    const input = page.getByTestId('comment-input')

    await input.fill('Third one down')
    await input.press('Enter')
    await expect(input).toHaveValue('Third one down\n')

    await input.fill('Goes with the amp in box 4')
    await page.getByTestId('comment-submit').click()
    await expect(page.getByText('Goes with the amp in box 4')).toBeVisible()
    await expect(input).toHaveValue('')
  })

  test('sends an unknown item id to the 404 screen, not a bare line of text', async ({ page }) => {
    await page.goto('/item/nosuchitem')
    await expect(page.getByTestId('error-page')).toBeVisible()
    await expect(page.getByTestId('error-status')).toHaveText('404')
    // The same screen a wrong URL gets: a missing record is the same mistake.
    await expect(page.getByTestId('error-home')).toBeVisible()
  })

  test('adds an item with multiple photos and sees them in a described gallery', async ({ page }) => {
    const pb = await authedPb()
    const box = await createBox(pb, { title: 'Guest room linens' })
    throwaway.push(box.id)

    await page.goto(`/box/${box.qr_id}/item/new`)
    await page.getByLabel('Title').fill('Spare duvet and two pillows')
    await page.getByTestId('photo-library-input').setInputFiles([
      { name: 'a.png', mimeType: 'image/png', buffer: TINY_PNG },
      { name: 'b.png', mimeType: 'image/png', buffer: TINY_PNG }
    ])
    // Save item lands on the item it just made, so there is no hop back
    // through the box for the gallery assertions below.
    await page.getByTestId('item-submit').click()
    await expect(page).toHaveURL(/\/item\/\w+$/)
    await expect(page.getByTestId('item-gallery-image')).toHaveCount(2)
    // A photo with no alt text is invisible to a screen reader.
    await expect(page.getByTestId('item-gallery-image').first())
      .toHaveAttribute('alt', 'Spare duvet and two pillows, photo 1')
  })

  test('opens the photo viewer and moves through the set', async ({ page }) => {
    const pb = await authedPb()
    const box = await createBox(pb, { title: 'Shed: hand tools' })
    throwaway.push(box.id)

    await page.goto(`/box/${box.qr_id}/item/new`)
    await page.getByLabel('Title').fill('Ratchet set and sockets')
    await page.getByTestId('photo-library-input').setInputFiles([
      { name: 'a.png', mimeType: 'image/png', buffer: TINY_PNG },
      { name: 'b.png', mimeType: 'image/png', buffer: TINY_PNG },
      { name: 'c.png', mimeType: 'image/png', buffer: TINY_PNG }
    ])
    await page.getByTestId('item-submit').click()
    await expect(page).toHaveURL(/\/item\/\w+$/)

    // The hero is the way in, and the count replaces the dots that used to
    // claim the static image could be swiped.
    await expect(page.getByTestId('item-photo-count')).toContainText('3 photos')
    await page.getByTestId('open-lightbox').click()

    const viewer = page.getByTestId('photo-lightbox')
    await expect(viewer).toBeVisible()
    await expect(page.getByTestId('lightbox-position')).toHaveText('1 / 3')

    // Arrow keys are the keyboard equivalent of the swipe.
    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('lightbox-position')).toHaveText('2 / 3')
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('lightbox-position')).toHaveText('1 / 3')

    // The dots track the position rather than being pinned to the first photo.
    await page.getByTestId('lightbox-dot-2').click()
    await expect(page.getByTestId('lightbox-position')).toHaveText('3 / 3')
    await expect(page.getByTestId('lightbox-dot-2')).toHaveAttribute('aria-current', 'true')

    await page.keyboard.press('Escape')
    await expect(viewer).toBeHidden()
  })

  test('opens the photo viewer at the thumbnail that was tapped', async ({ page }) => {
    const pb = await authedPb()
    const box = await createBox(pb, { title: 'Shed: fixings' })
    throwaway.push(box.id)

    await page.goto(`/box/${box.qr_id}/item/new`)
    await page.getByLabel('Title').fill('Assorted screws and wall plugs')
    await page.getByTestId('photo-library-input').setInputFiles([
      { name: 'a.png', mimeType: 'image/png', buffer: TINY_PNG },
      { name: 'b.png', mimeType: 'image/png', buffer: TINY_PNG }
    ])
    await page.getByTestId('item-submit').click()
    await expect(page).toHaveURL(/\/item\/\w+$/)

    // The second photo is the first thumbnail below the hero.
    await page.getByRole('button', { name: /View photo 2 .* full screen/ }).click()
    await expect(page.getByTestId('lightbox-position')).toHaveText('2 / 2')
  })

  test('edits an item title through the UI and sees it on the page', async ({ page }) => {
    const pb = await authedPb()
    const box = await createBox(pb, { title: 'Bike spares' })
    throwaway.push(box.id)
    const item = await createItem(pb, { boxId: box.id, title: 'Inner tubes, 700x25' })

    await page.goto(`/item/${item.id}`)
    await itemAction(page, 'Edit item')
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
    await itemAction(page, 'Delete item')
    await expect(page.getByTestId('delete-item-confirm')).toContainText('VGA cable, 2m')
    await expect(page.getByTestId('confirm-delete-item')).toBeDisabled()
    await page.getByTestId('cancel-delete-item').click()
    await expect(page).toHaveURL(`/item/${item.id}`)

    await itemAction(page, 'Delete item')
    await page.getByTestId('delete-item-input').fill('VGA cable, 2m')
    await page.getByTestId('confirm-delete-item').click()
    await expect(page).toHaveURL(`/box/${box.qr_id}`)
    await expect(page.getByTestId('item-list-empty')).toBeVisible()
    // The delete invalidates this item's own detail query, so it refetches and
    // 404s on the way out. That 404 is expected and must not surface.
    await expect(page.getByTestId('error-page')).toBeHidden()
  })

  test('can edit and delete an item on their own box', async ({ page }) => {
    await page.goto('/box/seedbox3')
    await page.getByText('2019 returns and receipts').click()
    await openItemActions(page)
    await expect(page.getByRole('menuitem', { name: 'Edit item' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Delete item' })).toBeVisible()
  })
})

test.describe('as a read-only member', () => {
  test.use({ storageState: 'tests/e2e/.auth/rae.json' })

  test('can view an item but not edit or delete it', async ({ page }) => {
    await page.goto('/box/seedbox1')
    await page.getByText('Navy wool peacoat').click()
    await expect(page.getByText('Navy wool peacoat')).toBeVisible()
    // A read-only member gets no menu at all: there is nothing behind it.
    await expect(page.getByTestId('item-actions')).toBeHidden()
  })
})
