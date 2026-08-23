import { expect, test } from '@playwright/test'
import { authedPb, createBox, throwawayBoxes } from './helpers'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

const throwaway = throwawayBoxes()

test('names the box it is adding to, so the wrong screen is obvious', async ({ page }) => {
  const pb = await authedPb()
  const box = await createBox(pb, { title: 'Garage tools and fixings' })
  throwaway.push(box.id)

  await page.goto(`/box/${box.qr_id}/item/new`)
  await expect(page.getByText('in Garage tools and fixings')).toBeVisible()
})

test('the add-item button on a box opens the form for that box', async ({ page }) => {
  const pb = await authedPb()
  const box = await createBox(pb, { title: 'Loft: camping kit' })
  throwaway.push(box.id)

  await page.goto(`/box/${box.qr_id}`)
  await page.getByTestId('add-item').click()
  await expect(page).toHaveURL(`/box/${box.qr_id}/item/new`)
  await expect(page.getByText('in Loft: camping kit')).toBeVisible()
})

test('save & add another keeps the form open for the next thing', async ({ page }) => {
  // Unpacking is a burst: the second item is already in your other hand. This
  // is the whole reason the action exists, so it is the thing to assert —
  // the record landed AND the form is ready rather than showing the last one.
  const pb = await authedPb()
  const box = await createBox(pb, { title: 'Kitchen: baking' })
  throwaway.push(box.id)

  await page.goto(`/box/${box.qr_id}/item/new`)
  await page.getByLabel('Title').fill('Springform tin, 20cm')
  await page.getByTestId('item-submit-repeat').click()

  await expect(page.getByTestId('item-added')).toContainText('Springform tin, 20cm')
  await expect(page).toHaveURL(`/box/${box.qr_id}/item/new`)
  // Emptied, not left holding the item that was just saved — otherwise the
  // next save silently duplicates it.
  await expect(page.getByLabel('Title')).toHaveValue('')

  await page.getByLabel('Title').fill('Rolling pin')
  await page.getByTestId('item-submit').click()
  await expect(page).toHaveURL(/\/item\/\w+$/)

  const items = await pb.collection('storage_items').getList(1, 10, {
    filter: pb.filter('box = {:boxId}', { boxId: box.id })
  })
  expect(items.totalItems).toBe(2)
  expect(items.items.map(i => i.title).sort()).toEqual(['Rolling pin', 'Springform tin, 20cm'])
})

test('a bad box code gets the 404 screen, not an empty form', async ({ page }) => {
  await page.goto('/box/nosuchbox/item/new')
  await expect(page.getByTestId('error-home')).toBeVisible()
})

test('offers a location already used on another box', async ({ page }) => {
  // Typing a location by hand is how one shelf ends up spelled three ways,
  // and the locations donut on /reports groups on the raw string.
  const pb = await authedPb()
  // Three, not one: the row is ranked by how many boxes use each location and
  // capped, so a count of one could be pushed out by the seeded locations or
  // by whatever a parallel spec happens to have created.
  for (const title of ['Chest spares', 'Bed slats and bolts', 'Curtain rails']) {
    const box = await createBox(pb, { title, location: 'Basement closet' })
    throwaway.push(box.id)
  }

  await page.goto('/box/new')
  const chip = page.getByTestId('recent-location-Basement closet')
  await expect(chip).toBeVisible()
  await chip.click()
  await expect(page.getByLabel('Location')).toHaveValue('Basement closet')
  // Taken by the field, so it is no longer worth suggesting.
  await expect(chip).toBeHidden()
})
