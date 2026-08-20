# Slice F — Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a box's creator grant and revoke editor rights, closing PRD acceptance criterion 5 — "the box creator can grant a second user editor rights via the share page, after which that user can edit the box and its items."

**Architecture:** One page and the two mutations behind it. The permission model already exists and is enforced server-side; this slice only exposes it. `storage_box_permissions` is a sparse override table — a row exists only for a user granted editor on a specific box.

**Tech Stack:** Nuxt 4 SPA, Nuxt UI 4, PocketBase 0.39.11, `@peterbud/nuxt-query`, Vitest, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-19-storage-app-v1-design.md`
**Contract:** `docs/superpowers/interface-surface.md` — read first, then `wave-0-interface-surface.md` for record types and the seeded fixture.
**Coordination:** `docs/superpowers/plans/2026-08-19-wave-2-overview.md`

## Global Constraints

- **pnpm** only. **Done means** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all green. TDD: failing test first, watched fail, then implement.
- **No `any`**, no `as` to silence an error, no non-null `!`.
- Nuxt auto-imports are on. `import type` for types IS required.
- **All reads and writes go through nuxt-query.**
- **Barebones styling.** Nuxt UI defaults, layout primitives only. No colour classes, no custom CSS.
- Every screen needs a loading state and an empty state.
- Surface failures through `pbError(e)`.
- **`assertOnline()` first in every mutation.** **`$pb.filter(raw, params)`** for every filter. **`useAuthUser()`**, not `useAuth()`, inside a handler.
- Commits: no attribution footers, no `Co-Authored-By`, no emoji trailers.
- **You own** `app/pages/box/[qr_id]/share.vue`, `app/components/Share*`, and mutations appended to `app/queries/permissions.ts`. Nothing else. You may export only `useGrantEditor`, `useRevokeEditor`, `useGrantableUsers`.

## The rules you are exposing — do not re-derive them, they are already encoded

From `pb_migrations/`, verified during wave 0:

- `storage_box_permissions` create/update/delete: **box creator only.** A granted editor cannot grant others.
- Its list/view: any enabled member. So anyone can *see* who has access; only the creator can change it.
- Granting `role: 'editor'` on a box lets that user edit the box and its items — but **not delete the box**, which stays creator-only.

`canDeleteBox()` already encodes that asymmetry. Use it; do not write a second version.

## Where the users come from

`users.listRule` is `id = @request.auth.id`, so you **cannot list users**. The member directory is the `storage_app_users` view, exposed as `useAppUsers()` / `useAppUserMap()`. That is the only way to resolve a user id to a name, and the only source for a "who can I grant this to" picker.

---

### Task 1: Permission mutations

**Files:** Modify `app/queries/permissions.ts` (append; leave `useBoxPermissions` alone). Test: `tests/nuxt/permissionMutations.spec.ts`

**Produces:** `useGrantEditor()`, `useRevokeEditor()`, `useGrantableUsers(boxId)`.

- [ ] **Step 1: Write the failing test**

`useGrantableUsers` is the piece with real logic — it must exclude the box's creator (who already has rights and cannot be granted) and anyone already granted. Make that a pure, exported helper so it tests without `$pb`:

```ts
import { describe, expect, it } from 'vitest'
import { grantableUsers } from '~/queries/permissions'
import type { AppUser, StorageBoxPermission } from '~/types/pocketbase'

const dir: AppUser[] = [
  { id: 'u_dana', name: 'Dana Herskowitz', role: 'owner' },
  { id: 'u_sam', name: 'Sam Okafor', role: 'member' },
  { id: 'u_rae', name: 'Rae Lindqvist', role: 'member' }
]
const grant = (user: string): StorageBoxPermission => ({
  id: 'p1', created: '', updated: '', box: 'box1', user, role: 'editor'
})

describe('grantableUsers', () => {
  it('excludes the creator, who already has full rights', () => {
    expect(grantableUsers(dir, [], 'u_dana').map(u => u.id)).toEqual(['u_sam', 'u_rae'])
  })

  it('excludes a user who already holds a grant', () => {
    expect(grantableUsers(dir, [grant('u_sam')], 'u_dana').map(u => u.id)).toEqual(['u_rae'])
  })

  it('returns nobody when everyone already has access', () => {
    expect(grantableUsers(dir, [grant('u_sam'), grant('u_rae')], 'u_dana')).toEqual([])
  })

  it('handles the directory still loading', () => {
    expect(grantableUsers(undefined, [], 'u_dana')).toEqual([])
  })

  it('handles permissions still loading by granting nobody, rather than offering a duplicate', () => {
    expect(grantableUsers(dir, undefined, 'u_dana')).toEqual([])
  })
})
```

That last case matters: offering a user who already has a grant produces a duplicate row, and the UI would then show them twice.

- [ ] **Step 2: Run it and watch it fail**
- [ ] **Step 3: Implement**

`useGrantEditor` creates a `storage_box_permissions` row (`box`, `user`, `role: 'editor'`); `useRevokeEditor` deletes one by id. Both call `assertOnline()` first and invalidate `keys.permissions.byBox(boxId)` in `onSettled`.

Note `storage_box_permissions` has **no ownership field** — the create rule gates on `box.created_by`, not on a body field. So there is no `created_by` to set and none to omit. Say so in a comment; the next reader will expect one.

- [ ] **Step 4: Run the test** — 5 tests pass.
- [ ] **Step 5: Commit** — `Add editor grant and revoke mutations`

---

### Task 2: The share page

**Files:** Create/replace `app/pages/box/[qr_id]/share.vue` (currently a 3-line stub), plus `app/components/Share*` as needed.

Required behaviour (PRD §7.2):
- **Creator only.** A non-creator visiting the page sees a clear "only the box's creator can manage sharing" state, `data-testid="share-denied"` — not a blank page and not a broken form. The API is the real guard; this is UX.
- Lists current editors by **name**, resolved through `useAppUserMap()`.
- Add an editor by selecting from `useGrantableUsers()`.
- Remove an editor.
- **Loading**, **empty** (`data-testid="share-empty"` — no editors yet, the common case), and error states.
- A box-not-found state for an unknown `qr_id`.
- A link back to the box.

- [ ] **Step 1: Write the failing e2e tests**

The whole point of this slice is the round trip, so test it end to end. `rae@local.test` has no grants anywhere in the fixture — grant, verify the effect, revoke, and clean up in `afterEach`.

```ts
test.describe('as the box creator', () => {
  test.use({ storageState: 'tests/e2e/.auth/dana.json' })

  test('grants an editor, who can then edit the box', async ({ page }) => {
    // seedbox3 has no grants; rae has none anywhere.
    await page.goto('/box/seedbox3/share')
    await expect(page.getByTestId('share-empty')).toBeVisible()
    // grant rae, assert she appears by name
  })

  test('revokes an editor', async ({ page }) => { /* ... */ })
})

test.describe('as a non-creator', () => {
  test.use({ storageState: 'tests/e2e/.auth/sam.json' })
  test('cannot manage sharing', async ({ page }) => {
    await page.goto('/box/seedbox3/share')
    await expect(page.getByTestId('share-denied')).toBeVisible()
  })
})
```

**The criterion is the effect, not the row.** Add a test that, after granting, `rae` can actually edit that box — sign in as rae in a second context and assert the Edit control is now visible on `/box/seedbox3`, where it was hidden before. A test that only asserts a permission row exists proves the form works, not the feature.

Prove the server rule too: as `sam` (a non-creator), call the API directly and assert PocketBase refuses the grant. Hiding the form is UX, not access control.

- [ ] **Steps 2-4: Fail, implement, pass**
- [ ] **Step 5: Commit** — `Add the box sharing page`

---

### Task 3: Slice exit check

- [ ] **Step 1: Full loop from a cold start**

```bash
docker compose down -v && docker compose up -d && sleep 5
python3 scripts/pb-seed.py <your PocketBase url>
pnpm lint && pnpm typecheck && pnpm test --hookTimeout=180000 && E2E_PORT=<your port> pnpm test:e2e
```

- [ ] **Step 2: Confirm the fixture is unchanged**

Run the e2e suite twice and query PocketBase directly afterwards: 5 boxes, 9 items, 5 tags, and **exactly one** `storage_box_permissions` row (sam on seedbox1). If your grant tests leave a second row behind, the teardown is wrong — and `seedbox1`'s single seeded grant is what slice A's permission tests depend on.

- [ ] **Step 3: Confirm ownership**

`git diff --name-only main...HEAD` — only your page, `Share*` components, `app/queries/permissions.ts`, and your tests.

- [ ] **Step 4: Report the interfaces you produced.**

## Self-Review

**Spec coverage.** PRD §7.2 share page → Task 2; creator-only grant/revoke → Tasks 1 and 2; acceptance criterion 5 (grant then the user can edit) → Task 2's effect test.

**Out of scope.** Any change to how editing itself is gated — `useCanEdit` already exists and is correct. Roles beyond `editor`; the schema allows only that value.

**Known risk.** The temptation is to test that a permission row was created. That is not the criterion. The criterion is that the granted user can subsequently edit, which requires a second authenticated context — write that test even though it is more work.
