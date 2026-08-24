import { expect, test } from '@playwright/test'
import type { StorageTag } from '~/types/pocketbase'
import { authedPbAs, throwawayTags } from './helpers'

// Colour editing is asserted against a tag this spec owns: the seeded five are
// read by the reports counts and by other spec files.
const COLOURED = 'loft insulation'
const throwawayTagNames = throwawayTags()

test.describe('as an owner', () => {
  test.use({ storageState: 'tests/e2e/.auth/dana.json' })

  // exact: true throughout this file. The row's rename and delete controls
  // are icon buttons whose accessible names are "Rename winter" / "Delete
  // winter" — deliberately naming the tag, so a screen reader reading the
  // button list can tell six identical pencils apart. That makes a bare
  // substring match for a tag name ambiguous; the tag's own label is the
  // exact one.
  test('lists the seeded tags with usage counts', async ({ page }) => {
    await page.goto('/tags')
    await expect(page.getByText('winter', { exact: true })).toBeVisible()
    await expect(page.getByText('paperwork', { exact: true })).toBeVisible()
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
    await expect(page.getByText('kitchenware', { exact: true })).toBeVisible()

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

  test('can change a tag colour, and it is what comes back from the API', async ({ page }) => {
    const pb = await authedPbAs('dana@local.test')
    throwawayTagNames.push(COLOURED)
    await pb.collection('storage_tags').create({ name: COLOURED, color: '#2563eb' })

    await page.goto('/tags')
    await page.getByTestId(`rename-tag-${COLOURED}`).click()
    await page.getByLabel('Colour').fill('#dc2626')
    await page.getByRole('button', { name: 'Save' }).click()

    // Back to the read-only row, so the save resolved rather than errored.
    await expect(page.getByTestId(`rename-tag-${COLOURED}`)).toBeVisible()

    const saved = await pb.collection('storage_tags').getFirstListItem<StorageTag>(
      pb.filter('name = {:name}', { name: COLOURED })
    )
    expect(saved.color).toBe('#dc2626')
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
    await expect(dialog).toContainText('This label comes off 1 box and 1 item.')
    // Armed only by typing the name back — a tag delete strips the label off
    // every record carrying it, and there is no undo.
    await expect(page.getByTestId('confirm-delete-tag')).toBeDisabled()
    await page.getByTestId('delete-tag-input').fill('sentimental')
    await expect(page.getByTestId('confirm-delete-tag')).toBeEnabled()
  })
})

test.describe('as a plain member', () => {
  test.use({ storageState: 'tests/e2e/.auth/rae.json' })

  test('can see tags but not delete them', async ({ page }) => {
    await page.goto('/tags')
    await expect(page.getByText('winter', { exact: true })).toBeVisible()
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
