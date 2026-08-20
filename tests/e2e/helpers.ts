import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { test } from '@playwright/test'
import PocketBase, { ClientResponseError } from 'pocketbase'

function pocketbaseUrl(): string {
  const env = readFileSync('.env', 'utf-8')
  const match = env.match(/NUXT_PUBLIC_POCKETBASE_URL=(.+)/)
  const url = match?.[1]
  if (!url) throw new Error('NUXT_PUBLIC_POCKETBASE_URL not set in .env')
  return url.trim()
}

/** An authenticated SDK client for the seeded owner account. */
export async function authedPb(): Promise<PocketBase> {
  const pb = new PocketBase(pocketbaseUrl())
  // The SDK auto-cancels concurrent requests to the same endpoint, which
  // silently drops all but the last of a parallel fixture build — and leaves
  // the cancelled writes to land server-side afterwards.
  pb.autoCancellation(false)
  await pb.collection('users').authWithPassword('dana@local.test', 'storagedev123')
  return pb
}

function authedUserId(pb: PocketBase): string {
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
  fields: { title: string, location?: string, status?: 'active' | 'archived' }
): Promise<TestBox> {
  return pb.collection('storage_boxes').create<TestBox>({
    qr_id: throwawayQrId(),
    title: fields.title,
    description: '',
    location: fields.location ?? '',
    status: fields.status ?? 'active',
    created_by: authedUserId(pb)
  })
}

export async function createItem(
  pb: PocketBase,
  fields: { boxId: string, title: string, description?: string, notes?: string }
): Promise<TestItem> {
  return pb.collection('storage_items').create<TestItem>({
    box: fields.boxId,
    title: fields.title,
    description: fields.description ?? '',
    notes: fields.notes ?? '',
    created_by: authedUserId(pb)
  })
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
