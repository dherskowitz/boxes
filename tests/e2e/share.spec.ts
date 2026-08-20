import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import PocketBase, { ClientResponseError } from 'pocketbase'
import { authedPb } from './helpers'

// No `describe.configure({ mode: 'serial' })`: spec files run independently
// regardless, and only this file's own tests touch storage_box_permissions.
// Every test that creates a grant removes it again in afterEach — never in a
// `finally`, because Playwright hard-kills a timed-out test — so seedbox3
// (and the fixture's single seeded grant on seedbox1) come back clean.

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

async function seedbox3Id(pb: PocketBase): Promise<string> {
  const box = await pb.collection('storage_boxes').getFirstListItem(
    pb.filter('qr_id = {:qrId}', { qrId: 'seedbox3' })
  )
  return box.id
}

async function raeUserId(pb: PocketBase): Promise<string> {
  const user = await pb.collection('storage_app_users').getFirstListItem(
    pb.filter('name = {:name}', { name: 'Rae Lindqvist' })
  )
  return user.id
}

/** seedbox3 has no seeded grants — remove anything a test left behind on it. */
async function cleanupSeedbox3Grants(): Promise<void> {
  const pb = await authedPb()
  const boxId = await seedbox3Id(pb)
  const grants = await pb.collection('storage_box_permissions').getFullList({
    filter: pb.filter('box = {:boxId}', { boxId })
  })
  for (const grant of grants) await pb.collection('storage_box_permissions').delete(grant.id)
}

test.describe('as the box creator', () => {
  test.use({ storageState: 'tests/e2e/.auth/dana.json' })

  test.afterEach(async () => {
    await cleanupSeedbox3Grants()
  })

  test('grants an editor, who can then edit the box', async ({ page, browser }) => {
    // Before the grant, rae cannot edit seedbox3.
    const before = await browser.newContext({ storageState: 'tests/e2e/.auth/rae.json' })
    const beforePage = await before.newPage()
    await beforePage.goto('/box/seedbox3')
    await expect(beforePage.getByTestId('edit-box')).toBeHidden()
    await before.close()

    await page.goto('/box/seedbox3/share')
    await expect(page.getByTestId('share-empty')).toBeVisible()

    await page.getByTestId('grantable-users').click()
    await page.getByRole('option', { name: 'Rae Lindqvist' }).click()
    await page.getByTestId('grant-editor').click()
    await expect(
      page.getByTestId('share-editor-row').filter({ hasText: 'Rae Lindqvist' })
    ).toBeVisible()

    // The criterion is the effect, not the row: a second, fully independent
    // session for rae now sees the edit control where it was hidden above.
    const after = await browser.newContext({ storageState: 'tests/e2e/.auth/rae.json' })
    const afterPage = await after.newPage()
    await afterPage.goto('/box/seedbox3')
    await expect(afterPage.getByTestId('edit-box')).toBeVisible()
    await after.close()
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
    await cleanupSeedbox3Grants()
  })

  test('cannot manage sharing', async ({ page }) => {
    await page.goto('/box/seedbox3/share')
    await expect(page.getByTestId('share-denied')).toBeVisible()
  })

  test('is refused by the API when attempting a grant directly, not just hidden by the UI', async () => {
    const pb = await authedPbAs('sam@local.test')
    const dana = await authedPb()
    const [boxId, userId] = await Promise.all([seedbox3Id(dana), raeUserId(dana)])

    await expect(
      pb.collection('storage_box_permissions').create({ box: boxId, user: userId, role: 'editor' })
    ).rejects.toBeInstanceOf(ClientResponseError)
  })
})
