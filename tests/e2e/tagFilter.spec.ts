import type PocketBase from 'pocketbase'
import { expect, test } from '@playwright/test'
import { authedPb, createBox, throwawayBoxes, throwawayTags } from './helpers'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

const throwaway = throwawayBoxes()
const throwawayTagNames = throwawayTags()

// Filtering is asserted against tags this spec owns, not the seeded five: a
// seeded tag is read by /tags, the reports counts and other spec files, and a
// filter test must be free to be the only thing carrying its tag.
const SHELVING = 'garage shelving'
const SEASONAL = 'seasonal rotation'
const UNUSED = 'awaiting sorting'

async function createTag(pb: PocketBase, name: string): Promise<string> {
  throwawayTagNames.push(name)
  const tag = await pb.collection('storage_tags').create<{ id: string }>({ name, color: '' })
  return tag.id
}

test('filters the box index down to boxes carrying the selected tag', async ({ page }) => {
  const pb = await authedPb()
  const shelvingId = await createTag(pb, SHELVING)
  const tagged = await createBox(pb, { title: 'Garage wall shelves and brackets', tags: [shelvingId] })
  const untagged = await createBox(pb, { title: 'Hallway shoe rack spares' })
  throwaway.push(tagged.id, untagged.id)

  await page.goto('/')
  await expect(page.getByText(untagged.title)).toBeVisible()

  await page.getByTestId(`tag-filter-${SHELVING}`).click()
  await expect(page.getByText(tagged.title)).toBeVisible()
  await expect(page.getByText(untagged.title)).toBeHidden()
  // A seeded box carries its own tags, so it must drop out too.
  await expect(page.getByText('Winter coats and boots')).toBeHidden()
})

test('AND-matches when two tags are selected, rather than widening the list', async ({ page }) => {
  const pb = await authedPb()
  const shelvingId = await createTag(pb, SHELVING)
  const seasonalId = await createTag(pb, SEASONAL)
  const both = await createBox(pb, { title: 'Patio cushions and the parasol base', tags: [shelvingId, seasonalId] })
  const one = await createBox(pb, { title: 'Bike helmets and puncture kit', tags: [shelvingId] })
  throwaway.push(both.id, one.id)

  await page.goto('/')
  await page.getByTestId(`tag-filter-${SHELVING}`).click()
  await expect(page.getByText(one.title)).toBeVisible()

  await page.getByTestId(`tag-filter-${SEASONAL}`).click()
  await expect(page.getByText(both.title)).toBeVisible()
  await expect(page.getByText(one.title)).toBeHidden()
})

test('clearing the tag filter restores the full list', async ({ page }) => {
  const pb = await authedPb()
  const shelvingId = await createTag(pb, SHELVING)
  const tagged = await createBox(pb, { title: 'Paint tins and rollers', tags: [shelvingId] })
  throwaway.push(tagged.id)

  await page.goto('/')
  await page.getByTestId(`tag-filter-${SHELVING}`).click()
  await expect(page.getByText('Winter coats and boots')).toBeHidden()

  await page.getByTestId('clear-tag-filter').click()
  await expect(page.getByText('Winter coats and boots')).toBeVisible()
  await expect(page.getByText(tagged.title)).toBeVisible()
})

test('a filter that matches nothing reads differently from having no boxes at all', async ({ page }) => {
  const pb = await authedPb()
  await createTag(pb, UNUSED)

  await page.goto('/')
  await page.getByTestId(`tag-filter-${UNUSED}`).click()
  await expect(page.getByTestId('box-list-no-matches-active')).toBeVisible()
  // "no boxes yet" would invite the user to create their first box, which is
  // wrong advice when they have plenty and only the filter is too narrow.
  await expect(page.getByTestId('box-list-empty-active')).toBeHidden()
})

test('the archived section honours the tag filter alongside the toggle', async ({ page }) => {
  const pb = await authedPb()
  const seasonalId = await createTag(pb, SEASONAL)
  const archived = await createBox(pb, {
    title: 'Summer parasols, stored for winter',
    status: 'archived',
    tags: [seasonalId]
  })
  throwaway.push(archived.id)

  await page.goto('/')
  await page.getByTestId('show-archived').click()
  await page.getByTestId(`tag-filter-${SEASONAL}`).click()

  await expect(page.getByTestId('box-section-archived').getByText(archived.title)).toBeVisible()
  await expect(page.getByTestId('box-section-archived').getByText('College photo albums')).toBeHidden()
})
