import { expect, test } from '@playwright/test'
import { authedPb, createBox, createItem, throwawayBoxes, throwawayTags } from './helpers'

// One spec per form that had no validation at all, plus the two that only had
// a native `required`. Every case asserts the per-field message *and* that
// nothing was written — a form that silently posts nothing is the failure
// these guards exist to prevent.

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

const throwaway = throwawayBoxes()
const throwawayTagNames = throwawayTags()

test('the box form refuses an empty title', async ({ page }) => {
  await page.goto('/box/new')
  await page.getByRole('button', { name: 'Create box' }).click()
  await expect(page.getByText('Give the box a title.')).toBeVisible()
  await expect(page).toHaveURL('/box/new')
})

test('the item form refuses an empty title', async ({ page }) => {
  const pb = await authedPb()
  const box = await createBox(pb, { title: 'Camping gear, tent poles and pegs' })
  throwaway.push(box.id)

  await page.goto(`/box/${box.qr_id}`)
  await page.getByTestId('add-item').click()
  await page.getByRole('button', { name: 'Add item' }).click()
  await expect(page.getByText('Give the item a title.')).toBeVisible()

  const items = await pb.collection('storage_items').getList(1, 5, {
    filter: pb.filter('box = {:boxId}', { boxId: box.id })
  })
  expect(items.totalItems).toBe(0)
})

test('the comment form refuses whitespace-only text', async ({ page }) => {
  const pb = await authedPb()
  const box = await createBox(pb, { title: 'Nursery furniture, cot slats and screws' })
  throwaway.push(box.id)
  const item = await createItem(pb, { boxId: box.id, title: 'Cot side rail, left' })

  await page.goto(`/item/${item.id}`)
  await page.getByTestId('comment-input').fill('   ')
  await page.getByTestId('comment-submit').click()
  await expect(page.getByText('Write something before saving.')).toBeVisible()

  const comments = await pb.collection('storage_comments').getList(1, 5, {
    filter: pb.filter('item = {:itemId}', { itemId: item.id })
  })
  expect(comments.totalItems).toBe(0)
})

test('the tag rename refuses a name that normalises to empty', async ({ page }) => {
  const pb = await authedPb()
  const name = 'garage-shelving'
  throwawayTagNames.push(name)
  await pb.collection('storage_tags').create({ name, color: '', created_by: pb.authStore.record?.id })

  await page.goto('/tags')
  await page.getByTestId(`rename-tag-${name}`).click()
  await page.getByLabel('Name').fill('   ')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Tag name cannot be empty.')).toBeVisible()

  const unchanged = await pb.collection('storage_tags').getFirstListItem<{ name: string }>(
    pb.filter('name = {:name}', { name })
  )
  expect(unchanged.name).toBe(name)
})
