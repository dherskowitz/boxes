import { readFileSync } from 'node:fs'
import PocketBase from 'pocketbase'
import { expect, test } from '@playwright/test'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })
// One of these tests archives every active box and restores it afterward —
// run the file serially so that mutation can't race the read-only tests.
test.describe.configure({ mode: 'serial' })

function pocketbaseUrl(): string {
  const env = readFileSync('.env', 'utf-8')
  const match = env.match(/NUXT_PUBLIC_POCKETBASE_URL=(.+)/)
  const url = match?.[1]
  if (!url) throw new Error('NUXT_PUBLIC_POCKETBASE_URL not set in .env')
  return url.trim()
}

async function authedPb(): Promise<PocketBase> {
  const pb = new PocketBase(pocketbaseUrl())
  await pb.collection('users').authWithPassword('dana@local.test', 'storagedev123')
  return pb
}

test('lists active boxes and hides archived ones by default', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Winter coats and boots')).toBeVisible()
  await expect(page.getByText('Empty spare box')).toBeVisible()
  // seedbox5 is archived
  await expect(page.getByText('College photo albums')).toBeHidden()
})

test('can reveal archived boxes', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('show-archived').click()
  await expect(page.getByText('College photo albums')).toBeVisible()
})

test('opens a box from its card', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Winter coats and boots').click()
  await expect(page).toHaveURL('/box/seedbox1')
})

test('shows the empty state when every active box is archived', async ({ page }) => {
  const pb = await authedPb()
  const active = await pb.collection('storage_boxes').getFullList({ filter: 'status = "active"' })
  try {
    for (const box of active) {
      await pb.collection('storage_boxes').update(box.id, { status: 'archived' })
    }
    await page.goto('/')
    await expect(page.getByTestId('box-list-empty')).toBeVisible()
  } finally {
    for (const box of active) {
      await pb.collection('storage_boxes').update(box.id, { status: 'active' })
    }
  }
})

test('creates a box with only a title and lands on its page', async ({ page }) => {
  await page.goto('/box/new')
  await page.getByLabel('Title').fill('Loft bedding and spare pillows')
  await page.getByRole('button', { name: 'Create box' }).click()
  await expect(page).toHaveURL(/\/box\/[a-z0-9]{8}$/)
  await expect(page.getByText('Loft bedding and spare pillows')).toBeVisible()

  const qrId = new URL(page.url()).pathname.split('/').pop()
  const pb = await authedPb()
  const created = await pb.collection('storage_boxes').getFirstListItem(pb.filter('qr_id = {:qrId}', { qrId }))
  await pb.collection('storage_boxes').delete(created.id)
})

test('disables the submit button while the create request is pending', async ({ page }) => {
  await page.goto('/box/new')
  await page.getByLabel('Title').fill('Loft bedding, take two')
  const button = page.getByRole('button', { name: 'Create box' })
  await button.click()
  // The pending state disables the button synchronously, before the request
  // resolves — this, not a race on a second click, is what actually prevents
  // a duplicate box on a fast double-tap.
  await expect(button).toBeDisabled()
  await expect(page).toHaveURL(/\/box\/[a-z0-9]{8}$/)

  const qrId = new URL(page.url()).pathname.split('/').pop()
  const pb = await authedPb()
  const created = await pb.collection('storage_boxes').getFirstListItem(pb.filter('qr_id = {:qrId}', { qrId }))
  await pb.collection('storage_boxes').delete(created.id)
})
