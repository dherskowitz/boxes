import { expect, test } from '@playwright/test'
import { authedPb, boxAction, closeMenu, createBox, createItem, openBoxActions, throwawayBoxes } from './helpers'

// No `describe.configure({ mode: 'serial' })`: that only serialises within a
// file, and at --workers=2 the files run concurrently. Every test that writes
// creates its own box and registers it for teardown, so no two spec files can
// reach the same record.

test.describe('as the box creator', () => {
  test.use({ storageState: 'tests/e2e/.auth/dana.json' })

  const throwaway = throwawayBoxes()

  test('sees edit and delete actions in the box menu', async ({ page }) => {
    await page.goto('/box/seedbox1')
    await openBoxActions(page)
    await expect(page.getByRole('menuitem', { name: 'Edit box' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Delete box' })).toBeVisible()
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

  test('sends an unknown code to the 404 screen, not a bare line of text', async ({ page }) => {
    await page.goto('/box/nosuchbox')
    await expect(page.getByTestId('error-page')).toBeVisible()
    await expect(page.getByTestId('error-status')).toHaveText('404')
    await expect(page.getByTestId('error-home')).toBeVisible()
  })

  test('edits a box title through the UI and sees it on the page', async ({ page }) => {
    const pb = await authedPb()
    const box = await createBox(pb, { title: 'Garage shelving brackets' })
    throwaway.push(box.id)

    await page.goto(`/box/${box.qr_id}`)
    await boxAction(page, 'Edit box')
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
    await boxAction(page, 'Archive box')
    // Reopen: the menu closes on select, and the label is the state readout.
    await openBoxActions(page)
    await expect(page.getByRole('menuitem', { name: 'Unarchive box' })).toBeVisible()
    await closeMenu(page)

    await page.goto('/boxes')
    await expect(page.getByTestId('box-section-active').getByText(box.title)).toBeHidden()
    await page.getByTestId('open-filters').click()
    await page.getByTestId('show-archived').click()
    await page.getByTestId('apply-filters').click()
    await expect(page.getByTestId('box-section-archived').getByText(box.title)).toBeVisible()

    await page.goto(`/box/${box.qr_id}`)
    await boxAction(page, 'Unarchive box')
    await openBoxActions(page)
    await expect(page.getByRole('menuitem', { name: 'Archive box' })).toBeVisible()
    await closeMenu(page)

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
    // answers 400 here. The control stays pressable and the dialog explains
    // why nothing can happen — a greyed-out bin with a sentence floating near
    // it left people guessing which of the two belonged to the other.
    await boxAction(page, 'Delete box')
    await expect(page.getByTestId('delete-box-blocked')).toContainText('still holds 1 item')
    // No way through: the confirm is not rendered at all for a blocked delete.
    await expect(page.getByTestId('confirm-delete-box')).toHaveCount(0)
    await page.getByTestId('cancel-delete-box').click()
    await expect(page).toHaveURL(`/box/${box.qr_id}`)
  })

  test('deletes an empty box only after confirming', async ({ page }) => {
    const pb = await authedPb()
    const box = await createBox(pb, { title: 'Broken patio heater, for the tip' })
    throwaway.push(box.id)

    await page.goto(`/box/${box.qr_id}`)
    await boxAction(page, 'Delete box')
    await expect(page.getByTestId('delete-box-confirm')).toContainText(box.title)

    // Deleting is not undoable and there is no trash, so the confirm is armed
    // only by typing the name back.
    await expect(page.getByTestId('confirm-delete-box')).toBeDisabled()
    await page.getByTestId('delete-box-input').fill('Broken patio')
    await expect(page.getByTestId('confirm-delete-box')).toBeDisabled()

    await page.getByTestId('cancel-delete-box').click()
    await expect(page).toHaveURL(`/box/${box.qr_id}`)

    await boxAction(page, 'Delete box')
    // Reopening clears the box: a value left armed from last time would put
    // the red button one tap from a mis-tap.
    await expect(page.getByTestId('delete-box-input')).toHaveValue('')
    await page.getByTestId('delete-box-input').fill(box.title)
    await page.getByTestId('confirm-delete-box').click()
    await expect(page).toHaveURL('/boxes')
    await expect(page.getByText(box.title)).toBeHidden()
    // The delete invalidates this box's own detail query, so it refetches and
    // 404s on the way out. That 404 is expected and must not surface.
    await expect(page.getByTestId('error-page')).toBeHidden()
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

  // This used to assert the opposite: with a pager, a selection had to be
  // dropped when the page changed, because it let someone move items they
  // could no longer see. Infinite scroll appends rather than replaces, so a
  // selected row never leaves the list and clearing the selection would just
  // be losing the reader's work.
  test('keeps a bulk-move selection when the next page loads', async ({ page }) => {
    const pb = await authedPb()
    const box = await createBox(pb, { title: 'Paperbacks, two shelves worth' })
    throwaway.push(box.id)
    // Sequential: the SDK cancels concurrent requests to the same endpoint,
    // and the cancelled ones still land server-side afterwards.
    for (let i = 1; i <= 31; i++) {
      await createItem(pb, { boxId: box.id, title: `Paperback bundle ${String(i).padStart(2, '0')}` })
    }

    await page.goto(`/box/${box.qr_id}`)
    await page.getByTestId('toggle-select').click()
    await page.getByTestId('item-select').first().click()
    await expect(page.getByTestId('move-items')).toBeVisible()

    // Scrolled to, not clicked. The foot is both a button and an
    // IntersectionObserver target: scrolling it into view to click it is what
    // makes the observer fire, so the button detaches mid-click and Playwright
    // retries until it times out. How the next page arrives is not what this
    // test is about — that the selection survives it is.
    await page.getByTestId('item-row').last().scrollIntoViewIfNeeded()
    await expect(page.getByTestId('item-row')).toHaveCount(31)
    await expect(page.getByTestId('move-items')).toBeVisible()
    // Still exactly one, not one per page.
    await expect(page.getByTestId('move-items')).toContainText('Move 1')
  })
})

test.describe('as a granted editor', () => {
  test.use({ storageState: 'tests/e2e/.auth/sam.json' })

  test('can edit the box they were granted, but not delete it', async ({ page }) => {
    await page.goto('/box/seedbox1')
    await openBoxActions(page)
    await expect(page.getByRole('menuitem', { name: 'Edit box' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Delete box' })).toBeHidden()
  })

  test('cannot edit a box they were not granted', async ({ page }) => {
    await page.goto('/box/seedbox2')
    await openBoxActions(page)
    await expect(page.getByRole('menuitem', { name: 'Edit box' })).toBeHidden()
  })
})

test.describe('as a read-only member', () => {
  test.use({ storageState: 'tests/e2e/.auth/rae.json' })

  test('can view every box but edit none', async ({ page }) => {
    await page.goto('/box/seedbox1')
    await expect(page.getByText('Winter coats and boots')).toBeVisible()
    await openBoxActions(page)
    await expect(page.getByRole('menuitem', { name: 'Edit box' })).toBeHidden()
    await expect(page.getByTestId('add-item')).toBeHidden()
  })
})

test.describe('item layout', () => {
  test.use({ storageState: 'tests/e2e/.auth/dana.json' })

  // Which layout reads better depends on the box — twelve near-identical
  // cables want a list, the good crockery wants pictures — so the choice is
  // the reader's, and it has to survive leaving the page. Stored per device,
  // not per box: it is a reading preference, not a fact about this box.
  test('switches the item list between stacked and grid, and remembers which', async ({ page }) => {
    await page.goto('/box/seedbox1')
    const list = page.getByTestId('item-list')
    await expect(list).toHaveAttribute('data-layout', 'row')

    await page.getByTestId('item-layout-grid').click()
    await expect(list).toHaveAttribute('data-layout', 'grid')

    // A different box, and after a reload: the preference is scoped to neither.
    await page.goto('/box/seedbox3')
    await expect(page.getByTestId('item-list')).toHaveAttribute('data-layout', 'grid')
    await page.reload()
    await expect(page.getByTestId('item-list')).toHaveAttribute('data-layout', 'grid')

    // Put it back, so the rest of the run starts from the default.
    await page.getByTestId('item-layout-row').click()
    await expect(page.getByTestId('item-list')).toHaveAttribute('data-layout', 'row')
  })
})
