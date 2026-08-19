# Slice B — Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the shared curated tag vocabulary — a reusable picker component with autocomplete and inline creation, and a management screen to rename, delete, and see usage.

**Architecture:** Tags are a single flat namespace applied to both boxes and items via relations, so renaming one updates it everywhere with no data migration. This slice builds the picker as a **standalone component** and does **not** wire it into the box or item forms — those files belong to slice A, and two agents editing them concurrently is the conflict this wave is structured to avoid. Wave 3 does the wiring.

**Tech Stack:** Nuxt 4 SPA, Nuxt UI 4, PocketBase 0.39.11, `@peterbud/nuxt-query` / TanStack Query, Vitest, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-19-storage-app-v1-design.md`
**Contract:** `docs/superpowers/wave-0-interface-surface.md` — read first.
**Coordination:** `docs/superpowers/plans/2026-08-19-wave-1-overview.md`

## Global Constraints

- Package manager is **pnpm**. Never npm or yarn.
- **Done means** `pnpm lint && pnpm test && pnpm test:e2e` green in your worktree. TDD: failing test first. Never `.skip`/`.only`, never weaken a test to reach green. E2E is flaky under machine load — re-run before concluding red.
- **No `any`**, no `as` to silence an error, no non-null `!`, no `@ts-expect-error` without a stated reason.
- Nuxt auto-imports are on. No imports for composables, components, `app/utils/`, or `app/queries/`. `import type` IS required.
- **All reads and writes go through nuxt-query.** Never call `pb.collection().…` from a component.
- **Barebones styling.** Nuxt UI defaults, layout primitives only. No colour classes, no custom CSS. **Note:** tags carry a `color` hex value in the data. Rendering a chip in its stored colour is *data*, not styling — an inline `:style` bound to `tag.color` is correct and permitted. Do not add Tailwind colour utilities.
- Surface every failure through `pbError(e)`. Never swallow a failed mutation.
- **Never interpolate into a filter string.** Use `$pb.filter(raw, params)`.
- **Create sets `created_by`; update omits it entirely** — the update rule uses `:isset = false` and rejects the payload if the field is present at all.
- Commits: no attribution footers, no emoji trailers.
- **You own** `app/pages/tags.vue`, `app/components/TagPicker.vue`, `app/components/Tag*`, and mutations appended to `app/queries/tags.ts`. Nothing else. If you believe you need another file, stop and report.

## The rule that makes this slice unusual

**Deleting a tag requires an `app_memberships.role` of `owner` or `admin`.** Creating and renaming are open to every enabled member. This is already enforced in the migration's delete rule — you are not adding it, you are reflecting it in the UI so a member without the role does not see a button that always 403s.

`useAuth().role` gives the current user's role. The seeded fixture makes both paths testable: `dana@local.test` is `owner`, `rae@local.test` is `member`.

Deleting a tag strips it from every box and item that had it applied. PRD §7.7 requires a simple confirmation naming the usage count — "this tag is used on N items, delete anyway?" — and nothing more elaborate.

---

### Task 1: Tag mutations

**Files:**
- Modify: `app/queries/tags.ts` (append; leave `useTags` untouched)
- Test: `tests/unit/tagMutations.spec.ts`

**Interfaces:**
- Consumes: `keys`, `StorageTag`, `useAuth`.
- Produces: `useCreateTag()`, `useRenameTag()`, `useDeleteTag()`, and the pure helper `normalizeTagName()`.

- [ ] **Step 1: Write the failing test**

`normalizeTagName` exists because a curated shared vocabulary degrades fast if `Winter`, `winter ` and `winter` become three tags. `name` is unique-constrained, so normalising before create also avoids an avoidable 400.

```ts
import { describe, expect, it } from 'vitest'
import { normalizeTagName } from '~/queries/tags'

describe('normalizeTagName', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeTagName('  winter  ')).toBe('winter')
  })

  it('lowercases, so Winter and winter cannot both exist', () => {
    expect(normalizeTagName('Winter')).toBe('winter')
  })

  it('collapses internal whitespace', () => {
    expect(normalizeTagName('tax   records')).toBe('tax records')
  })

  it('leaves an already-clean name alone', () => {
    expect(normalizeTagName('paperwork')).toBe('paperwork')
  })

  it('returns empty for whitespace only, which the caller must reject', () => {
    expect(normalizeTagName('   ')).toBe('')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test tests/unit/tagMutations.spec.ts`
Expected: FAIL — `normalizeTagName` is not exported.

- [ ] **Step 3: Implement, appended to `app/queries/tags.ts`**

```ts
import type { StorageTag } from '~/types/pocketbase'

/**
 * Canonical form for a tag name.
 *
 * `storage_tags.name` is unique-constrained, and this is a *curated shared*
 * vocabulary — without normalisation "Winter", "winter " and "winter" become
 * three tags and the list stops being useful. Returns '' for whitespace-only
 * input; callers must reject that rather than creating an unnamed tag.
 */
export function normalizeTagName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function useCreateTag() {
  const { $pb } = useNuxtApp()
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ name, color }: { name: string, color?: string }) =>
      // The create rule requires created_by to equal the authed user id.
      $pb.collection('storage_tags').create<StorageTag>({
        name: normalizeTagName(name),
        color: color ?? '',
        created_by: userId.value
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.tags.all })
  })
}

export function useRenameTag() {
  const { $pb } = useNuxtApp()
  const queryClient = useQueryClient()

  return useMutation({
    // Only `name` is sent. Including created_by would trip the update rule's
    // `:isset = false` check and 403 even when set to the correct value.
    mutationFn: ({ id, name }: { id: string, name: string }) =>
      $pb.collection('storage_tags').update<StorageTag>(id, { name: normalizeTagName(name) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.tags.all })
      // A tag is a relation on boxes and items, and both expand it — their
      // cached copies still carry the old label until refetched.
      queryClient.invalidateQueries({ queryKey: keys.boxes.all })
      queryClient.invalidateQueries({ queryKey: keys.items.all })
    }
  })
}

/** Requires an owner/admin membership role — the API delete rule enforces it. */
export function useDeleteTag() {
  const { $pb } = useNuxtApp()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => $pb.collection('storage_tags').delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.tags.all })
      queryClient.invalidateQueries({ queryKey: keys.boxes.all })
      queryClient.invalidateQueries({ queryKey: keys.items.all })
    }
  })
}
```

The cross-invalidation on rename and delete is the subtle part: a tag is a relation that boxes and items `expand`, so their cached records hold a stale label until refetched. PRD §7.7 promises a rename updates the display everywhere.

- [ ] **Step 4: Run the test**

Run: `pnpm test tests/unit/tagMutations.spec.ts`
Expected: PASS, 5 tests. `pnpm lint` clean.

- [ ] **Step 5: Commit**

```bash
git add app/queries/tags.ts tests/unit/tagMutations.spec.ts
git commit -m "Add tag create, rename and delete mutations"
```

---

### Task 2: Tag usage counts

**Files:**
- Modify: `app/queries/tags.ts` (append)
- Test: `tests/unit/tagUsage.spec.ts`

**Interfaces:**
- Produces: `useTagUsage(): ComputedRef<Map<string, { boxCount: number, itemCount: number }>>` and the pure `indexTagUsage()`.

The `/tags` screen shows how many boxes and items carry each tag, and the delete confirmation needs the same number. Wave 0 already built a view collection for exactly this: **`storage_report_tag_usage`**, which returns one row per tag with `box_count` and `item_count` computed in SQL.

Use it. Do **not** fetch every box and item and count client-side — that is the anti-pattern the view exists to prevent, and it would not scale past a few hundred records.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { indexTagUsage } from '~/queries/tags'
import type { ReportTagUsage } from '~/types/pocketbase'

const rows: ReportTagUsage[] = [
  { id: 't_winter', name: 'winter', color: '#2563eb', box_count: 1, item_count: 2 },
  { id: 't_fragile', name: 'fragile', color: '#dc2626', box_count: 2, item_count: 1 }
]

describe('indexTagUsage', () => {
  it('indexes counts by tag id', () => {
    const map = indexTagUsage(rows)
    expect(map.get('t_winter')).toEqual({ boxCount: 1, itemCount: 2 })
  })

  it('reports zero for a tag with no usage row rather than undefined', () => {
    expect(indexTagUsage(rows).get('t_unused') ?? { boxCount: 0, itemCount: 0 })
      .toEqual({ boxCount: 0, itemCount: 0 })
  })

  it('handles an empty report', () => {
    expect(indexTagUsage([]).size).toBe(0)
  })

  it('handles the report still loading', () => {
    expect(indexTagUsage(undefined).size).toBe(0)
  })
})
```

- [ ] **Step 2: Run and watch it fail**

- [ ] **Step 3: Implement**

`useTagUsage` wraps `useQuery` over `storage_report_tag_usage` with `getFullList<ReportTagUsage>()` — bounded by the number of tags, so unpaginated is correct here for the same reason `useTags` is. Key it with `keys.reports.tagUsage()`.

Note slice J also reads this view. That is fine — two readers of the same view collection with the same query key share a cache entry rather than conflicting. You own the read here because `/tags` needs it in wave 1; J owns the whole of `reports.ts`, so put this one in `tags.ts`, not there.

- [ ] **Step 4: Run the test** — PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add app/queries/tags.ts tests/unit/tagUsage.spec.ts
git commit -m "Add tag usage counts from the report view"
```

---

### Task 3: TagPicker component

**Files:**
- Create: `app/components/TagPicker.vue`

**Interfaces:**
- Produces: `<TagPicker v-model="tagIds" />` where the model is `string[]` of tag ids.

This is the component wave 3 will mount inside slice A's box and item forms. Build it to be dropped in with no further work: `v-model`, no page-specific assumptions, no router use.

Required behaviour (PRD §7.7):
- Autocomplete against the existing tag list from `useTags()`.
- Multiple selection; a box or item may carry zero or more.
- **Inline creation** when no match exists — typing a new name offers "Create «name»", which calls `useCreateTag` and adds the result to the selection.
- Selected tags render as removable chips, each in its stored `color` via an inline `:style` (data, not styling).
- Normalise the typed name before offering to create it, and if the normalised name already matches an existing tag, **select that tag instead of creating a duplicate** — the unique constraint would reject it anyway, and a confusing 400 is worse than doing the obvious thing.
- Disable the create affordance while the mutation is pending, so a double-tap cannot create two tags.

`UInputMenu` or `USelectMenu` from Nuxt UI covers most of this with `creatable`-style behaviour; check which fits and use it rather than hand-rolling a combobox.

- [ ] **Step 1: Write the failing component test**

A component test is the right level here — the picker's logic is interactive and does not belong to any page yet. Mount it with `mountSuspended`, stub the tag query, and assert: existing tags are offered, selecting adds to the model, an unmatched name offers creation, and a name matching an existing tag after normalisation selects rather than creates.

`tests/unit/tagPicker.spec.ts`.

- [ ] **Step 2: Run and watch it fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run and watch it pass**

- [ ] **Step 5: Commit**

```bash
git add app/components/TagPicker.vue tests/unit/tagPicker.spec.ts
git commit -m "Add TagPicker with autocomplete and inline creation"
```

---

### Task 4: Tags management page

**Files:**
- Create: `app/pages/tags.vue`

The nav link already exists in the layout and currently resolves to nothing — this task fills it.

Required behaviour:
- List every tag with its colour chip and its box/item usage counts.
- **Rename inline**, available to any enabled member.
- **Delete**, visible only when `useAuth().role` is `owner` or `admin`, with a confirmation naming the usage count.
- **Loading state** (`data-testid="tags-loading"`) and **empty state** (`data-testid="tags-empty"`) — a fresh instance has no tags at all, and an empty list must not read as broken.
- Every failure surfaced via `pbError`.

Do not build a create-tag form here. Tags are created inline from the picker, in context, where the user actually needs one. A second creation path is scope the PRD does not ask for.

- [ ] **Step 1: Write the failing e2e tests**

Both role paths, which is the point of the screen:

```ts
import { expect, test } from '@playwright/test'

test.describe('as an owner', () => {
  test.use({ storageState: 'tests/e2e/.auth/dana.json' })

  test('lists the seeded tags with usage counts', async ({ page }) => {
    await page.goto('/tags')
    await expect(page.getByText('winter')).toBeVisible()
    await expect(page.getByText('paperwork')).toBeVisible()
  })

  test('can rename a tag, and the new name shows on the box that carries it', async ({ page }) => {
    await page.goto('/tags')
    await page.getByTestId('rename-tag-kitchen').click()
    await page.getByLabel('Name').fill('kitchenware')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('kitchenware')).toBeVisible()

    // PRD §7.7: renaming updates the label everywhere it is applied.
    await page.goto('/box/seedbox2')
    await expect(page.getByText('kitchenware')).toBeVisible()

    // restore, so the shared fixture is unchanged for other tests
    await page.goto('/tags')
    await page.getByTestId('rename-tag-kitchenware').click()
    await page.getByLabel('Name').fill('kitchen')
    await page.getByRole('button', { name: 'Save' }).click()
  })

  test('sees the delete control', async ({ page }) => {
    await page.goto('/tags')
    await expect(page.getByTestId('delete-tag-sentimental')).toBeVisible()
  })
})

test.describe('as a plain member', () => {
  test.use({ storageState: 'tests/e2e/.auth/rae.json' })

  test('can see tags but not delete them', async ({ page }) => {
    await page.goto('/tags')
    await expect(page.getByText('winter')).toBeVisible()
    await expect(page.getByTestId('delete-tag-sentimental')).toBeHidden()
  })
})
```

The rename test asserts the cross-entity effect, which is the whole reason tags are a relation rather than a copied string. It restores the fixture afterwards.

- [ ] **Step 2: Run and watch them fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run and watch them pass**

- [ ] **Step 5: Prove the delete rule server-side, not just in the UI**

Hiding the button is UX, not access control. Add one test that a plain member's delete attempt is refused by the API — call it directly with `rae`'s session and assert the failure. A UI-only assertion would still pass if the rule were removed.

- [ ] **Step 6: Commit**

```bash
git add app/pages/tags.vue tests/e2e/tags.spec.ts
git commit -m "Add tag management page"
```

---

### Task 5: Slice exit check

**Files:** none.

- [ ] **Step 1: Full loop from a cold start**

```bash
docker compose down -v && docker compose up -d
sleep 5
python3 scripts/pb-seed.py http://localhost:8090
pnpm lint && pnpm test && pnpm test:e2e
```

- [ ] **Step 2: Confirm the fixture is unchanged**

Your rename test mutates shared seed data and restores it. Verify the restore actually happened — re-run the suite twice and confirm it passes both times. A test that only passes on a fresh seed will break every other slice.

- [ ] **Step 3: Confirm you stayed inside your ownership**

```bash
git diff --name-only main...HEAD
```

Only `app/pages/tags.vue`, `app/components/TagPicker.vue`, `app/components/Tag*`, `app/queries/tags.ts`, and your test files.

- [ ] **Step 4: Report the interfaces you produced**

`TagPicker`'s props and model shape especially — wave 3 mounts it into two forms owned by another slice, and will be written against your description.

## Self-Review

**Spec coverage.** PRD §7.7 shared curated list → Tasks 1-4; autocomplete and inline create → Task 3; zero or more per entity → Task 3; rename updates everywhere → Tasks 1 and 4 (asserted cross-entity); delete gated on owner/admin → Tasks 1 and 4; usage-count confirmation → Tasks 2 and 4.

**Deliberately out of scope.** Wiring `TagPicker` into the box and item forms, and tag **filtering** on the index and search results — both are wave 3, because both edit files slice A and slice G own. Building the picker without a consumer is intentional: it is the dependency wave 3 needs, and shipping it now keeps this slice conflict-free.

**Known risk.** Task 3's component test is the least conventional part of this plan — if Nuxt UI's menu component proves impractical to drive in happy-dom, do not delete the coverage. Say so, and cover the picker's behaviour through an e2e test on `/tags` instead, reporting the change and why.
