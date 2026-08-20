# Slice A — Boxes + Items — Report

Branch: `slice-a` (worktree `/home/daniel/Projects/storage-app/.worktrees/slice-a`)
PocketBase: `http://localhost:8091` (this worktree's isolated instance)
E2E: `E2E_PORT=3001`

## Status: DONE, with one environmental caveat on the e2e loop (see "Final loop" below)

## What was built, per task

**Task 1 — `qr_id` generation** (`app/utils/qrId.ts`, `tests/nuxt/qrId.spec.ts`)
`newQrId()`: 8 lowercase-alphanumeric chars via `crypto.getRandomValues` with a
rejection-sampling loop (avoids modulo bias). Uses `String.charAt` rather than
bracket indexing so it satisfies `noUncheckedIndexedAccess` under `vue-tsc`.

**Task 2 — image compression** (`app/utils/compressImage.ts`, `tests/nuxt/compressImage.spec.ts`)
`compressImage(file)` / `compressImages(files)` wrapping `browser-image-compression`
with `{ maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: true }`, restoring the
original filename (the library can rename the output to `blob`).

**Task 3** — removed per plan; consumed `useCanEdit`/`canEditBox`/`canDeleteBox`
from the shared wave-0 contract (`app/composables/useCanEdit.ts`) unchanged.

**Task 4 — box mutations** (appended to `app/queries/boxes.ts`, `tests/nuxt/boxMutations.spec.ts`)
`boxUpdatePayload()` (pure, never includes `created_by`/`qr_id`), `useCreateBox()`
(sets `status: 'active'` and `created_by`, retries once on a `qr_id` collision),
`useUpdateBox()`, `useSetBoxStatus()` (archive/unarchive), `useDeleteBox()`
(creator-only at the API — a granted editor gets a 403 by design).

**Task 5 — item mutations** (appended to `app/queries/items.ts`, `tests/nuxt/itemMutations.spec.ts`)
`itemUpdatePayload()` (mirrors `boxUpdatePayload`), `useCreateItem()`,
`useUpdateItem()`, `useDeleteItem()`, `useMoveItems()` (one update per item,
PocketBase has no batch endpoint; reports partial failure honestly rather than
claiming a clean move).

**Task 6 — box index page** (`app/pages/index.vue`, `app/components/BoxCard.vue`, `tests/e2e/boxes.spec.ts`)
Grid of active boxes (thumbnail via `pb.files.getURL(..., { thumb: '200x200' })`,
title falling back to `qr_id` when blank, location). "Show archived boxes"
checkbox — since `BoxListFilters.status` only ever selects one status, this
swaps the list to archived-only rather than merging the two (there's no "both"
option in the shared filter contract). Loading skeletons
(`box-list-loading`), empty state (`box-list-empty`) verified by an e2e test
that temporarily archives every active box via a direct PocketBase call and
restores it in a `finally` block — chosen over a tag-filter approach because
slice A doesn't build tag-filtering UI (that's wave 3), so a fake-tag filter
would have needed product surface that isn't in scope. `UPagination` wired to
`totalPages`/`totalItems`/`PER_PAGE`.

**Task 7 — create-box page** (`app/components/BoxForm.vue`, `app/pages/box/new.vue`)
Title-only-required form, multi-image upload via `UFileUpload` capped at 15
with a message rather than silent truncation, submit disabled while pending
(prevents a duplicate box on a fast double-tap — proven by an e2e test that
asserts the button is disabled immediately after the click), failure surfaces
`pbError` and leaves input intact, success navigates to `/box/<qr_id>`.

**Task 8 — box detail page** (`app/pages/box/[qr_id]/index.vue`, `app/components/ItemCard.vue`)
Title/description/location/gallery, paginated item list, not-found state
(`box-not-found`, driven by `useBoxByQrId`'s `retry: false` + a 404 check via
`ClientResponseError`), empty item-list state, Edit/Archive gated on `canEdit`,
Delete gated on `canDelete` (creator-only, proven from three seeded accounts:
dana sees both, sam — editor on seedbox1 only — sees Edit but not Delete on
seedbox1 and neither on seedbox2, rae sees neither). Edit and Add-item are
inline `UModal`s reusing `BoxForm`/`ItemForm` rather than separate routes,
since the PRD's route table has no `/box/:qr_id/edit`. Bulk move: a select
mode over the item list with a "Move to…" modal calling `useMoveItems`,
gated on `canEdit`.

**Task 9 — item create/detail** (`app/pages/item/[id].vue`, `app/components/ItemForm.vue`)
Title/description/notes, multi-image gallery (`item-gallery-image` per image,
`item-gallery-empty` when none), Edit/Delete gated on `canEdit` for the
**parent box** (via `useItem`'s `expand: 'box'`), not-found state
(`item-not-found`). Comment thread deliberately not built (wave 2 slice E) —
left a one-line comment marking where it attaches.

**Both forms**: since `BoxEdit`/`ItemEdit` have no `images` field (the update
mutations genuinely can't persist image changes), the Photos field is hidden
in edit mode rather than silently discarding uploads — flagged as an
assumption below.

## TDD evidence

Each task's test was written first and run to a real RED before implementation.
Representative examples (full detail for every task is in the commit history —
one commit per task, test + implementation together per CLAUDE.md):

- `qrId.spec.ts`: RED — `Failed to resolve import "~/utils/qrId"`. GREEN after
  `app/utils/qrId.ts` — 3/3 passed.
- `boxMutations.spec.ts`: RED — `TypeError: boxUpdatePayload is not a function`.
  GREEN after appending the mutations — 5/5 passed.
- `tests/e2e/boxes.spec.ts` "creates a box with only a title…": RED —
  `getByLabel('Title')` timed out (no `/box/new` route). GREEN after
  `BoxForm.vue` + `box/new.vue`.
- `tests/e2e/itemDetail.spec.ts`: RED — `getByText('Navy wool peacoat')` not
  found on `/item/<id>` (route didn't exist). GREEN after `item/[id].vue`,
  10/10 passed including the two-photo gallery test (uploads two PNGs
  generated on the fly per the plan's guidance, not committed as fixtures).

Two intermediate typecheck-driven fixes, each its own commit:
`newQrId` switched from bracket indexing to `.charAt()`, and
`compressImage.spec.ts` switched from indexing `mock.calls[0][1]` to
`toHaveBeenCalledWith(expect.objectContaining(...))` — both to satisfy
`noUncheckedIndexedAccess` under `vue-tsc`, which `eslint` doesn't catch.

One pre-existing test updated: `tests/nuxt/smoke.spec.ts` asserted
`page.text()).toContain('Storage Boxes')` against `index.vue`'s wave-0
placeholder stub. Now that `index.vue` is the real box index page, that text
no longer appears; the assertion was updated to check for `'Boxes'` (the
page's actual heading) with a comment explaining the smoke test only proves
the Nuxt test harness can mount a page, not what that page contains.

## Final loop

```
pnpm lint        → clean
pnpm typecheck   → clean (vue-tsc --build --noEmit)
pnpm test        → 10 files, 59/59 tests passed
pnpm test:e2e (E2E_PORT=3001) → 32/32 tests passed
```

**Caveat on the e2e run**: this machine is currently running 3 other agents'
worktrees concurrently (slice-d, slice-j, and others), with load average
23-27 on an 8-core box for the entire session. At Playwright's default worker
count (= CPU count), the same three tests fail deterministically every run —
`auth.spec.ts`'s unauthenticated-redirect test, `boxDetail.spec.ts`'s
"sees edit and delete controls", and `boxes.spec.ts`'s "lists active boxes" —
all on a 15s `toBeVisible` timeout on the *first* hit of a route in a
freshly-booted dev server (Vite compiles each route's dependency graph
on demand; playwright.config.ts's own comment already documents this as a
known first-navigation cost). With `--workers=2`, every test passes cleanly,
twice in a row (32/32 both times). `pnpm test` unit suite showed the same
pattern — `setupNuxt()` hook timeouts across most files at default
parallelism, 59/59 passing with `--no-file-parallelism`, then 59/59 passing
even at default parallelism on a subsequent retry once contention eased.
I did not modify `playwright.config.ts` or `vitest.config.ts` (shared,
unowned files) to work around this — the suite is correct; the shared
machine's simultaneous load from other agents is the limiting factor, exactly
as CLAUDE.md's "re-run before concluding red" note anticipates. I'd suggest
whoever merges this re-run `E2E_PORT=3001 pnpm test:e2e` in isolation to get a
clean default-concurrency confirmation.

## Files changed

```
app/components/BoxCard.vue        (new)
app/components/BoxForm.vue        (new)
app/components/ItemCard.vue       (new)
app/components/ItemForm.vue       (new)
app/pages/box/[qr_id]/index.vue   (new)
app/pages/box/new.vue             (new)
app/pages/index.vue               (rewritten from placeholder)
app/pages/item/[id].vue           (new)
app/queries/boxes.ts              (appended: mutations)
app/queries/items.ts              (appended: mutations)
app/utils/compressImage.ts        (new)
app/utils/qrId.ts                 (new)
tests/e2e/auth.spec.ts            (extended — authorised exception, Task 8 step 5)
tests/e2e/boxDetail.spec.ts       (new)
tests/e2e/boxes.spec.ts           (new)
tests/e2e/itemDetail.spec.ts      (new)
tests/nuxt/boxMutations.spec.ts   (new)
tests/nuxt/compressImage.spec.ts  (new)
tests/nuxt/itemMutations.spec.ts  (new)
tests/nuxt/qrId.spec.ts           (new)
tests/nuxt/smoke.spec.ts          (updated — see above)
pnpm-workspace.yaml               (see "Ownership deviations" below)
```

12 commits, one logical change each, no attribution footers.

## Ownership deviations (please review)

1. **`pnpm-workspace.yaml`** — added `maplibre-gl: true` to `allowBuilds`.
   This file isn't listed in the wave-1 ownership table at all. Without it,
   every `pnpm <script>` invocation in this worktree failed outright with
   `[ERR_PNPM_IGNORED_BUILDS]` before running anything (pnpm 11's
   postinstall-script approval gate, apparently never approved for this
   worktree). I ran `pnpm approve-builds --all` once to unblock the loop;
   it only added the one missing entry, and lint/test/typecheck could not
   run at all before this. Flagging rather than assuming it's fine, since
   it's a shared root config file.
2. **`tests/nuxt/smoke.spec.ts`** — not in the ownership table, but its only
   assertion was against `app/pages/index.vue`'s old placeholder text, which
   I legitimately replaced. Updated per CLAUDE.md's "if a test is wrong, say
   so and explain why" — explained above and in an inline comment.
3. **`ItemForm.vue`** was assigned to Task 9 in the plan but is used by Task
   8's "+ Add item" modal (the plan itself says box detail hosts the add-item
   action). I built it alongside Task 8 rather than leaving that button
   non-functional, and committed it in the Task 8 commit.

## Assumptions I could not resolve and had to make

- **No `/box/:qr_id/edit` or item-edit route exists in the PRD's route
  table**, so Edit for both boxes and items is an inline `UModal` on the
  detail page reusing `BoxForm`/`ItemForm`, rather than a separate page.
- **Editing images is not supported** — `BoxEdit`/`ItemEdit` (the shared
  mutation contract) have no `images` field, so the Photos upload field is
  hidden entirely in edit mode rather than accepting uploads that would be
  silently dropped.
- **"Show archived boxes" toggle swaps the view to archived-only** rather
  than merging active+archived, because `BoxListFilters.status` only ever
  selects one status — there's no "both" value in the shared filter
  contract, so a combined view isn't expressible without changing
  `keys.ts` (out of my ownership).
- **Bulk-move's destination picker uses `useBoxList`'s first page (≤30
  active boxes)**, not every box in the system — consistent with "never
  fetch unbounded lists," and the seed data never exceeds this, but a
  system with >30 boxes would need a searchable picker, which is out of
  scope for this slice.

## Not verified

- Visual review was via Playwright screenshots at the Pixel 7 viewport
  (narrow-viewport check per CLAUDE.md) for the box index, box detail, and
  item detail pages — no manual `pnpm dev` session was left running.
- Did not test slice A's pages against the other slices' stub routes beyond
  confirming the links resolve (they're wave-0 stubs, owned elsewhere).

---

# Review fixes

Applied on branch `slice-a` after review, in four commits on top of the
original twelve. Full loop green, e2e run twice consecutively, seed fixture
verified byte-identical afterwards.

## 1. `pnpm-workspace.yaml` — `maplibre-gl: false`

Changed, and `pnpm install` still succeeds — the reviewer's ruling stands:

```
$ pnpm install
✓ Lockfile passes supply-chain policies (verified 4h ago)
Lockfile is up to date, resolution step is skipped
Already up to date
. postinstall$ nuxt prepare
. postinstall: ◆  Types generated in .nuxt.
Done in 1.9s using pnpm v11.22.0
```

Commit `2132b38`.

## 2. `useMoveItems` invalidates on partial failure

`onSuccess` → `onSettled` in `app/queries/items.ts`.

Covered by a new e2e test, `boxDetail.spec.ts` "refreshes the item list when a
bulk move only partly succeeds": two items in a throwaway box, `page.route`
fulfils the **second** PATCH with a 403, and the test asserts both that the
alert says `Moved 1 of 2` and that the source box now lists one item.

Watched fail for the right reason with `onSettled` reverted to `onSuccess`:

```
✘ boxDetail.spec.ts › refreshes the item list when a bulk move only partly succeeds
  Error: expect(locator).toHaveCount(expected) failed
  Expected: 1
  Received: 2
  > 180 |  await expect(page.getByTestId('item-row')).toHaveCount(1)
```

## 3. E2E cross-file races

Three structural changes, plus one root cause the review had not seen.

**Shared fixture builder** — `tests/e2e/helpers.ts` (new): `authedPb()`,
`createBox()`, `createItem()`, `deleteBoxAndItems()`, `throwawayBoxes()`. The
`authedPb`/`pocketbaseUrl` pair was copy-pasted into three spec files.

**Bulk-move restore is by id, not by filter.** The test now creates its own
source and destination boxes, captures the moved item's id before the move,
and restores with `update(moving.id, { box: source.id })`. The old
`getFirstListItem('box.qr_id = "seedbox4"')` could pick up any record another
spec file had put there — the corruption path the review identified.

**The item test creates its own box** instead of adding an item to `seedbox4`,
so `boxDetail.spec.ts`'s empty-box assertion is unaffected. That assertion now
also uses a box it created itself.

**The archive-all test no longer archives anything.** Scoping it to
self-created boxes was not expressible: the index is a *global* list with no
ownership filter, so a real empty state requires archiving every active box in
the database. It now stubs the list response with `page.route` and asserts the
same render branch. This is the one place I deviated from the literal
instruction; the goal — structurally incapable of touching shared state — is
met more completely this way.

**`describe.configure({ mode: 'serial' })` removed** from all three files. With
no shared state left it bought nothing, and it suppressed the remaining tests
in a file after the first failure.

Two root causes found while making this stick, both now in `CLAUDE.md`:

- **The PocketBase SDK auto-cancels concurrent requests to the same endpoint.**
  A `Promise.all` of 31 `create()` calls silently kept only the last — and the
  cancelled writes still landed server-side *after* the cleanup listing ran,
  which is exactly how a stray item survived into the next run. Test clients now
  call `pb.autoCancellation(false)`.
- **Playwright hard-kills a timed-out test, so a `finally` never runs.** One
  60s timeout left a box with 21 items behind. Teardown moved into
  `test.afterEach` via `throwawayBoxes()`, which gets its own timeout budget.

`deleteBoxAndItems` also re-queries page 1 until it comes back empty rather
than trusting one listing, so cleanup cannot leave the item that makes the
box delete fail with a 400.

One unrelated flake fixed while here: "disables the submit button while the
create request is pending" passed or failed on machine load, because a local
create round trip can finish inside a single assertion poll. The POST is now
held open 1.5s with `page.route`, which tests the pending state rather than
the network.

## 4. "Show archived" includes rather than swaps

`app/pages/index.vue` renders `<BoxSection status="active">` always and
`<BoxSection status="archived">` when the toggle is on — two `useBoxList`
calls, each with its own page counter. `BoxSection.vue` is new and carries the
loading/error/empty/grid/pagination markup both sections share; `index.vue`
lost 53 lines. No `keys.ts` change.

Screenshot at the Pixel 7 viewport confirms both sections render with the
active boxes still on screen, headings "Active" and "Archived", and the
archived card keeping its badge. Covered by `boxes.spec.ts` "adds archived
boxes as a second section rather than swapping the list", which asserts a
seeded active box and the archived box are visible *together*.

## 5. Write paths exercised against the API

Five new e2e tests issue real PATCHes and DELETEs through the UI:

- `boxDetail.spec.ts` "edits a box title through the UI and sees it on the
  page" — opens the Edit modal, saves, asserts the heading, then re-reads the
  record over the SDK and asserts the stored title.
- `itemDetail.spec.ts` "edits an item title through the UI and sees it on the
  page" — same shape.
- `boxDetail.spec.ts` "archives and unarchives a box through the UI control" —
  clicks the control (not the SDK), asserts the button flips to Unarchive, that
  the index's Active section no longer lists it and the Archived section does,
  then unarchives and asserts the reverse.
- `boxDetail.spec.ts` "deletes an empty box only after confirming".
- `itemDetail.spec.ts` "deletes an item only after confirming".

Every one builds its own fixture and tears it down in `afterEach`.

## 6. Delete confirmations, and box delete disabled while items remain

`UModal` on both deletes, naming the record (`delete-box-confirm` /
`delete-item-confirm`) with Cancel and a destructive action. The box Delete
control is `:disabled="itemsPending || hasItems"` with the plain line "Empty
this box before deleting it." underneath — `storage_items.box` is required with
`cascadeDelete: false`, so the API always answers 400 there. Nothing
cascade-deletes items; that stays a schema decision.

Covered by "cannot delete a box that still holds items" and the two
confirm-then-delete tests, which also assert Cancel leaves the user on the
record.

## 7. Gallery `alt` text

Box gallery: `` `${box.title || box.qr_id}, photo ${index + 1}` ``.
Item gallery: `` `${item.title}, photo ${index + 1}` ``. Asserted in
`itemDetail.spec.ts`:
`toHaveAttribute('alt', 'Spare duvet and two pillows, photo 1')`.

## 8. `selectedIds` cleared when the item page changes

`watch(itemPage, () => { selectedIds.value = [] })`. Covered by "drops a
bulk-move selection when the item list changes page" — 31 items in a throwaway
box, select one on page 1, go to page 2, assert the "Move to…" button is gone.

Watched fail for the right reason with the watcher removed:

```
✘ boxDetail.spec.ts › drops a bulk-move selection when the item list changes page
  Error: expect(locator).toBeHidden() failed
  Expected: hidden
  Received: visible
  > 204 |  await expect(page.getByTestId('move-items')).toBeHidden()
```

## Final loop

```
$ pnpm lint
$ eslint .
                                            → clean

$ pnpm typecheck
$ vue-tsc --build --noEmit
                                            → clean

$ pnpm test --hookTimeout=180000
 Test Files  10 passed (10)
      Tests  59 passed (59)
   Duration  6.09s

$ E2E_PORT=3001 pnpm test:e2e --workers=2
  40 passed (1.8m)          # run 1 of 2

$ E2E_PORT=3001 pnpm test:e2e --workers=2
  40 passed (1.8m)          # run 2 of 2
```

40 e2e tests, up from 32.

## Fixture verification

Queried PocketBase on :8091 directly before the first run, between the two
runs, and after the second. Identical every time:

```
boxes: 5
  seedbox1  active    items=3  Winter coats and boots
  seedbox2  active    items=2  Kitchen overflow: the bread machine, the stan…
  seedbox3  active    items=3  Tax records 2019-2023
  seedbox4  active    items=0  Empty spare box
  seedbox5  archived  items=1  College photo albums
items: 9
```

Content, not just counts — SHA-256 over every box's
`qr_id/title/description/location/status/images/tags` and every item's
`title/description/notes/images/tags`, sorted:

```
records: 5 boxes / 9 items
sha256: f42547f57b94e24de70870f818c2c34e5c64244e44822c37f369e65851bd44e3
```

## Ownership deviations

- **`CLAUDE.md`** — three lines added to the Tests section for the two
  discoveries above (SDK auto-cancellation, `afterEach` vs `finally`) and the
  cross-file parallelism rule. The file's own closing section requires this in
  the same commit; flagging it because the file is shared.
- **`tests/e2e/helpers.ts`** is new and shared by the three spec files I own.
  Other slices' specs can use it; nothing in it is slice-A-specific.

## Commit grouping

Four commits. The three spec files each land with the app change they prove,
which is why `boxDetail.spec.ts` arrives in one commit covering fixes 2, 3, 5,
6, 7 and 8 for the box detail page — a spec file cannot be split across
commits without staging hunks, and splitting the tests away from the code they
cover would break the "never as a follow-up commit" rule instead.

```
2132b38  Skip maplibre-gl's no-op postinstall script                      (fix 1)
9590985  Include archived boxes in a second section instead of swapping…  (fix 4, 3)
615a5e5  Guard the destructive paths on box detail                        (fix 2, 3, 5, 6, 7, 8)
3466d1d  Confirm item deletes and describe the item gallery               (fix 3, 5, 6, 7)
```
