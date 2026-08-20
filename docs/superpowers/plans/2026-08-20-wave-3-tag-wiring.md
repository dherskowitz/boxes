# Wave 3 — Tag Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish v1. Close the last two acceptance criteria — 8, "a user can tag a box or item using an existing tag (via autocomplete) or by creating a new one inline", and 10, "filtering the box index or search results by a tag returns only matching boxes/items."

**Architecture:** Almost nothing new is built. `TagPicker` exists and is tested; `boxFilter` and `itemFilter` already honour `tagIds`; the mutations already accept a `tags` array. This slice is connection work plus one genuine gap in search. It is a single slice, so it owns every file it touches — but the existing suite is the guard, and every test in it must still pass.

**Tech Stack:** Nuxt 4 SPA, Nuxt UI 4, PocketBase 0.39.11, `@peterbud/nuxt-query`, Vitest, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-19-storage-app-v1-design.md`
**Contract:** `docs/superpowers/interface-surface.md`, then `wave-0-interface-surface.md` for record types and the seeded fixture.

## Global Constraints

- **pnpm** only. **Done means** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all green, except the one known `offline.spec.ts:6` failure documented in `CLAUDE.md`.
- **Run every command in the foreground.** Do not background anything — several agents on this project have hung waiting on a notification that never arrives. Slow is expected on this machine, not a hang. Use `pnpm test --hookTimeout=180000`.
- **No `any`**, no `as` to silence an error, no non-null `!`.
- **Never interpolate into a PocketBase filter string** — `$pb.filter(raw, params)`.
- **`assertOnline()` first in every write mutation** (the existing ones already do this; do not remove it).
- **`useAuth()` is setup-only.** Use `useAuthUser()` inside a handler.
- **Barebones styling.** Nuxt UI defaults, layout primitives only, no colour classes, no custom CSS. **One documented exception**: a tag chip rendered in its stored `color` via an inline `:style` is *data*, not styling, and is how `/tags` already renders them. Follow that precedent.
- Every screen keeps its loading and empty states.
- **Run `pnpm nuxt prepare` before `pnpm typecheck`** after any branch switch, or stale `.nuxt` types report phantom "Cannot find name" errors.
- Commits: no attribution footers, no `Co-Authored-By`, no emoji trailers.

## What already exists — do not rebuild it

- **`TagPicker`** — `<TagPicker v-model="form.tags" />` is the entire API. No other props, no emits. The model is `string[]` of tag **ids**, exactly the shape `StorageBox.tags` and `StorageItem.tags` store, so it binds with no mapping. It creates tags itself via `useCreateTag` and pushes new ids into the model. Initialise the field to `[]`, never `undefined`.
- **`NewBox` / `BoxEdit` / `NewItem` / `ItemEdit`** all already carry `tags?: string[]`, and the mutations already send them. The forms simply never collected any.
- **`boxFilter` and `itemFilter` already honour `filters.tagIds`** via the shared `tagClauses()` helper, which AND-matches: a record must carry *all* selected tags.
- **`/tags`** already renders colour chips — reuse its approach rather than inventing a second one.

---

### Task 1: Close the search tagIds gap

**Files:** Modify `app/queries/search.ts`. Test: `tests/nuxt/searchFilter.spec.ts`

`SearchFilters` in `app/queries/keys.ts` declares `tagIds?: string[]`, and `keys.search.query()` folds it into the query key — but **`searchFilter` ignores it entirely.**

This is the same defect class the wave 0 final review caught in `useItemList`: the type advertises a parameter that does nothing. Pass `tagIds` today and the key changes, a fresh request fires, the spinner behaves correctly — and the results come back unfiltered, under a chip that says otherwise. No error, nothing red.

Fix it **before** building any UI on top, so the chips are never briefly lying.

- [ ] **Step 1: Write the failing test**

Extend `tests/nuxt/searchFilter.spec.ts` following its existing shape — it already asserts on the template *and* pipes the result through a real `PocketBase#filter`, which is the pattern that would actually catch a regression.

```ts
it('AND-matches every selected tag, for boxes', () => {
  const { raw, params } = searchFilter('coats', { kind: 'box', tagIds: ['t_winter', 't_fragile'] })
  expect(raw).toContain('tags ~ {:tag0}')
  expect(raw).toContain('tags ~ {:tag1}')
  expect(params.tag0).toBe('t_winter')
  expect(params.tag1).toBe('t_fragile')
})

it('AND-matches every selected tag, for items', () => { /* same, kind: 'item' */ })

it('still never lets a tag id reach raw', () => {
  const { raw } = searchFilter('coats', { kind: 'box', tagIds: ['t" || id != "'] })
  expect(raw).not.toContain('t"')
})

it('is unchanged when no tags are selected', () => {
  const withNone = searchFilter('coats', { kind: 'box' })
  const withEmpty = searchFilter('coats', { kind: 'box', tagIds: [] })
  expect(withEmpty).toEqual(withNone)
})
```

That last case guards against a stray `&&` when the tag list is empty.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test tests/nuxt/searchFilter.spec.ts`

- [ ] **Step 3: Implement**

Use the existing `tagClauses()` helper — do not hand-roll a second one. Tags apply to **both** kinds: a box carries tags and so does an item, so both branches of the filter need them.

- [ ] **Step 4: Run the test**
- [ ] **Step 5: Commit** — `Apply tag filters in search instead of ignoring them`

---

### Task 2: Mount TagPicker in the box and item forms

**Files:** Modify `app/components/BoxForm.vue`, `app/components/ItemForm.vue`

Both carry the placeholder `<!-- Tag selection is wired in by wave 3, using slice B's TagPicker. -->`. Replace it.

Required behaviour (PRD §7.7):
- The picker appears on **both** the create and edit paths. `BoxForm` and `ItemForm` are each shared between the two — check how the existing fields handle an existing record and follow it.
- Tags are **optional**: a box or item may carry zero. Criterion 1 — "create a box with just a title" — must still hold, so do not make the field required, and confirm that test still passes.
- On edit, the field must be **pre-populated** with the record's current tags. Getting this wrong silently clears a record's tags on save, because `boxUpdatePayload` compares against the existing array and would see a real change to `[]`.
- Initialise to `[]`, never `undefined`.

Do **not** touch the mutations — they already accept and send `tags`.

- [ ] **Step 1: Write the failing e2e test**

Criterion 8 in both halves — selecting an existing tag, and creating one inline:

```ts
test('tags a box with an existing tag from autocomplete', async ({ page }) => { /* ... */ })
test('creates a new tag inline while tagging a box', async ({ page }) => { /* ... */ })
test('preserves existing tags when editing a box without touching them', async ({ page }) => { /* ... */ })
```

That third test is the one that catches the silent-clear bug, and it is the least obvious to write.

**Create the boxes and items your tests tag — do not tag a seeded record.** Any tag you create inline must be deleted in `test.afterEach`, or the fixture's five-tag invariant breaks and `/tags` and the reports counts drift. Teardown goes in `afterEach`, never a `finally`.

- [ ] **Steps 2-4: Fail, implement, pass**
- [ ] **Step 5: Commit** — `Add tag selection to the box and item forms`

---

### Task 3: Tag filter chips on the box index

**Files:** Modify `app/pages/index.vue` (and `app/components/BoxSection.vue` if the filter belongs there), plus a `TagFilter` component if one helps.

Required behaviour (PRD §7.7):
- Filter the index by one or more tags, in addition to the existing free-text and archived controls.
- Multiple selected tags **AND-match** — a box must carry all of them. That is what `tagClauses()` already does; do not change it to OR.
- Clearing the filter restores the full list.
- The existing archived toggle and its two sections must keep working alongside it.
- An empty result under an active filter needs its own state — a filter that matches nothing is not the same as having no boxes at all, and the existing `box-list-empty-active` testid means "no boxes", so add a distinct one.

`app/pages/index.vue` has existing tests (`tests/e2e/boxes.spec.ts`, `searchIndexBar.spec.ts`). **Re-run both and confirm they still pass** — that page has been edited by three slices now.

- [ ] **Steps 1-4: Failing test, fail, implement, pass**
- [ ] **Step 5: Commit** — `Add tag filtering to the box index`

---

### Task 4: Tag filter chips on search results

**Files:** Modify `app/pages/search.vue`, plus `Search*` components as needed.

Same behaviour as Task 3, over search results, now that Task 1 has made the filter real.

- Keep the term in the URL as it is today, and put the selected tags there too so a filtered search is linkable and survives a reload — that is why the term is already there.
- The three distinct states (idle / loading / no-results) must survive. Adding a fourth case — "no results **for these filters**" — is welcome but must not collapse the existing three.

- [ ] **Steps 1-4: Failing test, fail, implement, pass**
- [ ] **Step 5: Commit** — `Add tag filtering to search results`

---

### Task 5: Exit check — this one closes v1

- [ ] **Step 1: Full loop from a cold start**

```bash
docker compose down -v && docker compose up -d && sleep 5
python3 scripts/pb-seed.py http://localhost:8090
pnpm nuxt prepare
pnpm lint && pnpm typecheck && pnpm test --hookTimeout=180000 && pnpm test:e2e
```

Green apart from the one known `offline.spec.ts:6` failure.

- [ ] **Step 2: Fixture exact after two consecutive e2e runs, no re-seed**

5 boxes, 9 items, **5 tags**, 2 comments, 1 permission row. The tag count is the one this slice puts at risk — inline creation makes new tags, and every one your tests make must be cleaned up.

- [ ] **Step 3: Walk the two criteria this slice closes and say plainly whether each is met**

- Criterion 8 — tag a box or item using an existing tag via autocomplete, **or** by creating one inline.
- Criterion 10 — filtering the box index **or search results** by a tag returns only matching boxes/items.

Name the test that proves each. If either is only partly met, say so rather than rounding up.

- [ ] **Step 4: Confirm nothing regressed**

`tests/e2e/boxes.spec.ts`, `searchIndexBar.spec.ts`, `search.spec.ts` and `tags.spec.ts` all still pass. Four slices have now edited the index page and the search page between them.

## Self-Review

**Spec coverage.** PRD §7.7 autocomplete against existing tags and inline creation → Task 2; zero or more tags per record → Task 2; index and search filter by one or more tags → Tasks 3 and 4; the search filter actually working → Task 1.

**Out of scope.** Anything in `/tags` itself — rename, delete and usage counts already ship and are tested. The tag *mutations*; they exist. Renaming propagation, which is already proven cross-entity.

**Known risk.** Two things are quiet failures rather than loud ones. Editing a record without touching its tags must not clear them, because the update payload diffs against the existing array — Task 2's third test exists only for that. And a tag created inline by a test will persist and break the five-tag invariant for every later run unless teardown removes it.
