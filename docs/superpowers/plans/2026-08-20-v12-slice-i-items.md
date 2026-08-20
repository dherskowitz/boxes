# Slice I — Items Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/items` — every item across every box, with free-text search and AND-matched tag filters.

**Architecture:** One query change and one page. `useItemList` and `itemFilter` already list items with tag filters and pagination; they just require a box id. Making that optional and adding a term serves both callers from one function.

**Spec:** `docs/superpowers/specs/2026-08-20-dashboard-and-items-design.md` §4
**Contract:** `docs/superpowers/interface-surface.md`
**Coordination:** `docs/superpowers/plans/2026-08-20-v12-overview.md`

## Global Constraints

- **pnpm** only. **Run every command in the foreground** — do not background anything, it is how agents hang on this project. Slow is expected. `pnpm test --hookTimeout=180000`, `pnpm nuxt prepare` before `pnpm typecheck`.
- **Done means** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` green, apart from the known `offline.spec.ts:6`.
- **No `any`**, no `as` to silence an error, no non-null `!`.
- **Never interpolate into a PocketBase filter string** — `$pb.filter(raw, params)`.
- Barebones styling; every `UAlert` needs a semantic `color`.
- **You own** `app/pages/items.vue`, `app/components/Item*`, `app/queries/items.ts`, `ItemListFilters` in `app/queries/keys.ts`, and your tests. Nothing else — the nav link is another slice's.
- Commits: no attribution footers, no `Co-Authored-By`, no emoji trailers.

---

### Task 1: Widen the item filter

**Files:** Modify `app/queries/keys.ts` (`ItemListFilters` only) and `app/queries/items.ts`. Test: `tests/nuxt/itemFilter.spec.ts`

**Produces:** `itemFilter` accepting an optional box and an optional term; `useItemList` without its box gate.

#### The trap: do not reuse `searchFilter`

`searchFilter` in `app/queries/search.ts` short-circuits a blank term to `{ raw: '1 = 2' }` — deliberately, so landing on an empty `/search` does not dump the whole database.

**`/items` has the opposite contract**: no term means *show everything*, paginated. Reusing that function would silently import the wrong default and `/items` would render empty forever with no error.

Duplicate the term clause instead, and put a comment at **both** sites pointing at the other so they stay in step.

- [ ] **Step 1: Write the failing tests**

Extend `tests/nuxt/itemFilter.spec.ts`, following the shape already there — it asserts on the template *and* pipes the result through a real `PocketBase#filter`.

```ts
it('filters to one box when given a box id', () => {
  const { raw, params } = itemFilter({ boxId: 'b1' })
  expect(raw).toContain('box = {:boxId}')
  expect(params.boxId).toBe('b1')
})

it('excludes archived boxes when browsing across boxes', () => {
  const { raw, params } = itemFilter({})
  expect(raw).toContain('box.status = {:status}')
  expect(params.status).toBe('active')
  expect(raw).not.toContain('box = {:boxId}')
})

it('matches a term against title, description and notes', () => {
  const { raw, params } = itemFilter({ term: 'peacoat' })
  expect(raw).toContain('title ~ {:term}')
  expect(raw).toContain('description ~ {:term}')
  expect(raw).toContain('notes ~ {:term}')
  expect(params.term).toBe('peacoat')
})

it('returns everything when no term is given — unlike searchFilter', () => {
  const { raw } = itemFilter({})
  expect(raw).not.toContain('1 = 2')
})

it('AND-matches every selected tag', () => {
  const { raw, params } = itemFilter({ tagIds: ['t1', 't2'] })
  expect(raw).toContain('tags ~ {:tag0}')
  expect(raw).toContain('tags ~ {:tag1}')
  expect(params.tag0).toBe('t1')
})

it('never lets a term or tag id reach raw', () => {
  const { raw } = itemFilter({ term: 'x" || id != "', tagIds: ['t" || 1=1'] })
  expect(raw).not.toContain('x"')
  expect(raw).not.toContain('t"')
})

it('trims a whitespace-only term rather than filtering on it', () => {
  expect(itemFilter({ term: '   ' }).raw).not.toContain('title ~')
})

it('combines a box id and a term without the archived clause', () => {
  const { raw } = itemFilter({ boxId: 'b1', term: 'coat' })
  expect(raw).toContain('box = {:boxId}')
  expect(raw).toContain('title ~ {:term}')
  expect(raw).not.toContain('box.status')
})
```

That last one matters: inside a box you are already scoped, and adding a status clause there would hide the items of an archived box from its own detail page.

- [ ] **Step 2: Run and watch them fail**
- [ ] **Step 3: Implement** — the spec §4.1 has the exact shape. **Keep** `useItemList`'s `enabled: computed(() => filters.value.boxId !== '')` gate — do not drop it. Box detail passes `box.value?.id ?? ''`, so an empty string means "still loading, do not query", while an absent `boxId` means `/items` and must query. Both are falsy; only the gate distinguishes them.
- [ ] **Step 4: Run the tests**
- [ ] **Step 5: Confirm box detail still works** — `pnpm test:e2e tests/e2e/boxDetail.spec.ts tests/e2e/itemDetail.spec.ts`. This change touches the query every box page uses.
- [ ] **Step 6: Commit** — `Let the item filter span boxes and match a term`

---

### Task 2: Show which box an item is in

**Files:** Modify `app/components/ItemCard.vue`

On `/items` a row is meaningless without its box — "Sorel snow boots" tells you nothing if you cannot see it is in "Winter coats and boots".

`useItemList` must `expand: 'box'`, and `ItemCard` needs an optional way to show the parent. Keep it **optional**: box detail already knows which box it is showing and must not start repeating it on every row.

- [ ] **Step 1: Write the failing test** — a component test asserting the box name renders when the prop is on and does not when it is off.
- [ ] **Steps 2-4: Fail, implement, pass**
- [ ] **Step 5: Confirm box detail is visually unchanged** — its rows must not gain a box name.
- [ ] **Step 6: Commit** — `Let an item card show which box it is in`

---

### Task 3: The page

**Files:** Create `app/pages/items.vue`, plus `app/components/Item*` helpers if useful.

Required:
- Debounced free-text search over title, description and notes.
- `TagFilter` chips, AND-matched.
- **Term and tags in the URL** (`/items?q=…&tags=…`), so a filtered view is linkable and survives a reload. Copy the pattern from `app/pages/search.vue` — it is the proven one.
- Paginated at `PER_PAGE`, newest first, `UPagination` when there is more than one page.
- Archived boxes' items excluded.
- **Four distinct states**: loading, empty ("no items yet"), no-matches ("nothing matches these filters"), error. Collapsing empty and no-matches tells someone with 400 items that they have none.

Do not add a box dropdown — declined in the spec.

- [ ] **Step 1: Write the failing e2e tests**

Use the seeded fixture. The headline is the notes-only match, the same property criterion 7 pins for `/search`: the peacoat's notes read "Dry clean before wearing" and that phrase appears in no title or description.

```ts
test('finds an item by a word that appears only in its notes', async ({ page }) => {
  await page.goto('/items?q=Dry%20clean')
  await expect(page.getByText('Navy wool peacoat')).toBeVisible()
})

test('shows which box each item is in', async ({ page }) => { /* ... */ })
test('narrows by tag, AND-matching two', async ({ page }) => { /* ... */ })
test('never lists an item from an archived box', async ({ page }) => { /* seedbox5 */ })
test('keeps the filter in the URL across a reload', async ({ page }) => { /* ... */ })
test('distinguishes no-items-yet from nothing-matches', async ({ page }) => { /* ... */ })
```

The archived test must not be vacuous. `seedbox5` is archived and holds "Graduation album 2011" — search for a word in that title and assert it does **not** appear. Without `box.status` in the filter it would.

- [ ] **Steps 2-4: Fail, implement, pass**
- [ ] **Step 5: Commit** — `Add the items page`

---

### Task 4: Exit check

- [ ] **Step 1: Full loop from a cold start**

```bash
docker compose down -v && docker compose up -d && sleep 5
pnpm seed && pnpm nuxt prepare
pnpm lint && pnpm typecheck && pnpm test --hookTimeout=180000 && pnpm test:e2e
```

- [ ] **Step 2: Fixture unchanged after two consecutive e2e runs, no re-seed** — 5 boxes, 9 items, 5 tags, 2 comments, 1 permission row. `/items` is read-only, so anything that moved means a test is writing when it should not.
- [ ] **Step 3: No unbound value reaches a filter**

```bash
grep -rnE 'filter[^a-z]*`[^`]*\$\{' app/queries/items.ts || echo "  clean"
```

- [ ] **Step 4: Ownership** — `git diff --name-only main...HEAD` shows only your files.
- [ ] **Step 5: Report the new `ItemListFilters` shape and `ItemCard`'s new prop.**

## Self-Review

**Spec coverage.** §4 search over three fields → Tasks 1 and 3; tag chips AND-matched → Tasks 1 and 3; parent box shown → Task 2; archived excluded → Task 1; URL-synced → Task 3; four states → Task 3; §4.1 query change → Task 1.

**Out of scope.** The nav link (another slice owns the layout), a box dropdown, archived items, and anything on `/` or `/reports`.

**Known risk.** Task 1 changes the query behind **every box detail page**. The `enabled` gate exists today; removing it is safe only because box detail always passes a box id. Step 5 of Task 1 verifies that rather than assuming it.
