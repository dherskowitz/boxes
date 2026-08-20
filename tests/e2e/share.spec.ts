import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import PocketBase, { ClientResponseError } from 'pocketbase'
import { authedPb, createBox, createItem, deleteBoxAndItems } from './helpers'
import type { TestBox } from './helpers'

// No `describe.configure({ mode: 'serial' })`: spec files run independently
// regardless, and only this file's own tests touch storage_box_permissions.
// Every test that creates a grant removes it again in afterEach — never in a
// `finally`, because Playwright hard-kills a timed-out test — so the fixture's
// single seeded grant on seedbox1 is all that survives a run.

function pocketbaseUrl(): string {
  const env = readFileSync('.env', 'utf-8')
  const match = env.match(/NUXT_PUBLIC_POCKETBASE_URL=(.+)/)
  const url = match?.[1]
  if (!url) throw new Error('NUXT_PUBLIC_POCKETBASE_URL not set in .env')
  return url.trim()
}

/** An authenticated SDK client for an arbitrary seeded account, not just dana. */
async function authedPbAs(email: string): Promise<PocketBase> {
  const pb = new PocketBase(pocketbaseUrl())
  pb.autoCancellation(false)
  await pb.collection('users').authWithPassword(email, 'storagedev123')
  return pb
}

async function boxIdFor(pb: PocketBase, qrId: string): Promise<string> {
  const box = await pb.collection('storage_boxes').getFirstListItem(
    pb.filter('qr_id = {:qrId}', { qrId })
  )
  return box.id
}

async function raeUserId(pb: PocketBase): Promise<string> {
  const user = await pb.collection('storage_app_users').getFirstListItem(
    pb.filter('name = {:name}', { name: 'Rae Lindqvist' })
  )
  return user.id
}

/**
 * The fixture holds exactly one grant — sam on seedbox1 — and other specs read
 * it. Anything else on any box is this file's litter, so remove it by
 * exclusion rather than by box: a throwaway box cannot be deleted while a
 * grant still points at it (the relation is required with
 * `cascadeDelete: false`), and this way one hook can do both in order.
 */
async function deleteStrayGrants(pb: PocketBase): Promise<void> {
  const seeded = await boxIdFor(pb, 'seedbox1')
  const grants = await pb.collection('storage_box_permissions').getFullList({
    filter: pb.filter('box != {:boxId}', { boxId: seeded })
  })
  for (const grant of grants) await pb.collection('storage_box_permissions').delete(grant.id)
}

test.describe('as the box creator', () => {
  test.use({ storageState: 'tests/e2e/.auth/dana.json' })

  const throwaway: string[] = []
  test.afterEach(async () => {
    const pb = await authedPb()
    // Grants first: one still pointing at a throwaway box blocks its delete.
    await deleteStrayGrants(pb)
    while (throwaway.length > 0) {
      const id = throwaway.pop()
      if (id) await deleteBoxAndItems(pb, id)
    }
  })

  test('grants an editor, whose writes to the box and its items are then accepted', async ({ page, browser }) => {
    // A throwaway box, not a seeded one: this test writes to the box it
    // shares, and no test may mutate the fixture.
    const dana = await authedPb()
    const box = await createBox(dana, {
      title: 'Nursery clothes, 0-6 months',
      location: 'Loft, north wall'
    })
    throwaway.push(box.id)

    // Before the grant, rae can see the box but is offered no edit control.
    // `toBeHidden()` also passes on a page that never rendered, so assert the
    // box is actually on screen first.
    const before = await browser.newContext({ storageState: 'tests/e2e/.auth/rae.json' })
    const beforePage = await before.newPage()
    await beforePage.goto(`/box/${box.qr_id}`)
    await expect(beforePage.getByText(box.title)).toBeVisible()
    await expect(beforePage.getByTestId('edit-box')).toBeHidden()
    await before.close()

    await page.goto(`/box/${box.qr_id}/share`)
    await expect(page.getByTestId('share-empty')).toBeVisible()

    await page.getByTestId('grantable-users').click()
    await page.getByRole('option', { name: 'Rae Lindqvist' }).click()
    await page.getByTestId('grant-editor').click()
    await expect(
      page.getByTestId('share-editor-row').filter({ hasText: 'Rae Lindqvist' })
    ).toBeVisible()

    // A second, independent session for rae now sees the edit control where it
    // was hidden above.
    const after = await browser.newContext({ storageState: 'tests/e2e/.auth/rae.json' })
    const afterPage = await after.newPage()
    await afterPage.goto(`/box/${box.qr_id}`)
    await expect(afterPage.getByTestId('edit-box')).toBeVisible()
    await after.close()

    // But that control is rendered by `canEditBox()`, a client-side predicate
    // that is UX only. The criterion is the API accepting rae's writes to the
    // box and to its items, which nothing else in the suite covers: strip the
    // `storage_box_permissions_via_user` clause out of either rule and every
    // other test still passes.
    const raePb = await authedPbAs('rae@local.test')
    const updated = await raePb.collection('storage_boxes').update<TestBox>(box.id, {
      title: 'Nursery clothes, 0-12 months'
    })
    expect(updated.title).toBe('Nursery clothes, 0-12 months')
    const item = await createItem(raePb, {
      boxId: box.id,
      title: 'Fleece sleepsuits, twelve of them'
    })
    expect(item.id).not.toBe('')
  })

  test('revokes an editor', async ({ page, browser }) => {
    await page.goto('/box/seedbox3/share')
    await page.getByTestId('grantable-users').click()
    await page.getByRole('option', { name: 'Rae Lindqvist' }).click()
    await page.getByTestId('grant-editor').click()
    await expect(
      page.getByTestId('share-editor-row').filter({ hasText: 'Rae Lindqvist' })
    ).toBeVisible()

    await page.getByTestId('revoke-editor').click()
    await expect(page.getByTestId('share-empty')).toBeVisible()

    const raeContext = await browser.newContext({ storageState: 'tests/e2e/.auth/rae.json' })
    const raePage = await raeContext.newPage()
    await raePage.goto('/box/seedbox3')
    // Positive assertion first: `toBeHidden()` passes on a page that failed to
    // render at all, which would prove nothing about the revoke.
    await expect(raePage.getByText('Tax records 2019-2023')).toBeVisible()
    await expect(raePage.getByTestId('edit-box')).toBeHidden()
    await raeContext.close()
  })

  test('shows a box-not-found state for an unknown code', async ({ page }) => {
    await page.goto('/box/nosuchbox/share')
    await expect(page.getByTestId('share-box-not-found')).toBeVisible()
  })
})

test.describe('as a non-creator', () => {
  test.use({ storageState: 'tests/e2e/.auth/sam.json' })

  test.afterEach(async () => {
    await deleteStrayGrants(await authedPb())
  })

  test('cannot manage sharing', async ({ page }) => {
    await page.goto('/box/seedbox3/share')
    await expect(page.getByTestId('share-denied')).toBeVisible()
  })

  test('is refused by the API when attempting a grant directly, not just hidden by the UI', async () => {
    const pb = await authedPbAs('sam@local.test')
    const dana = await authedPb()
    const [boxId, userId] = await Promise.all([boxIdFor(dana, 'seedbox3'), raeUserId(dana)])

    const attempt = pb.collection('storage_box_permissions')
      .create({ box: boxId, user: userId, role: 'editor' })
    await expect(attempt).rejects.toBeInstanceOf(ClientResponseError)
    // 400, not 403: a create refused by an API rule comes back as a failed
    // validation. (An update or delete refused by a rule comes back 404
    // instead — the rule is applied as a record-lookup filter.) Asserting the
    // status is what separates a rule rejection from a malformed payload.
    await expect(attempt).rejects.toMatchObject({ status: 400 })
  })
})
