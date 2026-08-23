import { expect, test } from '@playwright/test'
import { authedPb, createBox, throwawayBoxes } from './helpers'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

// Every test archives boxes it created itself. The seeded boxes are all active
// and several other specs assert that, so nothing here may touch them.
const throwaway = throwawayBoxes()

test('reaches the archived screen from More', async ({ page }) => {
  await page.goto('/more')
  await page.getByRole('link', { name: /Archived boxes/ }).click()
  await expect(page).toHaveURL('/archived')
})

test('unarchives several boxes in one go', async ({ page }) => {
  const pb = await authedPb()
  const winter = await createBox(pb, { title: 'Winter coats and scarves' })
  const skis = await createBox(pb, { title: 'Ski boots and poles' })
  const stays = await createBox(pb, { title: 'Christmas lights, spare bulbs' })
  throwaway.push(winter.id, skis.id, stays.id)
  for (const box of [winter, skis, stays]) {
    await pb.collection('storage_boxes').update(box.id, { status: 'archived' })
  }

  await page.goto('/archived')
  await expect(page.getByTestId(`select-box-${winter.qr_id}`)).toBeHidden()

  await page.getByTestId('toggle-select').click()
  await page.getByTestId(`select-box-${winter.qr_id}`).click()
  await page.getByTestId(`select-box-${skis.qr_id}`).click()
  await expect(page.getByTestId('unarchive-bar')).toContainText('2 selected')

  await page.getByTestId('unarchive-selected').click()

  // The two selected are out; the third was never touched.
  await expect(page.getByText('Winter coats and scarves')).toBeHidden()
  await expect(page.getByText('Ski boots and poles')).toBeHidden()
  await expect(page.getByText('Christmas lights, spare bulbs')).toBeVisible()

  await page.goto('/boxes')
  await expect(page.getByTestId('box-section-active').getByText('Winter coats and scarves')).toBeVisible()
  await expect(page.getByTestId('box-section-active').getByText('Ski boots and poles')).toBeVisible()
})

test('drops the selection when select mode is turned off', async ({ page }) => {
  const pb = await authedPb()
  const box = await createBox(pb, { title: 'Camping stove and gas canisters' })
  throwaway.push(box.id)
  await pb.collection('storage_boxes').update(box.id, { status: 'archived' })

  await page.goto('/archived')
  await page.getByTestId('toggle-select').click()
  await page.getByTestId(`select-box-${box.qr_id}`).click()
  await expect(page.getByTestId('unarchive-bar')).toBeVisible()

  // Leaving select mode with a live selection and coming back would otherwise
  // arm the unarchive button against boxes chosen a while ago.
  await page.getByTestId('toggle-select').click()
  await page.getByTestId('toggle-select').click()
  await expect(page.getByTestId('unarchive-bar')).toBeHidden()
})
