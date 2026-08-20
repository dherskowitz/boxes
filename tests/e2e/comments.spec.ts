import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import PocketBase, { ClientResponseError } from 'pocketbase'
import { authedPb, createBox, createItem, throwawayBoxes } from './helpers'

// Comments differ from everything else in the app: the ownership field is
// `user`, not `created_by`, and edit/delete rights belong to the comment's
// author, not the parent box's creator or an editor grant on it. These specs
// prove both sides of that, plus that anyone with membership can comment
// regardless of box edit rights.
//
// The seeded fixture's two comments (Sam asks, Dana replies, both on "Navy
// wool peacoat" in seedbox1) are never edited or deleted here — only viewed.
// Every comment a test mutates, it creates and removes itself.

function pocketbaseUrl(): string {
  const env = readFileSync('.env', 'utf-8')
  const match = env.match(/NUXT_PUBLIC_POCKETBASE_URL=(.+)/)
  const url = match?.[1]
  if (!url) throw new Error('NUXT_PUBLIC_POCKETBASE_URL not set in .env')
  return url.trim()
}

async function pbAs(email: string): Promise<PocketBase> {
  const pb = new PocketBase(pocketbaseUrl())
  pb.autoCancellation(false)
  await pb.collection('users').authWithPassword(email, 'storagedev123')
  return pb
}

function authedId(pb: PocketBase): string {
  const id = pb.authStore.record?.id
  if (!id) throw new Error('PocketBase client is not authenticated')
  return id
}

async function peacoatItemId(pb: PocketBase): Promise<string> {
  const item = await pb.collection('storage_items').getFirstListItem('title = "Navy wool peacoat"')
  return item.id
}

interface TestComment { id: string, text: string }

/**
 * Registers an `afterEach` that deletes every (pb, commentId) pair pushed
 * onto the returned tracker, using the same client that created it — the
 * delete rule is author-only, so a different user's client (even the box
 * creator's) cannot clean up on another author's behalf.
 *
 * In `afterEach`, not a `finally`: Playwright hard-kills a timed-out test and
 * a `finally` in the test body never runs.
 */
function throwawayComments(): { push: (pb: PocketBase, id: string) => void } {
  const entries: { pb: PocketBase, id: string }[] = []
  test.afterEach(async () => {
    while (entries.length > 0) {
      const entry = entries.pop()
      if (!entry) continue
      try {
        await entry.pb.collection('storage_comments').delete(entry.id)
      } catch (e) {
        if (!(e instanceof ClientResponseError) || e.status !== 404) throw e
      }
    }
  })
  return { push: (pb, id) => entries.push({ pb, id }) }
}

test.describe('as the comment author', () => {
  test.use({ storageState: 'tests/e2e/.auth/sam.json' })
  const cleanup = throwawayComments()

  test('can edit and delete their own comment', async ({ page }) => {
    const pb = await pbAs('sam@local.test')
    const itemId = await peacoatItemId(pb)
    const comment = await pb.collection('storage_comments').create<TestComment>({
      item: itemId,
      user: authedId(pb),
      text: 'Testing the zipper pull now too'
    })
    cleanup.push(pb, comment.id)

    await page.goto(`/item/${itemId}`)
    const row = page.getByTestId('comment').filter({ hasText: 'Testing the zipper pull now too' })
    await expect(row).toBeVisible()

    await row.getByTestId('comment-edit').click()
    await page.getByTestId('comment-edit-input').fill('Testing the zipper pull, fixed now')
    await page.getByTestId('comment-save-edit').click()
    const edited = page.getByTestId('comment').filter({ hasText: 'Testing the zipper pull, fixed now' })
    await expect(edited).toBeVisible()

    await edited.getByTestId('comment-delete').click()
    await expect(page.getByTestId('comment-delete-confirm')).toContainText('Delete this comment?')
    await page.getByTestId('comment-confirm-delete').click()
    await expect(page.getByTestId('comment').filter({ hasText: 'Testing the zipper pull' })).toHaveCount(0)
  })
})

test.describe('as another member', () => {
  test.use({ storageState: 'tests/e2e/.auth/rae.json' })
  const cleanup = throwawayComments()

  test('sees the seeded thread but has no edit or delete controls on it', async ({ page }) => {
    const pb = await authedPb()
    const itemId = await peacoatItemId(pb)

    await page.goto(`/item/${itemId}`)
    await expect(page.getByText('Is this the one with the missing button?')).toBeVisible()
    await expect(page.getByText('No, I had that one repaired last spring.')).toBeVisible()
    await expect(page.getByTestId('comment-edit')).toHaveCount(0)
    await expect(page.getByTestId('comment-delete')).toHaveCount(0)
  })

  test('can still post a comment on a box they cannot edit', async ({ page }) => {
    // Sam holds the only editor grant, on seedbox1 (the peacoat's box) — rae
    // has plain membership and no grant on it at all, yet comment create is
    // gated only on membership.
    const pb = await pbAs('rae@local.test')
    const itemId = await peacoatItemId(pb)
    const text = 'Does this need the button repair kit, or should we just replace it?'

    await page.goto(`/item/${itemId}`)
    await page.getByTestId('comment-input').fill(text)
    await page.getByTestId('comment-submit').click()
    await expect(page.getByText(text)).toBeVisible()

    const created = await pb.collection('storage_comments').getFirstListItem<TestComment>(
      pb.filter('item = {:itemId} && text = {:text}', { itemId, text })
    )
    cleanup.push(pb, created.id)
  })

  test('a duplicate submit does not post the comment twice', async ({ page }) => {
    const pb = await pbAs('rae@local.test')
    const itemId = await peacoatItemId(pb)
    const text = 'Checked again — the button is intact, must have been a different coat'

    // Widen the window a real double-click would race in, so the submit
    // button's disabled-while-pending guard actually gets exercised.
    await page.route('**/api/collections/storage_comments/records', async (route) => {
      if (route.request().method() === 'POST') await new Promise(resolve => setTimeout(resolve, 600))
      await route.continue()
    })

    await page.goto(`/item/${itemId}`)
    await page.getByTestId('comment-input').fill(text)
    const submit = page.getByTestId('comment-submit')
    const first = submit.click()
    // The button becomes disabled as soon as the mutation starts, so this
    // second click either never lands or lands on a disabled control — either
    // way it must not result in a second POST.
    const second = submit.click({ timeout: 2000 }).catch(() => undefined)
    await first
    await second
    await expect(page.getByText(text)).toBeVisible()

    const matches = await pb.collection('storage_comments').getList<TestComment>(1, 10, {
      filter: pb.filter('item = {:itemId} && text = {:text}', { itemId, text })
    })
    // Registered for cleanup before the assertion, not after: if the guard
    // ever regresses and two comments post, the assertion throws, and
    // anything registered below it would never be cleaned up — leaving the
    // extras on the seeded peacoat for every later run.
    for (const match of matches.items) cleanup.push(pb, match.id)
    expect(matches.items).toHaveLength(1)
  })

  test('cannot update or delete someone else\'s comment through the API either', async () => {
    // Hiding the button is UX, not the guard — this proves the API rule
    // itself refuses, using the seeded comment without ever mutating it.
    const pb = await pbAs('rae@local.test')
    const itemId = await peacoatItemId(pb)
    const samComment = await pb.collection('storage_comments').getFirstListItem<TestComment>(
      pb.filter('item = {:itemId} && text = {:text}', {
        itemId,
        text: 'Is this the one with the missing button?'
      })
    )

    // 404, not 403: PocketBase applies updateRule/deleteRule as a filter on the
    // record lookup, so a comment that fails `user = @request.auth.id` is
    // simply not found for that operation. That is deterministic here, so the
    // test states it — and still asserts the comment itself is untouched.
    await expect(
      pb.collection('storage_comments').update(samComment.id, { text: 'Hijacked' })
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      pb.collection('storage_comments').delete(samComment.id)
    ).rejects.toMatchObject({ status: 404 })

    const after = await pb.collection('storage_comments').getOne<TestComment>(samComment.id)
    expect(after.text).toBe('Is this the one with the missing button?')
  })
})

test.describe('as an editor of the box, on someone else\'s comment', () => {
  test.use({ storageState: 'tests/e2e/.auth/sam.json' })

  test('cannot edit or delete Dana\'s comment, even though sam can edit this box', async ({ page }) => {
    const pb = await authedPb()
    const itemId = await peacoatItemId(pb)

    await page.goto(`/item/${itemId}`)
    const danaComment = page.getByTestId('comment').filter({ hasText: 'No, I had that one repaired last spring.' })
    await expect(danaComment).toBeVisible()
    await expect(danaComment.getByTestId('comment-edit')).toHaveCount(0)
    await expect(danaComment.getByTestId('comment-delete')).toHaveCount(0)
  })
})

test.describe('empty state', () => {
  test.use({ storageState: 'tests/e2e/.auth/dana.json' })
  const throwaway = throwawayBoxes()

  test('shows the empty state for an item with no comments', async ({ page }) => {
    const pb = await authedPb()
    const box = await createBox(pb, { title: 'Garage tools' })
    throwaway.push(box.id)
    const item = await createItem(pb, { boxId: box.id, title: 'Cordless drill and bit set' })

    await page.goto(`/item/${item.id}`)
    await expect(page.getByTestId('comment-thread-empty')).toBeVisible()
  })
})
