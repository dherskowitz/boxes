# Slice G — Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Find things fast. Closes PRD acceptance criterion 7 — "searching a term that appears only in an item's notes returns that item" — and the search half of criterion 12, that archived boxes are excluded from search.

**Architecture:** One route, one query module, and a search bar on the index. Search spans two collections (`storage_boxes` and `storage_items`) with no server-side join, so it issues two filtered queries and presents the results as one list that distinguishes the two kinds.

**Tech Stack:** Nuxt 4 SPA, Nuxt UI 4, PocketBase 0.39.11, `@peterbud/nuxt-query`, Vitest, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-19-storage-app-v1-design.md`
**Contract:** `docs/superpowers/interface-surface.md` — read first, then `wave-0-interface-surface.md`.
**Coordination:** `docs/superpowers/plans/2026-08-19-wave-2-overview.md`

## Global Constraints

- **pnpm** only. **Done means** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all green. TDD: failing test first.
- **No `any`**, no `as` to silence an error, no non-null `!`.
- **All reads go through nuxt-query.** `import type` for types IS required.
- **Barebones styling.** Nuxt UI defaults, layout primitives only. No colour classes, no custom CSS.
- Loading, empty, and no-results states are three different things — see below.
- Surface failures through `pbError(e)`.
- **Never interpolate into a filter string.** `$pb.filter(raw, params)` — this slice is the one where a user's raw text reaches a query, so it matters most here.
- **Paginate.** Never fetch an unbounded list to filter client-side.
- Commits: no attribution footers, no emoji trailers.
- **You own** `app/pages/search.vue`, `app/components/Search*`, `app/queries/search.ts` (new), and **the search bar only** in `app/pages/index.vue`. You may export only `useSearch`, `searchFilter`, `SearchResult`.

## The security point, and why it lives here

Every other slice filters on ids it controls. **This one puts user-typed text into a PocketBase filter.** Wave 0 shipped an injection on the `qr_id` path — a value broke out of its quotes and rewrote the query — and the fix was to bind values as parameters via `$pb.filter(raw, params)` rather than escape them.

Follow that exactly. `boxFilter` in `app/queries/boxes.ts` is the model: it returns `{ raw, params }` where `raw` contains only `{:placeholders}` and never a user value, and `tests/nuxt/boxFilter.spec.ts` asserts precisely that. Copy both the shape and its tests.

Two things to know that bit earlier slices:
- `~` wraps a value in `%…%` only when the value contains no `%` of its own, so a term containing `%` silently changes match semantics. Not injection, but worth a comment.
- `description` and `notes` are `editor` (HTML) fields. Searching `div` or `href` will match markup, and a match can be invisible in the rendered text. Acceptable for v1 — but say so in a comment rather than letting the next reader think it is a bug.

## What the PRD actually asks for

§7.6, precisely:
- Search across **box titles, item titles, item descriptions, and item notes**. Note box *descriptions* are not in that list; do not widen the scope.
- Results **distinguish boxes from items** and link to the right detail page.
- **Archived boxes and their items are excluded by default.**

That last one is the subtle one. An item has no `status` of its own — it inherits exclusion from its box. Filtering items by their parent's status needs `box.status = {:status}` in the filter, which PocketBase supports through the relation.

---

### Task 1: The search query

**Files:** Create `app/queries/search.ts`. Test: `tests/nuxt/searchFilter.spec.ts`

**Produces:** `searchFilter(term, opts)` → `PbFilter`, `useSearch(filters)`, `interface SearchResult`.

`SearchResult` should be a discriminated union — something like `{ kind: 'box', box: StorageBox } | { kind: 'item', item: StorageItem }` — so the page cannot render an item as a box by accident, and so a later slice can add tag filtering without reshaping it.

- [ ] **Step 1: Write the failing test**

Model it on `tests/nuxt/boxFilter.spec.ts`. The two assertions that matter:

```ts
it('never interpolates a user value into raw — raw is placeholders only', () => {
  const { raw } = searchFilter('x" || id != "', { kind: 'item' })
  expect(raw).not.toContain('x"')
  expect(raw).not.toContain('||' + ' id != ')   // the injected clause, not our own ORs
})

it('passes the term through to params intact, quotes and all', () => {
  const { params } = searchFilter('a" quoted phrase', { kind: 'item' })
  expect(Object.values(params)).toContain('a" quoted phrase')
})
```

Plus: items match on title, description **and** notes; boxes match on title only; archived boxes excluded by default; items whose box is archived excluded by default; and an empty term returns no filter rather than matching everything.

That last case matters — an empty search that returns the entire database is a performance bug and a bad screen.

- [ ] **Step 2: Run and watch it fail**
- [ ] **Step 3: Implement**

`useSearch` runs two paginated queries (boxes and items) and returns them combined. Use `keys.search.query(filters)` — it already exists and is unused. Items should `expand: 'box'` so a result can show which box it lives in, which is the single most useful thing about an item result.

Gate the query on a non-empty term so landing on `/search` does not fire a request.

- [ ] **Step 4: Run the test**
- [ ] **Step 5: Commit** — `Add the cross-collection search query`

---

### Task 2: The search page

**Files:** Create `app/pages/search.vue`, plus `app/components/Search*`.

Required behaviour:
- Read the term from the URL (`/search?q=…`) so a search is linkable and survives a reload.
- Results visibly distinguish boxes from items; each links to its detail page. An item result shows its parent box.
- **Three distinct states**, and they are not the same thing:
  - `data-testid="search-idle"` — no term entered yet
  - `data-testid="search-loading"` — querying
  - `data-testid="search-no-results"` — searched, found nothing
  A single "no results" for all three reads as broken when you have not typed anything.
- Debounce input so a query does not fire per keystroke.
- The nav already links to `/search`; do not edit the layout.

Leave room for wave 3 to add tag filter chips — build the filter shape so chips can be added without restructuring — but **do not add them**. They belong to wave 3 because they also touch the box index.

- [ ] **Step 1: Write the failing e2e test**

The headline criterion is very specific: a term that appears **only in an item's notes**. The fixture has exactly that — the peacoat's notes say *"Dry clean before wearing"*, and "Dry clean" appears in no title or description.

```ts
test('finds an item by a word that appears only in its notes', async ({ page }) => {
  await page.goto('/search?q=Dry%20clean')
  await expect(page.getByText('Navy wool peacoat')).toBeVisible()
})
```

Also cover: a box found by title; archived `seedbox5` ("College photo albums") **not** returned; its item not returned either; the idle state before typing; and a nonsense term giving no-results rather than an error.

- [ ] **Steps 2-4: Fail, implement, pass**
- [ ] **Step 5: Commit** — `Add the search page`

---

### Task 3: The index search bar

**Files:** Modify `app/pages/index.vue` — **the search bar only.**

A field on the box index that navigates to `/search?q=…`. Do not reimplement results inline; the index stays a box list.

`app/pages/index.vue` belongs to nobody now that slice A has merged, but slice A's tests assert on it. Add your bar and change nothing else, then run the existing `tests/e2e/boxes.spec.ts` and confirm it still passes.

- [ ] **Step 1: Write the failing e2e test** — type a term on `/`, submit, land on `/search?q=…` with results.
- [ ] **Steps 2-3: Implement, pass, and re-run `boxes.spec.ts`**
- [ ] **Step 4: Commit** — `Add a search bar to the box index`

---

### Task 4: Slice exit check

- [ ] **Step 1: Full loop from a cold start** (down -v, up, seed, all four commands).
- [ ] **Step 2: Fixture unchanged.** Search is read-only, so nothing should change — run e2e twice and confirm 5 boxes, 9 items, 5 tags. If anything moved, a test is writing when it should not.
- [ ] **Step 3: Ownership.** `git diff --name-only main...HEAD` — `app/pages/search.vue`, `Search*`, `app/queries/search.ts`, your tests, and `app/pages/index.vue` with only a search bar added.
- [ ] **Step 4: Confirm no unbound value reaches a filter.**

```bash
grep -rnE 'filter[^a-z]*`[^`]*\$\{' app/queries/search.ts || echo "  clean"
```

Expected: no matches. Every value must go through `$pb.filter(raw, params)`.

- [ ] **Step 5: Report the interfaces you produced**, especially `SearchResult`'s shape — wave 3 adds tag chips on top of it.

## Self-Review

**Spec coverage.** PRD §7.6 search across box titles, item titles, descriptions and notes → Task 1; results distinguish boxes from items and link correctly → Task 2; archived excluded by default → Tasks 1 and 2; acceptance criterion 7 (notes-only match) → Task 2's headline test; criterion 12's search half → Task 2.

**Out of scope.** Tag filter chips (wave 3 — they also touch the box index). Any change to how boxes or items are fetched elsewhere; `boxFilter` and `itemFilter` are not yours.

**Known risk.** Excluding items whose *parent box* is archived is the requirement most likely to be missed, because an item has no status of its own. Test it explicitly with `seedbox5`'s item, not just with the archived box itself.
