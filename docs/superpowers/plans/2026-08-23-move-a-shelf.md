# Move a Shelf — Bulk Location Change Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Select several boxes on the index and set their location in one action.

**Why:** `location` is per box and edited one box at a time through the edit modal. When a shelf is cleared, or the loft is emptied into the garage, that is eight boxes × four taps each, and the eighth one gets a typo. The machinery for this already exists — box detail bulk-moves *items* between boxes with a select mode, a checkbox per row and a floating count bar, and `/archived` bulk-unarchives with the same shape. This is the third instance of a pattern the app already has twice.

**Architecture:** Select mode on `BoxSection`, one mutation, and a location picker that offers what is already in use. No new collection, no new field.

**Tech Stack:** Nuxt 4 SPA, Nuxt UI 4, PocketBase 0.39.11, `@peterbud/nuxt-query`, Vitest, Playwright, pnpm.

## Does this need a database change?

**No.** `storage_boxes.location` is an existing free-text field. This writes the same field the edit form writes, to several records instead of one.

A *normalised* location — a `storage_locations` collection with a relation — is the version that makes "Garage shelf A3" and "garage shelf a3" the same place. That is a schema change, a migration and a merge UI, and it is not needed to ship this: autocomplete from the values already in use solves most of the same problem for none of the cost. See "Out of scope".

## Global Constraints

- **pnpm** only. **Done means** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all green. TDD: failing test first.
- **No `any`**, no `as`, no non-null `!`.
- All reads and writes through nuxt-query. `assertOnline()` first in the mutation.
- Surface failures through `pbError(e)`.
- Follow `CLAUDE.md`. Read `docs/storage-app-prd.md` before starting.

## Two things that will bite you

1. **Never include an ownership field in an update.** The box update rule uses `created_by:isset = false` and rejects the payload if `created_by` is present *at all*, even set correctly. Send `{ location }` and nothing else. Do not spread a fetched record into `update()`. `boxUpdatePayload()` in `app/queries/boxes.ts` is the existing shape — read it.

2. **A rejected update returns 404, not 403.** PocketBase applies update rules as a filter on the record lookup, so a box the user cannot edit is simply not found. Expect the 404, and assert in the test that the record is *unchanged* as well.

3. **The SDK cancels concurrent requests to the same endpoint** — same trap as the bulk item add. Update sequentially.

---

### Task 1: The mutation

**Files:** Modify `app/queries/boxes.ts` (append). Test: `tests/nuxt/boxMutations.spec.ts` (append)

**Produces:** `useMoveBoxes()`

```ts
useMoveBoxes(): { ids: string[], location: string } => Promise<{ moved: string[], failed: { id: string, message: string }[] }>
```

- [ ] **Step 1: Write the failing test**

- The payload is `{ location }` only — assert `'created_by' in payload` is `false`, and `'title' in payload` is `false`. This is the assertion that catches the 403-shaped mistake before it ships.
- Sequential, not concurrent.
- A 404 on one box does not abort the rest and comes back in `failed` — a mixed selection where one box belongs to someone else must still move the ones that do not.
- Invalidate `keys.boxes.all` once, at the end.

- [ ] **Step 2: Implement**
- [ ] **Step 3: Verify**

---

### Task 2: Known locations

**Files:** Modify `app/queries/reports.ts` (append). Test: `tests/nuxt/reports.spec.ts` (append)

**Produces:** `useKnownLocations(): ComputedRef<string[]>`

Built on `useBoxFill()`, which already carries `location` per box and is already in flight on the index for the item counts — the same reasoning as `useBoxItemCounts()`. **Do not** add a second request, and do not `getFullList` the boxes to derive this.

- [ ] **Step 1: Write the failing test** — distinct, non-blank, sorted, and trimmed. Case-insensitive de-duplication, keeping the most common casing: "Garage shelf A3" and "garage shelf a3" must offer one entry, not two.
- [ ] **Step 2: Implement**
- [ ] **Step 3: Verify**

---

### Task 3: Select mode on the box index

**Files:** Modify `app/components/BoxSection.vue`, `app/pages/boxes.vue`, `app/components/BoxCard.vue`.

**Produces:** A Select affordance on the index, a checkbox per card, a floating count bar.

- [ ] **Step 1: Build it**

**Read `app/pages/archived.vue` first and copy its shape.** It solves this exact problem — a mode toggle, a checkbox per row, a bar that appears only with a selection — including why it is a bar rather than a swipe (a swipe fights the vertical scroll, has no keyboard equivalent, and does one row at a time).

`BoxCard` gains `selectable` / `selected` / `@update:selected`, matching `ItemCard`'s existing props exactly. The checkbox sits **outside** the `NuxtLink`, over it — a checkbox nested in an anchor toggles the navigation instead of the selection. `ItemCard`'s grid branch already documents this.

Selection is per section. Active and archived are two lists with two queries; a selection spanning both is a selection the count bar cannot describe.

- [ ] **Step 2: The move sheet**

A `USlideover` with `UInputMenu` over `useKnownLocations()`, `create-item` enabled so a new location can be typed — the same control `TagPicker` uses for tags, for the same reason.

Copy: *"Move 4 boxes to…"*. On success: *"Moved 4 boxes to Garage shelf A3"*, and leave select mode.

- [ ] **Step 3: Verify**

---

### Task 4: E2E

**Files:** New `tests/e2e/moveBoxes.spec.ts`

- [ ] Creates three of its own boxes, selects two, moves them, asserts both show the new location and the third is untouched.
- [ ] The picker offers a location already in use, and accepts one typed fresh.
- [ ] As `rae` (read-only): the Select affordance is hidden, **and** a direct `useMoveBoxes` call through the API is refused and the record is unchanged. Hiding a control is UX, not access control (`CLAUDE.md`).
- [ ] Offline: message shown, selection kept, control usable again.
- [ ] Teardown via `throwawayBoxes()` in `afterEach`.

---

## Out of scope

- **Normalising locations into their own collection.** It is the right long-term answer and it is a schema change: a `storage_locations` collection, a relation on `storage_boxes`, a migration that back-fills from the free text, a merge UI for the near-duplicates that back-fill will surface, and API rules. Autocomplete gets most of the benefit for none of it. Revisit when someone actually has forty locations and a mess.
- Moving items between boxes. Box detail already does that.
- A location detail screen ("what is on Garage shelf A3"). Related, separately useful, its own plan.
