import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { test } from '@playwright/test'
import PocketBase, { ClientResponseError } from 'pocketbase'

// The playwright test process does not load this worktree's .env the way the
// `nuxt dev` child process (started by webServer) does, so read it directly
// rather than hardcoding a URL (CLAUDE.md: never hardcode a PocketBase URL).
export function pocketbaseUrl(): string {
  if (process.env.NUXT_PUBLIC_POCKETBASE_URL) return process.env.NUXT_PUBLIC_POCKETBASE_URL
  const match = readFileSync('.env', 'utf-8').match(/^NUXT_PUBLIC_POCKETBASE_URL=(.+)$/m)
  if (!match) throw new Error('NUXT_PUBLIC_POCKETBASE_URL not found in .env')
  return match[1].trim()
}

/** An authenticated SDK client for an arbitrary seeded account. */
export async function authedPbAs(email: string): Promise<PocketBase> {
  const pb = new PocketBase(pocketbaseUrl())
  // The SDK auto-cancels concurrent requests to the same endpoint, which
  // silently drops all but the last of a parallel fixture build — and leaves
  // the cancelled writes to land server-side afterwards.
  pb.autoCancellation(false)
  await pb.collection('users').authWithPassword(email, 'storagedev123')
  return pb
}

/** An authenticated SDK client for the seeded owner account. */
export async function authedPb(): Promise<PocketBase> {
  return authedPbAs('dana@local.test')
}

export function authedUserId(pb: PocketBase): string {
  const id = pb.authStore.record?.id
  if (!id) throw new Error('PocketBase client is not authenticated')
  return id
}

/** 8 lowercase-alphanumeric chars, matching the app's own qr_id shape. */
function throwawayQrId(): string {
  return randomUUID().replace(/[^a-z0-9]/g, '').slice(0, 8)
}

/**
 * A box owned by the test that creates it.
 *
 * Every spec file may run concurrently with every other one, so no test may
 * mutate a seeded box, and no test may assume a seeded box's contents are
 * still what the seed left there. Anything a test writes, it creates and
 * removes itself.
 */
export interface TestBox { id: string, qr_id: string, title: string }
export interface TestItem { id: string, title: string }

export async function createBox(
  pb: PocketBase,
  fields: { title: string, location?: string, status?: 'active' | 'archived', tags?: string[] }
): Promise<TestBox> {
  return pb.collection('storage_boxes').create<TestBox>({
    qr_id: throwawayQrId(),
    title: fields.title,
    description: '',
    location: fields.location ?? '',
    status: fields.status ?? 'active',
    tags: fields.tags ?? [],
    created_by: authedUserId(pb)
  })
}

export async function createItem(
  pb: PocketBase,
  fields: { boxId: string, title: string, description?: string, notes?: string, tags?: string[] }
): Promise<TestItem> {
  return pb.collection('storage_items').create<TestItem>({
    box: fields.boxId,
    title: fields.title,
    description: fields.description ?? '',
    notes: fields.notes ?? '',
    tags: fields.tags ?? [],
    created_by: authedUserId(pb)
  })
}

/** Look up a seeded tag by name; the seed's five tags are read-only fixture. */
export async function tagIdByName(pb: PocketBase, name: string): Promise<string> {
  const tag = await pb.collection('storage_tags').getFirstListItem(
    pb.filter('name = {:name}', { name })
  )
  return tag.id
}

/**
 * Delete a box and everything in it. `storage_items.box` is required with
 * `cascadeDelete: false`, so a box holding items cannot be deleted — items go
 * first. Safe to call on a box that a test already deleted through the UI.
 */
export async function deleteBoxAndItems(pb: PocketBase, boxId: string): Promise<void> {
  // Re-query page 1 until it comes back empty rather than trusting a single
  // listing: cleanup must not leave an item behind, because the box delete
  // below then fails with a 400 that reads like a bug in the app.
  for (;;) {
    const page = await pb.collection('storage_items').getList(1, 200, {
      filter: pb.filter('box = {:boxId}', { boxId })
    })
    if (page.items.length === 0) break
    for (const item of page.items) await pb.collection('storage_items').delete(item.id)
  }
  try {
    await pb.collection('storage_boxes').delete(boxId)
  } catch (e) {
    // A test that deletes the box through the UI leaves nothing to clean up.
    if (!(e instanceof ClientResponseError) || e.status !== 404) throw e
  }
}

/**
 * Registers an `afterEach` that removes every box id pushed onto the returned
 * array, plus everything in it.
 *
 * Teardown lives here rather than in a `finally` inside the test body because
 * Playwright hard-kills a test that hits its timeout — the `finally` never
 * runs, and the fixture is left dirty for every later run. Hooks get their own
 * timeout budget.
 */
export function throwawayBoxes(): string[] {
  const ids: string[] = []
  test.afterEach(async () => {
    if (ids.length === 0) return
    const pb = await authedPb()
    while (ids.length > 0) {
      const id = ids.pop()
      if (id) await deleteBoxAndItems(pb, id)
    }
  })
  return ids
}

/**
 * Registers an `afterEach` that removes every box whose *title* was pushed
 * onto the returned array, plus everything in it.
 *
 * Titles, not ids, for the same reason as `throwawayTags`: a box created
 * through the UI has no id on the test side until the redirect assertion
 * resolves, and if that assertion times out Playwright hard-kills the test
 * before the id can be registered — the box then leaks permanently and breaks
 * the five-box fixture invariant for every later run. Pushing the title
 * *before* the box exists closes that window, and also clears a stray left
 * behind by an earlier killed run.
 */
export function throwawayBoxTitles(): string[] {
  const titles: string[] = []
  test.afterEach(async () => {
    if (titles.length === 0) return
    const pb = await authedPb()
    while (titles.length > 0) {
      const title = titles.pop()
      if (!title) continue
      const boxes = await pb.collection('storage_boxes').getFullList<{ id: string }>({
        filter: pb.filter('title = {:title}', { title })
      })
      for (const box of boxes) await deleteBoxAndItems(pb, box.id)
    }
  })
  return titles
}

/**
 * Registers an `afterEach` that deletes every tag *name* pushed onto the
 * returned array.
 *
 * Names, not ids: a tag created inline through the picker has no id on the
 * test side, and looking it up by name at teardown time also clears a stray
 * left behind by an earlier run that was killed mid-test. The seeded
 * vocabulary is exactly five tags and `/tags` plus the reports counts assert
 * against it, so an inline-created tag that survives breaks every later run.
 *
 * Same reason as `throwawayBoxes` for using a hook rather than a `finally`:
 * Playwright hard-kills a timed-out test and a `finally` never runs.
 */
export function throwawayTags(): string[] {
  const names: string[] = []
  test.afterEach(async () => {
    if (names.length === 0) return
    const pb = await authedPb()
    while (names.length > 0) {
      const name = names.pop()
      if (!name) continue
      try {
        const tag = await pb.collection('storage_tags').getFirstListItem(
          pb.filter('name = {:name}', { name })
        )
        await pb.collection('storage_tags').delete(tag.id)
      } catch (e) {
        // Nothing to clean up if the tag was never created (404 on lookup).
        if (!(e instanceof ClientResponseError) || e.status !== 404) throw e
      }
    }
  })
  return names
}
