# Slice D — Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/` a dashboard — stats, one chart, recent boxes — move the box index to `/boxes`, and switch both reporting surfaces from offline-blocked to stale-with-a-notice.

**Architecture:** No new data layer. Every figure comes from the same `useBoxFill` / `useTagUsage` / `useGrowth` and pure helpers `/reports` already uses. The work is one new page, one file move, one behaviour change, and retargeting fifteen assertions.

**Spec:** `docs/superpowers/specs/2026-08-20-dashboard-and-items-design.md` §2, §3, §5
**Contract:** `docs/superpowers/interface-surface.md`
**Coordination:** `docs/superpowers/plans/2026-08-20-v12-overview.md`

## Global Constraints

- **pnpm** only. **Run every command in the foreground** — do not background anything, it is how agents hang here. Slow is expected. `pnpm test --hookTimeout=180000`, `pnpm nuxt prepare` before `pnpm typecheck`.
- **Done means** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` green, apart from the known `offline.spec.ts:6`.
- **No `any`**, no `as` to silence an error, no non-null `!`.
- Barebones styling; **every `UAlert` needs a semantic `color`** — all 38 in the app have one, and a new one without it renders in the primary colour, which is green.
- **You own** `app/pages/index.vue`, `app/pages/boxes.vue`, `app/pages/reports.vue`, `app/components/Dashboard*`, `app/layouts/default.vue`, and the retargeted assertions in `boxes.spec.ts`, `boxDetail.spec.ts`, `tagFilter.spec.ts`, `searchIndexBar.spec.ts`, `auth.spec.ts`.
- **Never assert an absolute count on a global aggregate** — derive expected numbers from the API. `/reports`'s totals test already had to learn this.
- Commits: no attribution footers, no `Co-Authored-By`, no emoji trailers.

## The decision behind this slice

PRD §7.10 made reporting **online-only**, on the reasoning that a stale total presented with authority is worse than no total. Making `/` a dashboard put that against PRD §10 criterion 11, which promises the app opens offline.

The user resolved it: **cache the aggregates and show them stale with a notice.** §7.10 is amended, not worked around. Do not reintroduce an offline block.

Conveniently, the service worker's `storage_[^/]+` pattern **already caches the report views** — a reviewer once flagged that as something `/reports` had to defend against. So this is a deletion, not an addition.

---

### Task 1: Move the box index to `/boxes`

Do this **first and alone**, so the move is one reviewable commit and any breakage is unambiguous.

**Files:** `git mv app/pages/index.vue app/pages/boxes.vue`; update `app/layouts/default.vue`; retarget assertions in five spec files.

- [ ] **Step 1: Move the file with git**

```bash
git mv app/pages/index.vue app/pages/boxes.vue
```

Use `git mv` so history follows. Change nothing inside it.

- [ ] **Step 2: Update the nav — add every link now**

`app/layouts/default.vue`'s `links` becomes Dashboard `/`, Boxes `/boxes`, Items `/items`, Search `/search`, Tags `/tags`, Reports `/reports`.

**Include Items even though `/items` does not exist on your branch.** Another slice is building it concurrently and this file is yours; two slices editing one nav is the conflict the ownership map exists to prevent. Until that slice merges the link resolves to nothing, which is expected and temporary. Do not create a placeholder page for it.

- [ ] **Step 3: Retarget the assertions**

There are exactly **15** `page.goto('/')` calls across `boxes.spec.ts`, `boxDetail.spec.ts`, `tagFilter.spec.ts`, `searchIndexBar.spec.ts` and `auth.spec.ts`.

Read each one and decide what it actually meant:
- **"the box index"** → `/boxes`
- **"the app's landing page after login"** → stays `/`, and by Task 2 that is the dashboard

`auth.spec.ts` is where this matters most: its redirect tests are about landing *somewhere authenticated*, not about the box list. Retargeting those to `/boxes` would quietly stop testing the redirect. Judge each, do not sed the file.

- [ ] **Step 4: Verify**

`pnpm test:e2e` — everything passes except the known offline one. At this point `/` has no page, so any test still pointing there fails loudly. That is the good outcome; a test that passes while asserting the wrong page is the bad one.

- [ ] **Step 5: Commit** — `Move the box index to /boxes`

---

### Task 2: Reporting shows stale figures instead of blocking

**Files:** `app/pages/reports.vue`, and `tests/e2e/reports.spec.ts`

Today `reports.vue` holds `const isOnline = ref(navigator.onLine)` and a `v-if="!isOnline"` block with `data-testid="reports-offline"` that replaces the whole screen.

Required:
- Delete the offline block. Figures render from cache when offline.
- Add a **staleness notice** — `data-testid="reports-stale"` — shown when **offline *and* the query has data**, i.e. what is on screen came from cache. Not unconditional: a notice that is always there is one people stop reading.
- Offline with **no** cached data shows the existing empty/error state, not the notice. There is nothing stale to warn about; there is nothing.
- Use `useOnline()` from `app/composables/useOnline.ts` rather than reading `navigator.onLine` directly — it exists and is the reactive signal.

`tests/e2e/reports.spec.ts` has a test asserting the offline block replaces the figures. That behaviour is deliberately being removed; rewrite it to assert the new contract — offline, the notice appears **and the figures are still visible**. Do not delete the test.

- [ ] **Steps 1-4: Failing test, fail, implement, pass**
- [ ] **Step 5: Commit** — `Show stale reporting figures offline instead of blocking`

---

### Task 3: The dashboard

**Files:** Create `app/pages/index.vue`, plus `app/components/Dashboard*`.

Blocks, top to bottom:

1. **Stat tiles** — boxes, items, tags, photos, from `reportTotals()`. Tiles, not charts; four numbers do not need a visualisation.
2. **Items per box, top 5** — `topBoxesByItems()`, the same component `/reports` uses if it fits, or a thin wrapper. Chosen over growth because it is the most actionable of the five.
3. **Recent boxes** — `useBoxList()`, newest first, **six shown**. This is what makes the offline front door useful rather than a wall of stale numbers.
4. **Actions** — search bar, New box, Print sheet.
5. **A link to `/reports`** for the full picture.

Offline: the aggregate block (1 and 2) carries the same staleness notice as Task 2. **Recent boxes are not covered by it** — a cached box list is the offline read v1 already promises and needs no apology.

Reuse `/reports`'s components and helpers. If a figure ever differs between the two screens that is a bug, not a design.

- [ ] **Step 1: Write the failing e2e tests**

```ts
test('shows totals, a chart and recent boxes', async ({ page }) => { /* ... */ })
test('links to the full reports screen', async ({ page }) => { /* ... */ })

test('offline, warns the figures are stale but still lists boxes', async ({ page, context }) => {
  await page.goto('/')                       // prime the cache
  await expect(page.getByTestId('total-boxes')).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByTestId('dashboard-stale')).toBeVisible()
  await expect(page.getByText('Winter coats and boots')).toBeVisible()   // the point
  await context.setOffline(false)
})
```

That last assertion **is** the offline decision. Do not soften it to only checking the notice appears — that would pass while the front door was broken.

**Derive the expected totals from the API**, do not hardcode 5/9/5. `/reports`'s totals test had to adopt exactly this after another spec's boxes changed the counts underneath it.

The recent-boxes block shows six; the fixture has five. Assert against what the fixture actually holds.

- [ ] **Steps 2-4: Fail, implement, pass**
- [ ] **Step 5: Screenshot `/` at Pixel 7 width** and look at it — online and offline. `CLAUDE.md` requires it, and a dashboard is the screen most likely to overflow a narrow viewport.
- [ ] **Step 6: Commit** — `Add the dashboard at /`

---

### Task 4: Update the PRD to v1.2

**Files:** `docs/storage-app-prd.md`

The PRD is the product record and must not contradict the code. Spec §7 lists the amendments:

- **§7.10** — replace the online-only rule. Figures are served from cache offline with a staleness notice. **Keep the original reasoning** — that partial aggregates mislead — as the justification for why the notice is required rather than optional.
- **§9 route table** — `/` is the dashboard, `/boxes` the box index, `/items` added, `/reports` stays.
- **New §7.11 Dashboard** and **§7.12 Items**.
- **§10 criterion 11** — unchanged in substance, but say explicitly that opening `/` offline shows cached boxes, not an error.

Describe `/items` in the route table and §7.12 even though another slice builds it — the PRD describes the product, not your branch.

- [ ] **Step 1: Amend** — [ ] **Step 2: Commit** — `Update the PRD for v1.2`

---

### Task 5: Exit check

- [ ] **Step 1: Full loop from a cold start**

```bash
docker compose down -v && docker compose up -d && sleep 5
pnpm seed && pnpm nuxt prepare
pnpm lint && pnpm typecheck && pnpm test --hookTimeout=180000 && pnpm test:e2e
```

- [ ] **Step 2: Fixture unchanged after two consecutive runs** — 5 boxes, 9 items, 5 tags, 2 comments, 1 permission row.
- [ ] **Step 3: No route is publicly reachable.** `/` is now the default page; confirm signing out and visiting `/` still lands on `/login?redirect=/`. The dashboard must not have become an exception.
- [ ] **Step 4: Ownership** — `git diff --name-only main...HEAD` shows only your files.
- [ ] **Step 5: Report** which of the 15 assertions you retargeted to `/boxes` and which you deliberately left on `/`, with the reason.

## Self-Review

**Spec coverage.** §2 offline decision → Tasks 2 and 3; §3 dashboard blocks → Task 3; §5 index move and nav → Task 1; §7 PRD amendments → Task 4.

**Out of scope.** `/items` itself, `app/queries/items.ts`, and `ItemCard` — another slice owns all three. You add only the nav link.

**Known risk.** Task 1 is the risky one, and it is not technically hard: fifteen assertions, five files, four slices' worth of prior edits. The failure mode is not a red test — it is an assertion retargeted to `/boxes` that *should* have stayed on `/`, which then silently stops testing the redirect it was written for. Read each one.
