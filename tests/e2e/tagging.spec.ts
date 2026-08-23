import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { authedPb, boxAction, createBox, createItem, itemAction, tagIdByName, throwawayBoxTitles, throwawayBoxes, throwawayTags } from './helpers'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

const throwaway = throwawayBoxes()
// A box created through the UI has no id until the redirect assertion
// resolves, and that assertion can time out — register it by title up front so
// a hard-killed test cannot leak it into the five-box fixture.
const throwawayTitles = throwawayBoxTitles()
// Every tag these tests create inline is removed after each test — the seeded
// vocabulary is exactly five tags, and /tags and the reports counts read it.
const throwawayTagNames = throwawayTags()

/**
 * Nuxt UI's InputMenu renders its options into a teleported listbox, so the
 * option is not inside the form's own subtree — go through the role rather
 * than a descendant selector.
 */
async function pickTag(page: Page, name: string) {
  const input = page.getByPlaceholder('Add a tag')
  await input.click()
  await input.fill(name)
  await page.getByRole('option').filter({ hasText: name }).first().click()
}

/**
 * A name with no existing match has no option to click — the picker offers to
 * create it instead, on its own row below the (empty) match list.
 */
async function createTagInline(page: Page, name: string) {
  const input = page.getByPlaceholder('Add a tag')
  await input.click()
  await input.fill(name)
  await page.getByTestId('create-tag').click()
}

/**
 * The item form lays the vocabulary out as toggle chips rather than a
 * combobox, so there is nothing to type into — the tag is already on screen.
 * `exact` because "kitchen" is a substring of longer tag names.
 */
async function pickTagChip(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click()
}

async function boxByQrId(qrId: string) {
  const pb = await authedPb()
  return pb.collection('storage_boxes').getFirstListItem<{ id: string, tags: string[] }>(
    pb.filter('qr_id = {:qrId}', { qrId })
  )
}

test('tags a box with an existing tag from autocomplete', async ({ page }) => {
  const pb = await authedPb()
  const winterId = await tagIdByName(pb, 'winter')

  throwawayTitles.push('Ski gear and thermals')
  await page.goto('/box/new')
  await page.getByLabel('Title').fill('Ski gear and thermals')
  await pickTag(page, 'winter')
  await expect(page.getByTestId(`selected-tag-${winterId}`)).toBeVisible()

  // The header's Save, not the print CTA: this test is about the tag landing
  // on the record, and the box page is where the assertions below can read it.
  await page.getByTestId('form-save').click()
  await expect(page).toHaveURL(/\/box\/[a-z0-9]{8}$/)

  const qrId = new URL(page.url()).pathname.split('/').pop() ?? ''
  const created = await boxByQrId(qrId)
  expect(created.tags).toContain(winterId)
})

test('creates a new tag inline while tagging a box', async ({ page }) => {
  const newTag = 'camping gear'
  throwawayTagNames.push(newTag)

  throwawayTitles.push('Tent, poles and the two-burner stove')
  await page.goto('/box/new')
  await page.getByLabel('Title').fill('Tent, poles and the two-burner stove')
  await createTagInline(page, newTag)
  await expect(page.getByText(newTag)).toBeVisible()

  await page.getByTestId('form-save').click()
  await expect(page).toHaveURL(/\/box\/[a-z0-9]{8}$/)

  const qrId = new URL(page.url()).pathname.split('/').pop() ?? ''
  const created = await boxByQrId(qrId)

  const pb = await authedPb()
  const createdTagId = await tagIdByName(pb, newTag)
  expect(created.tags).toContain(createdTagId)
})

test('preserves existing tags when editing a box without touching them', async ({ page }) => {
  // The quiet failure this exists for: `boxUpdatePayload` diffs `edit.tags`
  // against the record's current tags, so a form that initialises the picker
  // to [] instead of the record's tags sends `tags: []` and silently wipes
  // them on a save that only changed the title.
  const pb = await authedPb()
  const winterId = await tagIdByName(pb, 'winter')
  const box = await createBox(pb, { title: 'Attic overflow', tags: [winterId] })
  throwaway.push(box.id)

  await page.goto(`/box/${box.qr_id}`)
  await boxAction(page, 'Edit box')
  await expect(page.getByTestId(`selected-tag-${winterId}`)).toBeVisible()

  await page.getByLabel('Title').fill('Attic overflow, west side')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Attic overflow, west side')).toBeVisible()

  const after = await pb.collection('storage_boxes').getOne<{ tags: string[] }>(box.id)
  expect(after.tags).toEqual([winterId])
})

test('tags an item with an existing tag from autocomplete', async ({ page }) => {
  const pb = await authedPb()
  const kitchenId = await tagIdByName(pb, 'kitchen')
  const box = await createBox(pb, { title: 'Pantry spillover' })
  throwaway.push(box.id)

  await page.goto(`/box/${box.qr_id}/item/new`)
  await page.getByLabel('Title').fill('Cast iron dutch oven')
  await pickTagChip(page, 'kitchen')
  await page.getByTestId('item-submit').click()

  await expect(page).toHaveURL(/\/item\/\w+$/)
  const item = await pb.collection('storage_items').getFirstListItem<{ tags: string[] }>(
    pb.filter('box = {:boxId}', { boxId: box.id })
  )
  expect(item.tags).toContain(kitchenId)
})

test('preserves existing tags when editing an item without touching them', async ({ page }) => {
  // The box-side twin of this lives above. Same quiet failure, own coverage:
  // `itemUpdatePayload` diffs `edit.tags` against the record's current tags,
  // so an ItemForm that initialises the picker to [] sends `tags: []` and
  // wipes the item's tags on a save that only changed the title.
  const pb = await authedPb()
  const winterId = await tagIdByName(pb, 'winter')
  const box = await createBox(pb, { title: 'Loft, gable end' })
  throwaway.push(box.id)
  const item = await createItem(pb, {
    boxId: box.id,
    title: 'Merino base layers, two sets',
    tags: [winterId]
  })

  await page.goto(`/item/${item.id}`)
  await itemAction(page, 'Edit item')
  await expect(page.getByTestId(`selected-tag-${winterId}`)).toBeVisible()

  await page.getByLabel('Title').fill('Merino base layers, three sets')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('heading', { name: 'Merino base layers, three sets' })).toBeVisible()

  const after = await pb.collection('storage_items').getOne<{ tags: string[] }>(item.id)
  expect(after.tags).toEqual([winterId])
})
