# Design: Dashboard and Items (v1.2)

Date: 2026-08-20
Status: approved, ready for implementation planning
Builds on: `docs/superpowers/specs/2026-08-19-storage-app-v1-design.md` (v1, shipped)
Contract: `docs/superpowers/interface-surface.md`

## 1. Scope

Two features:

1. **A dashboard at `/`** — stats, one chart, and recent boxes. Becomes the app's default page.
2. **`/items`** — every item across every box, with free-text search and tag filters.

The existing box index moves to `/boxes` unchanged. `/reports` keeps all five of its
blocks and stays.

## 2. The PRD conflict, and how it was resolved

PRD §7.10 says the reporting screen is **online-only**: offline it must show a
needs-connection state rather than stale or partial figures, on the reasoning that
a wrong total presented with authority is worse than no total. PRD §10 criterion 11
promises the app opens offline.

Making `/` a dashboard puts those two in direct conflict — the app's front door
would break in airplane mode, which is the guarantee v1 protected through four waves.

**Decision (the user's, made with the conflict stated): cache the aggregates and
show them stale with a warning.** §7.10's online-only rule is amended, not worked
around. This spec treats that as settled; the PRD is updated to match in §7 below,
so the documents do not contradict the code.

Two consequences:

- **`/reports` changes too.** It currently gates itself offline. It moves to the same
  stale-with-warning treatment, so the two reporting surfaces do not behave
  differently offline. Its `reports-offline` state is replaced by a staleness notice.
- **This is less code, not more.** The service worker's
  `/^https?:\/\/[^/]+\/api\/collections\/storage_[^/]+\/records/` pattern already
  matches `storage_report_*`, so the view responses are already cached. A wave 1
  reviewer flagged this as something the reporting screen had to work *around* by
  gating on `isOnline`. Under this decision that gate is simply removed.

## 3. `/` — the dashboard

| Block | Source | Offline |
|---|---|---|
| Stat tiles: boxes, items, tags, photos | `reportTotals()` over `useBoxFill()` + `useTagUsage()` | cached, staleness notice |
| Items per box, **top 5** | `topBoxesByItems()` | cached, staleness notice |
| Recent boxes | `useBoxList()`, newest first, **six shown** | cached, renders normally |
| Actions: search bar, New box, Print sheet | — | writes refuse per `assertOnline()` |
| "Full reports" link to `/reports` | — | — |

**Why items-per-box for the single chart.** It is the most actionable of the five —
it answers "which boxes are crowded" — where growth is the least informative on a
young collection and locations is a shape better seen in full on `/reports`.

**Why recent boxes matter.** Without them the offline front door is a wall of stale
numbers. With them, the first thing a user sees offline is their own boxes, which is
what criterion 11 is actually about.

**Staleness notice.** One notice for the aggregate block, not one per tile. It states
the figures may be out of date, and it is **not** shown unconditionally — a notice that
is always there is one people stop reading.

Concretely: show it when `!isOnline` **and** the query has data, i.e. the figures on
screen came from cache rather than the network. When offline with no cached data at
all, show the empty/needs-connection state instead — there is nothing stale to warn
about, there is nothing. `useOnline()` supplies the online signal; TanStack's
`dataUpdatedAt` gives the age if the notice should name it.

Recent boxes are not covered by the notice. A cached box list is the offline read v1
already promises and needs no apology.

`/` remains behind the auth guard like every other route. Nothing about the dashboard
makes it public.

## 4. `/items` — all items

- Free-text over item **title, description and notes** — the same three fields
  `/search` covers for items.
- **Tag filter chips**, AND-matched: an item must carry every selected tag.
- Paginated at the existing `PER_PAGE` of 30, newest first.
- Each row shows the item and **which box it is in**, resolved through `expand: 'box'`.
- **Archived boxes' items are excluded**, matching `/search`.
- Term and selected tags live in the **URL**, so a filtered view is linkable and
  survives a reload — the pattern `/search` already proves.
- Loading, empty ("no items yet"), no-matches ("nothing matches these filters") and
  error states are four distinct things, as on the box index.

**Not included, by decision:** a box dropdown filter, and archived items. Both were
considered and declined — term plus tags covers the need, and archived content in the
main items list would contradict how the rest of the app treats archived boxes.

### 4.1 The query change

This is one change to an existing function, not a new subsystem.

`ItemListFilters` gains an optional term and makes the box optional:

```ts
export interface ItemListFilters {
  boxId?: string        // was required
  term?: string         // new
  tagIds?: string[]
  page?: number
}
```

`itemFilter()` emits the box clause only when given a box, and the term clause only
when given a term:

```ts
export function itemFilter(filters: ItemListFilters): PbFilter {
  const tags = tagClauses(filters.tagIds)
  const params: Record<string, unknown> = { ...tags.params }
  const clauses: string[] = [...tags.clauses]

  if (filters.boxId) {
    clauses.push('box = {:boxId}')
    params.boxId = filters.boxId
  } else {
    // Browsing across boxes: exclude archived ones. An item carries no status
    // of its own, so exclusion travels through the relation.
    clauses.push('box.status = {:status}')
    params.status = 'active'
  }

  const term = (filters.term ?? '').trim()
  if (term) {
    clauses.push('(title ~ {:term} || description ~ {:term} || notes ~ {:term})')
    params.term = term
  }

  return { raw: clauses.join(' && ') || '1 = 1', params }
}
```

**It must not reuse `searchFilter`.** That function short-circuits a blank term to
`1 = 2` — return nothing — because landing on an empty `/search` must not dump the
whole database. `/items` has the opposite contract: no term means **show everything**,
paginated. Sharing the function would import the wrong default. The *term clause
itself* is duplicated deliberately, and both copies must stay in step.

The `|| '1 = 1'` fallback covers the all-items case where a box id is absent — it
cannot actually be reached today, since the no-box branch always adds a status clause,
but an empty `raw` would be a silent full-table filter and is worth making impossible
by construction.

`useItemList` keeps an `enabled` gate, but on a corrected condition:

```ts
// '' is not the same as absent. Box detail passes '' while its box is still
// loading and must NOT fire the browse-all query; absent means /items.
enabled: computed(() => filters.value.boxId !== '')
```

**An earlier draft of this spec said "box detail always passes a box id and is
unaffected". That was wrong.** It passes `box.value?.id ?? ''` — an empty string
while the box query is in flight. Since `''` is falsy, dropping the gate entirely
would send every box detail page load down the browse-all branch and fetch thirty
unrelated items with `expand=tags,box`. Nothing renders wrong (the item markup sits
behind `v-else-if="box"`), but it is a wasted round trip on the slow-connection
target, competing with the request that actually blocks the screen.

Two falsy values with opposite meanings sit three lines apart here. The comment is
part of the fix.

`keys.items.list(filters)` already folds the whole filter object into the key, so the
new fields participate in caching with no key change.

## 5. `/boxes` — the box index, moved

Today's `app/pages/index.vue` moves verbatim. No behaviour change: search bar, tag
filter, archived toggle, both sections, pagination.

Roughly fifteen `page.goto('/')` assertions across `boxes.spec.ts`,
`boxDetail.spec.ts`, `tagFilter.spec.ts`, `searchIndexBar.spec.ts` and
`auth.spec.ts` retarget to `/boxes`. Mechanical, but it is the bulk of the diff and
the most likely place to break something already working.

Navigation becomes: **Dashboard · Boxes · Items · Search · Tags · Reports**.

## 6. What is deliberately not built

- **No new PocketBase view collection.** Every dashboard figure comes from the three
  existing `storage_report_*` views. A block like "recently added items" or "boxes
  with nothing in them" would need a new view — a schema change, which stops and asks
  rather than being assumed.
- **No new chart library.** `nuxt-charts` is already installed and used.
- **No second reporting data layer.** The dashboard imports the same
  `useBoxFill` / `useTagUsage` / `useGrowth` and pure helpers `/reports` uses. If a
  figure differs between the two screens, that is a bug, not a design.
- **No dashboard-wide component abstraction.** Two screens sharing five components
  does not need a framework between them.

## 7. PRD amendments (v1.2)

The PRD is the product record and must not contradict the code:

- **§7.10** — the online-only rule is replaced. Reporting figures are served from
  cache when offline and carry a staleness notice. The original reasoning (that
  partial aggregates mislead) is preserved as the reason the notice is required.
- **§9 route table** — `/` becomes the dashboard; `/boxes` is the box index; `/items`
  is added; `/reports` stays.
- **New §7.11 Dashboard** and **§7.12 Items** describing the two screens.
- **§10** — criterion 11 is unchanged in substance but now explicitly covers the
  dashboard: opening `/` offline shows cached boxes, not an error.

## 8. Testing

Per CLAUDE.md: failing test first, and the full loop after every meaningful edit.

- **Unit** — `itemFilter` gains cases for term-only, tags-only, box-only, term+tags,
  and the archived-exclusion clause when no box is given. The existing assertion that
  no user value reaches `raw` must be extended to the new term parameter.
- **E2E** — `/items` search finds an item by a word only in its notes (the same
  property criterion 7 pins for `/search`); tag chips narrow correctly and AND-match;
  an archived box's item never appears; the four states each render.
- **E2E** — `/` shows the tiles and the chart, links to `/reports`, and lists recent
  boxes. Offline it shows the staleness notice **and still lists boxes** — that
  assertion is the whole point of the offline decision and must not be softened to
  merely checking the notice appears.
- **Regression** — the retargeted `/boxes` specs must pass unchanged in substance.
- **E2E** — the dashboard's recent-boxes block shows six, and the seeded fixture has
  five, so the test must assert against what the fixture actually holds rather than a
  hardcoded six. Deriving the expected count from the API is the pattern the reports
  totals test already had to adopt for exactly this reason.

The known-red `offline.spec.ts:6` remains red for its documented reason and is not in
scope here.

## 9. Risks

- **The route move is the risk, not the features.** Fifteen assertions across five
  spec files, on pages four slices have already edited. A missed one fails loudly,
  which is the good case; the bad case is a test that still passes while asserting
  the wrong page.
- **Two copies of the item term clause** (here and in `searchFilter`) can drift.
  Accepted deliberately over sharing a function whose blank-term contract is wrong for
  this screen — but both sites carry a comment pointing at the other.
- **Staleness is easy to claim and hard to see.** The notice must be driven by whether
  the data actually came from cache while offline, not shown unconditionally, or it
  becomes noise people stop reading.
