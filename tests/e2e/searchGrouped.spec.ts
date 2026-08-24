import { expect, test } from '@playwright/test'
import { authedPb, createBox, createItem, tagIdByName, throwawayBoxes } from './helpers'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

const throwaway = throwawayBoxes()

// A term of its own, so a parallel spec's fixtures cannot wander into these
// assertions and change the counts.
const TERM = 'zephyrine'

test('groups boxes above items and counts each group', async ({ page }) => {
  const pb = await authedPb()
  const box = await createBox(pb, { title: `${TERM} camping gear`, location: 'Garage shelf B2' })
  throwaway.push(box.id)
  await createItem(pb, { boxId: box.id, title: `${TERM} stove` })

  await page.goto(`/search?q=${TERM}`)
  await expect(page.getByTestId('search-result-box')).toHaveCount(1)
  await expect(page.getByTestId('search-result-item')).toHaveCount(1)
  await expect(page.getByText('Boxes · 1')).toBeVisible()
  await expect(page.getByText('Items · 1')).toBeVisible()
})

test('says nothing extra when the box title is what matched', async ({ page }) => {
  const pb = await authedPb()
  const box = await createBox(pb, { title: `${TERM} loft crate`, location: 'Loft hatch' })
  throwaway.push(box.id)

  await page.goto(`/search?q=${TERM}`)
  // The highlighted title is the explanation; a reason line would be noise.
  await expect(page.getByTestId('box-match-reason')).toHaveText('Loft hatch')
})

test('names the location when the location is what matched', async ({ page }) => {
  const pb = await authedPb()
  const box = await createBox(pb, { title: 'Winter spares crate', location: `${TERM} shelf` })
  throwaway.push(box.id)

  await page.goto(`/search?q=${TERM}`)
  await expect(page.getByTestId('box-match-reason')).toContainText('matched location')
})

test('surfaces a box whose item matched, and says how many', async ({ page }) => {
  // The search this app exists for: the word is on the thing inside, not on
  // the box. Before this the box never appeared at all.
  const pb = await authedPb()
  const box = await createBox(pb, { title: 'Kitchen overflow crate', location: 'Pantry' })
  throwaway.push(box.id)
  await createItem(pb, { boxId: box.id, title: `${TERM} whisk` })
  await createItem(pb, { boxId: box.id, title: `${TERM} sieve` })

  await page.goto(`/search?q=${TERM}`)
  await expect(page.getByTestId('search-result-box')).toHaveCount(1)
  await expect(page.getByTestId('box-match-reason')).toContainText('matched 2 items')
  // Both items still listed in their own right.
  await expect(page.getByTestId('search-result-item')).toHaveCount(2)
})

test('shows the tags narrowing a search on the header, and clears them', async ({ page }) => {
  const pb = await authedPb()
  const winterId = await tagIdByName(pb, 'winter')
  const box = await createBox(pb, { title: `${TERM} ski bag`, tags: [winterId] })
  throwaway.push(box.id)

  await page.goto(`/search?q=${TERM}&tags=${winterId}`)
  // A filter you cannot see is one you forget you set, and then the missing
  // results look like a broken search.
  await expect(page.getByTestId('active-filter-winter')).toBeVisible()

  await page.getByTestId('clear-all-filters').click()
  await expect(page.getByTestId('active-filter-winter')).toBeHidden()
  await expect(page).toHaveURL(`/search?q=${TERM}`)
})
