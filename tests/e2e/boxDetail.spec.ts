import { expect, test } from '@playwright/test'
import { authedPb, createBox, createItem, throwawayBoxes } from './helpers'

// No `describe.configure({ mode: 'serial' })`: that only serialises within a
// file, and at --workers=2 the files run concurrently. Every test that writes
// creates its own box and registers it for teardown, so no two spec files can
// reach the same record.

test.describe('as the box creator', () => {
  test.use({ storageState: 'tests/e2e/.auth/dana.json' })

  const throwaway = throwawayBoxes()

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
    const pb = await authedPb()
    const box = await createBox(pb, { title: 'Camping gear, still to sort' })
    throwaway.push(box.id)

    await page.goto(`/box/${box.qr_id}`)
    await expect(page.getByTestId('item-list-empty')).toBeVisible()
  })

  test('shows a not-found state for an unknown code', async ({ page }) => {
    await page.goto('/box/nosuchbox')
    await expect(page.getByTestId('box-not-found')).toBeVisible()
  })

  test('edits a box title through the UI and sees it on the page', async ({ page }) => {
    const pb = await authedPb()
    const box = await createBox(pb, { title: 'Garage shelving brackets' })
    throwaway.push(box.id)

    await page.goto(`/box/${box.qr_id}`)
    await page.getByTestId('edit-box').click()
    await page.getByLabel('Title').fill('Garage shelving brackets and wall plugs')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { name: 'Garage shelving brackets and wall plugs' })).toBeVisible()

    // The update rule rejects a payload carrying created_by at all, so a PATCH
    // that actually lands is the proof — the payload unit test cannot be.
    const reloaded = await pb.collection('storage_boxes').getOne(box.id)
    expect(reloaded.title).toBe('Garage shelving brackets and wall plugs')
  })

  test('archives and unarchives a box through the UI control', async ({ page }) => {
    const pb = await authedPb()
    const box = await createBox(pb, { title: 'Halloween decorations and pumpkin lights' })
    throwaway.push(box.id)

    await page.goto(`/box/${box.qr_id}`)
    await page.getByTestId('archive-box').click()
    await expect(page.getByTestId('archive-box')).toHaveText('Unarchive')

    await page.goto('/boxes')
    await expect(page.getByTestId('box-section-active').getByText(box.title)).toBeHidden()
    await page.getByTestId('show-archived').click()
    await expect(page.getByTestId('box-section-archived').getByText(box.title)).toBeVisible()

    await page.goto(`/box/${box.qr_id}`)
    await page.getByTestId('archive-box').click()
    await expect(page.getByTestId('archive-box')).toHaveText('Archive')

    await page.goto('/boxes')
    await expect(page.getByTestId('box-section-active').getByText(box.title)).toBeVisible()
  })

  test('cannot delete a box that still holds items', async ({ page }) => {
    const pb = await authedPb()
    const box = await createBox(pb, { title: 'Sewing machine and pattern paper' })
    throwaway.push(box.id)
    await createItem(pb, { boxId: box.id, title: 'Singer 4423, in its hard case' })

    await page.goto(`/box/${box.qr_id}`)
    // storage_items.box is required with cascadeDelete false, so the API
    // answers 400 here — better to explain it than to let the user find out.
    await expect(page.getByTestId('delete-box')).toBeDisabled()
    await expect(page.getByText('Empty this box before deleting it.')).toBeVisible()
  })

  test('deletes an empty box only after confirming', async ({ page }) => {
    const pb = await authedPb()
    const box = await createBox(pb, { title: 'Broken patio heater, for the tip' })
    throwaway.push(box.id)

    await page.goto(`/box/${box.qr_id}`)
    await page.getByTestId('delete-box').click()
    await expect(page.getByTestId('delete-box-confirm')).toContainText(box.title)
    await page.getByTestId('cancel-delete-box').click()
    await expect(page).toHaveURL(`/box/${box.qr_id}`)

    await page.getByTestId('delete-box').click()
    await page.getByTestId('confirm-delete-box').click()
    await expect(page).toHaveURL('/boxes')
    await expect(page.getByText(box.title)).toBeHidden()
  })

  test('can bulk-move items to another box and back', async ({ page }) => {
    const pb = await authedPb()
    const source = await createBox(pb, { title: 'Nursery clothes 0-6 months' })
    const destination = await createBox(pb, { title: 'Nursery clothes 6-12 months' })
    throwaway.push(source.id, destination.id)
    const moving = await createItem(pb, { boxId: source.id, title: 'Striped sleepsuits, five pack' })
    await createItem(pb, { boxId: source.id, title: 'Muslin squares, dozen' })

    await page.goto(`/box/${source.qr_id}`)
    await page.getByTestId('toggle-select').click()
    await page
      .getByTestId('item-row')
      .filter({ hasText: 'Striped sleepsuits, five pack' })
      .getByTestId('item-select')
      .click()
    await page.getByTestId('move-items').click()
    await page.getByTestId('move-target').click()
    await page.getByRole('option', { name: destination.title }).click()
    await page.getByTestId('confirm-move').click()
    await expect(page.getByTestId('move-target')).toBeHidden()

    await page.goto(`/box/${destination.qr_id}`)
    await expect(page.getByText('Striped sleepsuits, five pack')).toBeVisible()

    // Move back by id, never by "whatever item happens to be in that box" — a
    // filter can pick up a record another spec file put there.
    await pb.collection('storage_items').update(moving.id, { box: source.id })
    await page.goto(`/box/${source.qr_id}`)
    await expect(page.getByTestId('item-row')).toHaveCount(2)
  })

  test('refreshes the item list when a bulk move only partly succeeds', async ({ page }) => {
    const pb = await authedPb()
    const source = await createBox(pb, { title: 'Loft insulation offcuts' })
    const destination = await createBox(pb, { title: 'Loft odds and ends' })
    throwaway.push(source.id, destination.id)
    await createItem(pb, { boxId: source.id, title: 'Rockwool roll, half used' })
    await createItem(pb, { boxId: source.id, title: 'Foil-backed board, two sheets' })

    let patches = 0
    await page.route('**/api/collections/storage_items/records/*', async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue()
      patches += 1
      if (patches === 2) {
        return route.fulfill({
          status: 403,
          json: { code: 403, message: 'Only the box owner can move this item.', data: {} }
        })
      }
      return route.continue()
    })

    await page.goto(`/box/${source.qr_id}`)
    await page.getByTestId('toggle-select').click()
    await page.getByTestId('item-select').first().click()
    await page.getByTestId('item-select').last().click()
    await page.getByTestId('move-items').click()
    await page.getByTestId('move-target').click()
    await page.getByRole('option', { name: destination.title }).click()
    await page.getByTestId('confirm-move').click()

    await expect(page.getByText('Moved 1 of 2')).toBeVisible()
    await page.keyboard.press('Escape')
    // One item really did move. If the list still showed both, the user would
    // retry and move the first one twice.
    await expect(page.getByTestId('item-row')).toHaveCount(1)
  })

  test('drops a bulk-move selection when the item list changes page', async ({ page }) => {
    const pb = await authedPb()
    const box = await createBox(pb, { title: 'Paperbacks, two shelves worth' })
    throwaway.push(box.id)
    await Promise.all(
      Array.from({ length: 31 }, (_, i) =>
        createItem(pb, { boxId: box.id, title: `Paperback bundle ${i + 1}` })
      )
    )

    await page.goto(`/box/${box.qr_id}`)
    await page.getByTestId('toggle-select').click()
    await page.getByTestId('item-select').first().click()
    await expect(page.getByTestId('move-items')).toBeVisible()

    await page.getByRole('button', { name: 'Page 2' }).click()
    // A selection that survives a page change lets someone move items they
    // cannot see.
    await expect(page.getByTestId('move-items')).toBeHidden()
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
