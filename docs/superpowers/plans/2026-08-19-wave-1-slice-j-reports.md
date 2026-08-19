# Slice J — Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only `/reports` screen showing the shape of the collection at a glance — totals, which boxes are crowded, where boxes live, which tags are used, and how the collection has grown.

**Architecture:** Every figure comes from one of four PocketBase **view collections** built in wave 0. Aggregation happens in SQL; the screen fetches tens of rows, never the underlying records. This slice is entirely additive — one route, one query module, and chart components — and touches nothing another slice owns.

**Tech Stack:** Nuxt 4 SPA, Nuxt UI 4, `nuxt-charts` (vue-chrts / Unovis), PocketBase 0.39.11, `@peterbud/nuxt-query`, Vitest, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-19-storage-app-v1-design.md` (§7.10 is the specification for this screen)
**Contract:** `docs/superpowers/wave-0-interface-surface.md` — read first; it lists every view collection's columns and field types.
**Coordination:** `docs/superpowers/plans/2026-08-19-wave-1-overview.md`

## Global Constraints

- Package manager is **pnpm**. Never npm or yarn. **Do not add a dependency** — `nuxt-charts` is already installed and registered in `nuxt.config.ts`.
- **Done means** `pnpm lint && pnpm test && pnpm test:e2e` green in your worktree. TDD: failing test first. Never `.skip`/`.only`, never weaken a test. E2E is flaky under machine load — re-run before concluding red.
- **No `any`**, no `as` to silence an error, no non-null `!`.
- Nuxt auto-imports are on. `import type` IS required.
- **All reads go through nuxt-query.** Never call `pb.collection().…` from a component.
- **Barebones styling.** Nuxt UI defaults, layout primitives only. No colour classes, no custom CSS. **Charts are the one place colour is unavoidable** — a chart with no series colours is unreadable. Use `nuxt-charts`' own defaults rather than choosing a palette; if a series must be coloured explicitly, use the tag's stored `color` value (that is data). Do not introduce a design system.
- Surface failures through `pbError(e)`.
- Commits: no attribution footers, no emoji trailers.
- **You own** `app/pages/reports.vue`, `app/components/Report*`, and all of `app/queries/reports.ts` (currently an empty stub). Nothing else. The `/reports` nav link already exists in the layout — do not edit it.

## The two rules that define this screen

**1. Aggregate in PocketBase, never in the browser.** Each chart reads one view collection returning tens of rows. Do not fetch `storage_items` or `storage_boxes` and reduce client-side — the views exist precisely to prevent that, and it would not survive a real collection. The one permitted exception is grouping the locations donut from `storage_report_box_fill` rows, which the spec explicitly allows because it is already a per-box list of tens of rows.

**2. The screen is online-only.** Unlike the rest of v1, it shows a needs-connection state offline rather than stale or partial figures. A stale total is not a smaller truth, it is a wrong number presented with authority. Slice D owns `useOnline()`; if it is not in your worktree yet, say so in your report and gate on it once merged rather than inventing a second online signal.

## What the seeded fixture will show

Useful to know while building, and it is what your tests assert against:

- 5 boxes (4 active, `seedbox5` archived), 9 items, 5 tags, 0 photos — the seed uploads no images.
- `seedbox4` has no items; `seedbox5` is archived with 1 item.
- Locations: "Garage shelf A3", "Basement under the stairs", "Office closet, top shelf", "Garage shelf B1", "Attic".

Note **photo_count is 0 across the board.** That makes the photos tile a real empty-state case in normal development — do not treat 0 as a bug.

---

### Task 1: Report queries

**Files:**
- Modify: `app/queries/reports.ts` (replace the stub)
- Test: `tests/nuxt/reports.spec.ts`

**Interfaces:**
- Consumes: `keys.reports.*`, `ReportBoxFill`, `ReportTagUsage`, `ReportGrowth`.
- Produces: `useBoxFill()`, `useTagUsage()`, `useGrowth()`, plus pure helpers `groupByLocation()`, `topBoxesByItems()`, `topTagsByUsage()`, `reportTotals()`.

All three queries use `getFullList` — correct here for the same reason as `useTags()`: a view returning one row per box, per tag, or per month is bounded and every consumer needs all of it. Key them with `keys.reports.boxFill()` / `tagUsage()` / `growth()`.

Note slice B also reads `storage_report_tag_usage` for the `/tags` screen. That is not a conflict: same query key means one shared cache entry. Do not coordinate; just use the key.

The four helpers are pure so the screen's logic is testable without a browser or a PocketBase instance. That is where the real thinking lives — the components are then mostly markup.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { groupByLocation, reportTotals, topBoxesByItems, topTagsByUsage } from '~/queries/reports'
import type { ReportBoxFill, ReportTagUsage } from '~/types/pocketbase'

const fill: ReportBoxFill[] = [
  { id: 'b1', title: 'Winter coats and boots', location: 'Garage shelf A3', status: 'active', item_count: 3, photo_count: 0 },
  { id: 'b2', title: 'Kitchen overflow', location: 'Basement under the stairs', status: 'active', item_count: 2, photo_count: 0 },
  { id: 'b3', title: 'Tax records 2019-2023', location: 'Office closet, top shelf', status: 'active', item_count: 3, photo_count: 0 },
  { id: 'b4', title: 'Empty spare box', location: 'Garage shelf B1', status: 'active', item_count: 0, photo_count: 0 },
  { id: 'b5', title: 'College photo albums', location: 'Attic', status: 'archived', item_count: 1, photo_count: 0 }
]

describe('topBoxesByItems', () => {
  it('ranks by item count, descending', () => {
    expect(topBoxesByItems(fill, 10).map(b => b.id)).toEqual(['b1', 'b3', 'b2', 'b4'])
  })

  it('excludes archived boxes from the ranking, per the spec', () => {
    expect(topBoxesByItems(fill, 10).some(b => b.id === 'b5')).toBe(false)
  })

  it('caps at the requested size', () => {
    expect(topBoxesByItems(fill, 2)).toHaveLength(2)
  })

  it('handles the report still loading', () => {
    expect(topBoxesByItems(undefined, 10)).toEqual([])
  })
})

describe('groupByLocation', () => {
  it('counts boxes per location', () => {
    const groups = groupByLocation(fill)
    expect(groups.find(g => g.location === 'Garage shelf A3')?.count).toBe(1)
    expect(groups).toHaveLength(5)
  })

  it('buckets boxes with no location rather than dropping them', () => {
    const withBlank = [...fill, { ...fill[0], id: 'b6', location: '' }]
    expect(groupByLocation(withBlank).find(g => g.location === 'No location')?.count).toBe(1)
  })

  it('handles the report still loading', () => {
    expect(groupByLocation(undefined)).toEqual([])
  })
})

describe('topTagsByUsage', () => {
  it('ranks by combined box and item usage', () => {
    const tags: ReportTagUsage[] = [
      { id: 't1', name: 'winter', color: '', box_count: 1, item_count: 2 },
      { id: 't2', name: 'fragile', color: '', box_count: 2, item_count: 1 },
      { id: 't3', name: 'paperwork', color: '', box_count: 1, item_count: 3 }
    ]
    expect(topTagsByUsage(tags, 10).map(t => t.id)).toEqual(['t3', 't1', 't2'])
  })
})

describe('reportTotals', () => {
  it('counts boxes, items, tags and photos, including archived boxes', () => {
    const tags: ReportTagUsage[] = [
      { id: 't1', name: 'winter', color: '', box_count: 1, item_count: 2 }
    ]
    expect(reportTotals(fill, tags)).toEqual({ boxes: 5, items: 9, tags: 1, photos: 0 })
  })

  it('reports zeroes on a fresh instance rather than throwing', () => {
    expect(reportTotals([], [])).toEqual({ boxes: 0, items: 0, tags: 0, photos: 0 })
  })

  it('handles both reports still loading', () => {
    expect(reportTotals(undefined, undefined)).toEqual({ boxes: 0, items: 0, tags: 0, photos: 0 })
  })
})
```

Note the deliberate asymmetry, straight from the spec: **archived boxes are included in the totals but excluded from the items-per-box ranking.** Two functions over the same data with different rules is exactly the kind of thing that gets silently unified later — the tests pin both.

`topTagsByUsage` ties: `winter` (3) and `fragile` (3) both total 3, and the expected order puts `winter` first. Make the sort deterministic — break ties by name — or the test is flaky. Decide and encode it.

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm test tests/nuxt/reports.spec.ts`
Expected: FAIL — the module is an empty stub.

- [ ] **Step 3: Implement**

Keep the doc comment already in `reports.ts` about aggregating in PocketBase — it states the convention at the place someone would otherwise break it.

- [ ] **Step 4: Run and watch it pass** — 13 tests.

- [ ] **Step 5: Commit**

```bash
git add app/queries/reports.ts tests/nuxt/reports.spec.ts
git commit -m "Add report queries and aggregation helpers"
```

---

### Task 2: Totals tiles

**Files:**
- Create: `app/pages/reports.vue`, `app/components/ReportTotals.vue`

Spec §7.10 item 1: boxes, items, tags, photos, as **stat tiles, not charts**. Four numbers do not need a visualisation.

Also in this task, the page scaffolding every later task hangs off:
- **Loading state** — `data-testid="reports-loading"`.
- **Error state** via `pbError`.
- **Offline state** — `data-testid="reports-offline"`, replacing the whole screen rather than showing partial figures. Gate on slice D's `useOnline()`; if unavailable in your worktree, note it and use `navigator.onLine` directly with a `TODO` naming the swap, then say so in your report.
- Available to any enabled member. No per-user or per-box scoping — every member can already see every box.

- [ ] **Step 1: Write the failing e2e test**

```ts
import { expect, test } from '@playwright/test'

test.use({ storageState: 'tests/e2e/.auth/rae.json' })

test('shows collection totals to any member', async ({ page }) => {
  await page.goto('/reports')
  await expect(page.getByTestId('total-boxes')).toHaveText('5')
  await expect(page.getByTestId('total-items')).toHaveText('9')
  await expect(page.getByTestId('total-tags')).toHaveText('5')
  // The seed uploads no images — zero is correct, not a bug.
  await expect(page.getByTestId('total-photos')).toHaveText('0')
})
```

Asserting as `rae` (a plain read-only member) proves the no-scoping requirement rather than assuming it.

- [ ] **Steps 2-4: Fail, implement, pass**

- [ ] **Step 5: Commit**

```bash
git add app/pages/reports.vue app/components/ReportTotals.vue tests/e2e/reports.spec.ts
git commit -m "Add reports page scaffolding and totals tiles"
```

---

### Task 3: Items-per-box and tag-usage bars

**Files:**
- Create: `app/components/ReportItemsPerBox.vue`, `app/components/ReportTagUsage.vue`

Spec §7.10 items 2 and 4. Both are horizontal bars, top 10.

- Items per box answers "which boxes are crowded". Archived boxes are excluded from this ranking.
- Tag usage ranks by combined `box_count + item_count`.
- **Every chart has an explicit empty state.** A fresh instance has zero of everything, and an empty chart reads as broken rather than empty. `data-testid="items-per-box-empty"` and `data-testid="tag-usage-empty"`.
- Charts are **not links** — no drill-through in v1.1.

Long box titles will break a bar chart's axis: the seeded `seedbox2` title is 96 characters. Truncate the label and keep the full title in a tooltip or `title` attribute. Do not let the fixture's realistic data produce an unreadable chart — that is exactly why the seed has a long title.

- [ ] **Step 1: Write the failing e2e test**

Assert the crowded boxes appear in rank order, that the archived box does **not** appear, and that a long title is truncated rather than overflowing.

- [ ] **Steps 2-4: Fail, implement, pass**

- [ ] **Step 5: Commit**

```bash
git add app/components/ReportItemsPerBox.vue app/components/ReportTagUsage.vue tests/e2e/reports.spec.ts
git commit -m "Add items-per-box and tag-usage charts"
```

---

### Task 4: Locations donut and growth area chart

**Files:**
- Create: `app/components/ReportLocations.vue`, `app/components/ReportGrowth.vue`

Spec §7.10 items 3 and 5.

- **Locations** is a donut grouped from `storage_report_box_fill` in the browser — the one permitted client-side grouping, because it is already tens of rows. Boxes with no location must be bucketed visibly ("No location"), not dropped: a donut that silently omits records misrepresents the total.
- **Growth** is an area chart of boxes and items created per month, from `storage_report_growth`. The view already returns rows ordered by month ascending — do not re-sort.
- **Archived boxes are included but visually distinguished** in the status split. Decide how (a separate segment or series) and state it.
- Explicit empty states for both.

Growth has a specific trap: the seeded data was all created on one day, so the chart will have exactly **one** data point. An area chart with a single point renders as nothing in most libraries. Handle it — either render a bar for a single period or show a "not enough history yet" state. Do not ship a chart that is blank on the fixture and only looks right in theory.

- [ ] **Step 1: Write the failing e2e test**

Assert the donut shows the seeded locations, and that the single-month growth case renders something visible rather than an empty frame.

- [ ] **Steps 2-4: Fail, implement, pass**

- [ ] **Step 5: Commit**

```bash
git add app/components/ReportLocations.vue app/components/ReportGrowth.vue tests/e2e/reports.spec.ts
git commit -m "Add locations donut and growth chart"
```

---

### Task 5: Prove the empty and offline states

**Files:**
- Test only: `tests/e2e/reports.spec.ts`

The empty states are the most likely thing to be written and never exercised, because the seeded fixture always has data. The spec calls them out explicitly because a fresh instance has zero of everything.

- [ ] **Step 1: Test every chart's empty state against a genuinely empty instance**

The honest way is a cold instance with **no** seed:

```bash
docker compose down -v && docker compose up -d
# deliberately do NOT run pb-seed.py
```

You still need a logged-in member to view the page, so seed only the users. Add a `--users-only` flag to `scripts/pb-seed.py`… **no — you do not own that script.** Instead, create the user and membership inline from the test's setup via the superuser API, or run the test against a tag filter that matches nothing.

Choose an approach, implement it, and **state clearly in your report what you did and why**. If you conclude the empty state cannot be tested without touching a file you do not own, say that plainly rather than skipping the coverage silently — it becomes a note for the merge step.

- [ ] **Step 2: Test the offline state**

```ts
test('shows a needs-connection state offline rather than stale figures', async ({ page, context }) => {
  await page.goto('/reports')
  await expect(page.getByTestId('total-boxes')).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByTestId('reports-offline')).toBeVisible()
  await expect(page.getByTestId('total-boxes')).toBeHidden()
  await context.setOffline(false)
})
```

The second assertion is the important one: partial or stale aggregates must **not** be shown. Visible-offline-state plus visible-stale-numbers would pass a weaker test and be exactly the failure the spec forbids.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/reports.spec.ts
git commit -m "Add empty-state and offline coverage for reports"
```

---

### Task 6: Slice exit check

**Files:** none.

- [ ] **Step 1: Full loop from a cold start**

```bash
docker compose down -v && docker compose up -d
sleep 5
python3 scripts/pb-seed.py http://localhost:8090
pnpm lint && pnpm test && pnpm test:e2e
```

- [ ] **Step 2: Confirm you aggregated in the right place**

```bash
grep -rn "storage_items\|storage_boxes" app/queries/reports.ts app/components/Report*
```

Expected: **no matches.** Every figure must come from a `storage_report_*` view. A hit here means the screen is reducing raw records client-side, which is the one thing the spec forbids outright.

- [ ] **Step 3: Confirm you stayed inside your ownership**

```bash
git diff --name-only main...HEAD
```

Only `app/pages/reports.vue`, `app/components/Report*`, `app/queries/reports.ts`, and your tests.

- [ ] **Step 4: Report**

State which empty states you proved and how, whether you gated on slice D's `useOnline()` or a temporary fallback, and how you handled the single-data-point growth chart.

## Self-Review

**Spec coverage.** §7.10 totals tiles → Task 2; items-per-box top 10 excluding archived → Tasks 1 and 3; locations donut grouped client-side → Tasks 1 and 4; tag usage top 10 by combined count → Tasks 1 and 3; growth area chart → Task 4; explicit empty state per chart → Tasks 3, 4 and 5; online-only with needs-connection state → Tasks 2 and 5; archived included but distinguished → Tasks 1 and 4; no export, no date range, no drill-through → not built, by design.

**Deliberately out of scope.** Any drill-through from a chart to a box or item — the spec says charts are not links in v1.1. Any date-range picker or export.

**Known risk.** Two of this screen's requirements are invisible on the seeded fixture: every empty state (the seed always has data) and the growth chart (the seed produces one month). Both will look fine in development and wrong on a real instance. Tasks 4 and 5 exist specifically to force them to be exercised rather than assumed.

**Dependency.** The offline gate needs slice D's `useOnline()`. D is running in parallel, so it may not be present. The fallback is stated in Task 2 — take it, flag it, and do not invent a second online-detection mechanism that later has to be reconciled.
