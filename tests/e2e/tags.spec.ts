import { expect, test } from '@playwright/test'
import type { StorageTag } from '~/types/pocketbase'
import { authedPbAs } from './helpers'

test.describe('as an owner', () => {
  test.use({ storageState: 'tests/e2e/.auth/dana.json' })

  test('lists the seeded tags with usage counts', async ({ page }) => {
    await page.goto('/tags')
    await expect(page.getByText('winter')).toBeVisible()
    await expect(page.getByText('paperwork')).toBeVisible()
  })

  // The shared fixture ('kitchen') is renamed to 'kitchenware' partway
  // through the test below and renamed back at the end. If any assertion in
  // between throws, the test aborts before the restore runs and the fixture
  // is left renamed for every later run, every other slice, and CI. This
  // hook unconditionally renames it back — via the same API the mutation
  // uses, not the UI, so it does not depend on the page under test still
  // being usable — whenever the tag is currently 'kitchenware', regardless
  // of whether the test passed.
  test.afterEach(async () => {
    const pb = await authedPbAs('dana@local.test')
    let stray
    try {
      stray = await pb.collection('storage_tags').getFirstListItem(
        pb.filter('name = {:name}', { name: 'kitchenware' })
      )
    } catch {
      return // no stray 'kitchenware' tag - fixture is clean
    }
    await pb.collection('storage_tags').update(stray.id, { name: 'kitchen' })
  })

  test('can rename a tag, and the relation carries the new name (not a copy)', async ({ page }) => {
    await page.goto('/tags')
    await page.getByTestId('rename-tag-kitchen').click()
    await page.getByLabel('Name').fill('kitchenware')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('kitchenware')).toBeVisible()

    // PRD §7.7: renaming updates the label everywhere it is applied. Slice
    // A's box detail page (`/box/:qr_id`) is not built in this worktree —
    // A and B land in separate worktrees and merge later — so this asserts
    // the effect at the data layer instead: tags are a relation, not a
    // copied string, so seedbox2 (which carries the kitchen tag) comes back
    // with the new name on its expanded tag, with no migration of the box
    // record itself.
    const pb = await authedPbAs('dana@local.test')
    const box = await pb.collection('storage_boxes').getFirstListItem<
      { expand?: { tags?: StorageTag[] } }
    >(pb.filter('qr_id = {:q}', { q: 'seedbox2' }), { expand: 'tags' })
    const tagNames = (box.expand?.tags ?? []).map(t => t.name)
    expect(tagNames).toContain('kitchenware')

    // restore, so the shared fixture is unchanged for other tests. The
    // afterEach hook above is the safety net if this itself does not run;
    // this is still the fast path when nothing fails.
    await page.goto('/tags')
    await page.getByTestId('rename-tag-kitchenware').click()
    await page.getByLabel('Name').fill('kitchen')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('kitchen', { exact: true })).toBeVisible()
  })

  test('sees the delete control', async ({ page }) => {
    await page.goto('/tags')
    await expect(page.getByTestId('delete-tag-sentimental')).toBeVisible()
  })

  test('deleting names the usage count and confirms before removing the tag', async ({ page }) => {
    await page.goto('/tags')
    await page.getByTestId('delete-tag-sentimental').click()
    // Scoped to the dialog: the tag name also shows in the list row behind it,
    // and it is the confirmation copy specifically that must name the tag and
    // what deleting it costs. seedbox5 (archived) and its one item both carry
    // 'sentimental'.
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('sentimental')
    await expect(dialog).toContainText('1 boxes and 1 items')
  })
})

test.describe('as a plain member', () => {
  test.use({ storageState: 'tests/e2e/.auth/rae.json' })

  test('can see tags but not delete them', async ({ page }) => {
    await page.goto('/tags')
    await expect(page.getByText('winter')).toBeVisible()
    await expect(page.getByTestId('delete-tag-sentimental')).toBeHidden()
  })

  test('a direct delete attempt is refused by the API, not just hidden in the UI', async () => {
    // Hiding the button is UX, not access control (CLAUDE.md). Prove the
    // server-side rule independently of the UI: call the API directly as a
    // plain member and assert PocketBase itself refuses the delete.
    const pb = await authedPbAs('rae@local.test')
    const sentimental = await pb.collection('storage_tags').getFirstListItem(
      pb.filter('name = {:name}', { name: 'sentimental' })
    )
    await expect(pb.collection('storage_tags').delete(sentimental.id)).rejects.toThrow()
  })
})
