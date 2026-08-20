# Slice E — Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A comment thread on the item page, closing PRD acceptance criterion 6 — "comments are visible to all members; only the author can edit/delete their own comment" — plus the in-app new-comment indicator from §7.5.

**Architecture:** A thread component appended to the existing item page, the three mutations behind it, and a client-side unread marker. Comments are the one collection where the ownership field is `user`, not `created_by`, and the only one where edit rights belong to the author rather than the parent box.

**Tech Stack:** Nuxt 4 SPA, Nuxt UI 4, PocketBase 0.39.11, `@peterbud/nuxt-query`, Vitest, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-19-storage-app-v1-design.md`
**Contract:** `docs/superpowers/interface-surface.md` — read first, then `wave-0-interface-surface.md`.
**Coordination:** `docs/superpowers/plans/2026-08-19-wave-2-overview.md`

## Global Constraints

- **pnpm** only. **Done means** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all green. TDD: failing test first.
- **No `any`**, no `as` to silence an error, no non-null `!`.
- **All reads and writes go through nuxt-query.** `import type` for types IS required.
- **Barebones styling.** Nuxt UI defaults, layout primitives only. No colour classes, no custom CSS.
- Loading and empty states on everything.
- Surface failures through `pbError(e)`.
- **`assertOnline()` first in every mutation.** **`$pb.filter(raw, params)`** for filters. **`useAuthUser()`**, not `useAuth()`, inside a handler.
- Commits: no attribution footers, no emoji trailers.
- **You own** `app/components/Comment*`, `app/composables/useUnreadComments.ts`, mutations in `app/queries/comments.ts`, and **one appended section** of `app/pages/item/[id].vue`. You may export only `useCreateComment`, `useUpdateComment`, `useDeleteComment`, `useUnreadComments`, `markItemRead`.

## Three things about comments differ from every other collection

Get these wrong and you will spend an hour on a 403.

1. **The ownership field is `user`, not `created_by`.** Create must set `user` to the authed user id; update must omit it entirely (`:isset = false`).
2. **Edit and delete rights belong to the comment's author**, not to the parent box's creator or editors. A box creator cannot edit someone else's comment on their own box. `canEditComment(comment, userId)` already exists — consume it, do not write another.
3. **Anyone can comment.** Create is gated only on enabled membership, not on box edit rights. A read-only member who cannot touch the box can still comment on its items — that is intended.

## Author names need the directory

`useComments()` deliberately does **not** `expand: 'user'`: `users.listRule` is `id = @request.auth.id`, so expansion returns `{}` for anyone else's comment. Resolve names through `useAppUserMap()`. A comment whose author is missing from the directory (membership revoked) must still render — fall back gracefully rather than showing a blank name.

---

### Task 1: Comment mutations

**Files:** Modify `app/queries/comments.ts` (append; leave `useComments` alone). Test: `tests/nuxt/commentMutations.spec.ts`

**Produces:** `useCreateComment()`, `useUpdateComment()`, `useDeleteComment()`, and a pure `commentUpdatePayload()`.

- [ ] **Step 1: Write the failing test**

Mirror the shape of `boxUpdatePayload` in `boxes.ts` — read it first.

```ts
import { describe, expect, it } from 'vitest'
import { commentUpdatePayload } from '~/queries/comments'
import type { StorageComment } from '~/types/pocketbase'

const existing: StorageComment = {
  id: 'c1', created: '', updated: '', item: 'i1', user: 'u_sam',
  text: 'Is this the one with the missing button?'
}

describe('commentUpdatePayload', () => {
  it('never includes user, which the update rule rejects outright', () => {
    expect('user' in commentUpdatePayload(existing, 'Edited')).toBe(false)
  })

  it('never includes item — a comment does not move between items', () => {
    expect('item' in commentUpdatePayload(existing, 'Edited')).toBe(false)
  })

  it('sends only the changed text', () => {
    expect(commentUpdatePayload(existing, 'Edited')).toEqual({ text: 'Edited' })
  })

  it('returns an empty payload when the text is unchanged', () => {
    expect(commentUpdatePayload(existing, existing.text)).toEqual({})
  })
})
```

- [ ] **Step 2: Run and watch it fail**
- [ ] **Step 3: Implement**

Each mutation calls `assertOnline()` first and invalidates `keys.comments.byItem(itemId)` in `onSettled`. `useCreateComment` sets `user: userId` from `useAuthUser()`.

Reject an empty or whitespace-only comment before sending — `text` is required, so PocketBase will 400, but a clear client-side message beats a server error for something this obvious.

- [ ] **Step 4: Run the test** — 4 pass.
- [ ] **Step 5: Commit** — `Add comment create, update and delete mutations`

---

### Task 2: Unread indicator

**Files:** Create `app/composables/useUnreadComments.ts`. Test: `tests/nuxt/unreadComments.spec.ts`

PRD §7.5 wants an in-app badge when comments arrived since the user last viewed an item. §11 leaves the mechanism to the implementer, and the design spec already chose: **a per-item `localStorage` timestamp**. No schema change — a persisted field would need one, and this is a badge.

**Produces:** `useUnreadComments(itemId, comments)` → `ComputedRef<number>`, `markItemRead(itemId)`, and a pure `countUnread(comments, lastViewedIso, currentUserId)`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { countUnread } from '~/composables/useUnreadComments'
import type { StorageComment } from '~/types/pocketbase'

const c = (id: string, created: string, user: string): StorageComment =>
  ({ id, created, updated: created, item: 'i1', user, text: 'x' })

const comments = [
  c('c1', '2026-08-01 10:00:00Z', 'u_sam'),
  c('c2', '2026-08-03 10:00:00Z', 'u_dana'),
  c('c3', '2026-08-05 10:00:00Z', 'u_sam')
]

describe('countUnread', () => {
  it('counts comments newer than the last view', () => {
    expect(countUnread(comments, '2026-08-02 00:00:00Z', 'u_rae')).toBe(2)
  })

  it('never counts your own comments — you just wrote them', () => {
    expect(countUnread(comments, '2026-08-02 00:00:00Z', 'u_sam')).toBe(1)
  })

  it('counts everything when the item has never been viewed', () => {
    expect(countUnread(comments, null, 'u_rae')).toBe(3)
  })

  it('counts nothing when everything predates the last view', () => {
    expect(countUnread(comments, '2026-09-01 00:00:00Z', 'u_rae')).toBe(0)
  })

  it('handles comments still loading', () => {
    expect(countUnread(undefined, null, 'u_rae')).toBe(0)
  })
})
```

Excluding your own comments is the case that makes the badge feel right rather than broken.

- [ ] **Step 2: Run and watch it fail**
- [ ] **Step 3: Implement**

Keep `localStorage` access behind the composable, and guard it — a browser with storage disabled must degrade to "no badge", not crash the item page. `markItemRead` is called when the thread is viewed.

- [ ] **Step 4: Run the test** — 5 pass.
- [ ] **Step 5: Commit** — `Add unread comment tracking`

---

### Task 3: The thread

**Files:** Create `app/components/CommentThread.vue` (plus `Comment*` helpers), and append **one section** to `app/pages/item/[id].vue`.

Required behaviour (PRD §7.5):
- Comments oldest first, each showing **author name and timestamp**.
- Any member can post.
- Edit and delete shown only for your own comments, gated on `canEditComment`.
- Delete asks for confirmation — it is destructive and there is no undo.
- **Loading**, **empty** (`data-testid="comment-thread-empty"`), and error states.
- The unread badge, cleared once viewed.
- Submit disabled while pending; a duplicate submit must not post twice.

`app/pages/item/[id].vue` belongs to nobody now. Add your thread section and change nothing else in it. Slice G edits a different page, so you cannot collide.

- [ ] **Step 1: Write the failing e2e tests**

The seeded fixture has exactly one item with comments: **"Navy wool peacoat"** in `seedbox1`, with two — Sam asks, Dana replies. Every other item has none, which gives you a free empty-state case.

Cover the criterion from both sides:

```ts
test.describe('as the comment author', () => {
  test.use({ storageState: 'tests/e2e/.auth/sam.json' })
  test('can edit and delete their own comment', async ({ page }) => { /* ... */ })
})

test.describe('as another member', () => {
  test.use({ storageState: 'tests/e2e/.auth/rae.json' })
  test('sees the thread but cannot edit anyone else’s comment', async ({ page }) => { /* ... */ })
  test('can still post a comment on a box they cannot edit', async ({ page }) => { /* ... */ })
})
```

That last one is worth having: it proves commenting is not gated on box edit rights, which is easy to get wrong by copying the item mutations.

Prove the server rule too — as `rae`, call the API directly to update Sam's comment and assert PocketBase refuses. Hiding the button is UX.

**Create the comments your tests mutate.** Do not edit or delete the two seeded ones — slice A and the report counts depend on the fixture. Clean up in `test.afterEach`, not a `finally`.

- [ ] **Steps 2-4: Fail, implement, pass**
- [ ] **Step 5: Commit** — `Add the item comment thread`

---

### Task 4: Slice exit check

- [ ] **Step 1: Full loop from a cold start** (down -v, up, seed, all four commands).
- [ ] **Step 2: Fixture unchanged.** Run e2e twice, then query PocketBase: 5 boxes, 9 items, 5 tags, and **exactly 2** comments, both on the peacoat. A leftover comment breaks the next run's counts.
- [ ] **Step 3: Ownership.** `git diff --name-only main...HEAD` — your components, composable, `comments.ts`, your tests, and `app/pages/item/[id].vue` with a single added section.
- [ ] **Step 4: Report the interfaces you produced.**

## Self-Review

**Spec coverage.** PRD §7.5 any member comments → Task 3; author and timestamp → Task 3; author-only edit/delete → Tasks 1 and 3, proven server-side; no push, in-app indicator only → Task 2.

**Out of scope.** Notifications of any kind (PRD §3 defers them and §11 says not to scaffold). Threading or replies — the PRD describes a flat thread. Cross-device unread sync, which would need the schema change §11 explicitly leaves optional.

**Known risk.** The three ways comments differ from every other collection — `user` not `created_by`, author-owned edit rights, and creation open to non-editors — are all easy to miss by pattern-matching the item mutations. Re-read that section before writing Task 1.
