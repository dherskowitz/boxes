# Tablet and desktop layout

## Problem

The app is pinned to a phone. Four responsive utilities exist across the whole
of `app/`, three of them in one report component. On a desktop viewport today:

- `.sb-header` is a 2560px-wide saturated block with a 2rem corner radius.
- A `BoxCard` is a 2000px-wide row carrying an 84px thumbnail.
- `AppNav`'s pill stretches the full viewport width (`inset-x-[1.375rem]`).
- The `/boxes` FAB and box detail's action bar are fixed to viewport corners,
  stranded far from the content they act on.
- Every e2e spec runs on Pixel 7 (412px), so none of this is caught.

Make it look deliberate at tablet and desktop sizes without disturbing the
phone layout, which is the primary target and stays the primary target.

## Non-goals

No master-detail split. No desktop-only modals replacing the full-screen form
routes. No keyboard shortcuts. No data-density toggle. No new dependency —
`@vueuse/core` is already installed and already used (`useIntersectionObserver`
in `InfiniteList`).

## The safety rule

**Every class this work adds is `md:`- or `lg:`-prefixed. No base class is
edited, no base class is removed.** The 29 existing e2e specs run at 412px and
must stay green without being touched. Any change that cannot be expressed as a
breakpoint-prefixed addition is a change to the phone layout and is out of
scope.

## Breakpoints

Tailwind defaults, three of them:

| | width | what changes |
|---|---|---|
| base | < 768 | nothing. The current phone layout. |
| `md` | 768 | content capped, row lists become 2-column grids. Pill nav stays. |
| `lg` | 1024 | side rail replaces the pill, fixed actions promote into headers, wider grids. |
| `xl` | 1280 | densest grids (3 box columns, 4 item tiles). |

## Architecture

### Navigation

`AppNav` gains a second template, not a second component: one `links` array,
one `isActive()`, two branches chosen by
`useMediaQuery('(min-width: 1024px)')` with `v-if` / `v-else`.

`v-if`, not `hidden lg:flex`. Both navs in the DOM makes
`getByTestId('nav-boxes')` match two elements and breaks existing specs.
`ssr: false` (`nuxt.config.ts:9`) means the app renders client-only, so a media
query in render is safe — there is no server pass to mismatch.

The rail is `position: fixed`, left edge, `w-60`, and carries the `sb-nav`
class so the existing `@media print { .sb-nav { display: none } }` still hides
it. Same five destinations in the same order; scan keeps its amber treatment
but sits inline in the list rather than raised, since there is no thumb zone to
raise it into.

`layouts/default.vue` offsets its `<main>` by the rail width at `lg`.

At `lg+` the rail renders **even on pages with
`definePageMeta({ nav: false })`** — box detail, item detail, `/box/new`,
`/box/[qr_id]/item/new`, `/archived`. That flag exists because the floating
pill covers the thumb zone those screens need for their own actions; a side
rail does not. `/scan` (deliberately immersive, camera) and the two print
routes stay exempt: they keep `nav: false` behaviour at every width.

### Content measure

The measure lands in `app/assets/css/main.css`, not in fourteen templates:

```css
@media (min-width: 1024px) {
  .sb-body       { max-width: 72rem; margin-inline: auto; padding-inline: 2rem; }
  .sb-header > * { max-width: 72rem; margin-inline: auto; }
  .sb-page       { padding-bottom: 3rem; }
}
```

The header block stays full-bleed across the content area — the colour is the
"you are here" signal and should span the region — while its *contents* are
capped. `.sb-header > *` reaches `AppHeader`, `FormHeader` and box detail's
hand-rolled header in one rule.

`.sb-page`'s 9rem bottom padding exists to clear the floating pill. There is no
pill at `lg`, so it drops to ordinary page padding.

`app/pages/print-sheet.vue` and `app/pages/box/[qr_id]/print.vue` both override
`.sb-body` inside their own `@media print` blocks. The cap is reset in the
existing `@media print` block in `main.css` so neither print surface inherits a
72rem measure.

## Screens

Loading skeletons take the same grid classes as the list they stand in for.
A single-column skeleton resolving into a three-column grid is a layout jump.

| Screen | File / line | Change |
|---|---|---|
| Box index sections | `components/BoxSection.vue:56,98` | `flex flex-col` → `grid gap-3 md:grid-cols-2 xl:grid-cols-3` |
| Dashboard recents | `pages/index.vue:128,150` | same |
| Box detail items | `pages/box/[qr_id]/index.vue:356` | grid layout `2 → md:3 → xl:4`; row layout `1 → md:2` |
| `/items` | `pages/items.vue:117` | → `md:grid-cols-2` |
| `/search` | `components/SearchResultList.vue:68,98` | both sections → `md:grid-cols-2` |
| `/archived` | `pages/archived.vue:92,142` | → `md:grid-cols-2` |
| `/tags` | `pages/tags.vue:118,143` | → `md:grid-cols-2` |
| `/reports` | `pages/reports.vue:56` | report cards → `lg:grid-cols-2` |
| `/more` | `pages/more.vue:70,92` | sections → `md:grid-cols-2` |

### Promoted actions

**`/boxes`** — the FAB gets `lg:hidden`; a labelled `New box` `UButton` appears
in `AppHeader`'s `#actions` slot with `hidden lg:flex`. Two buttons, ~6 lines,
because a round icon-only FAB and a labelled header button are different enough
that sharing one element costs more than it saves. Both stay hidden on the
empty state, as today.

**Box detail** — the fixed action bar (`Add item` / `Move n`) **moves in the
DOM** to sit immediately after the Items heading row, and gains
`lg:static lg:justify-end lg:p-0 lg:bg-none`. One block, no duplicated markup:
`position: fixed` is out of flow, so where it sits in the DOM is invisible
below `lg`, and `position: static` at `lg` drops it exactly where it now sits —
beside the heading.

### Detail and form measures

- **Item detail** (`pages/item/[id].vue`) — the whole page, hero included,
  capped `lg:max-w-3xl` and centred. Article-style single column; the hero's
  `-mt-6 rounded-t-[1.875rem]` overlap is unaffected by a narrower parent.
- **`/box/new`, `/box/[qr_id]/item/new`** — form body capped `lg:max-w-2xl`,
  centred under the full-width `FormHeader` block.
- **`/login`** — `definePageMeta({ layout: false })`, so it inherits none of
  the above and gets its own centred card at `md+`.
- **`/scan`**, `print-sheet.vue`, `box/[qr_id]/print.vue` — untouched. Print
  layouts have their own sizing and the scanner is deliberately full-bleed.

## Testing

A second Playwright project, `desktop`, on `devices['Desktop Chrome']`, running
exactly one spec: `tests/e2e/responsive.spec.ts`. The existing `mobile` project
keeps every other spec on Pixel 7. Running all 29 at two viewports doubles suite
time to prove a CSS cap, and most of them assert against the pill.

The spec asserts, at 1280 and again after resizing to 768:

1. At 1280 — the rail is visible, `nav-scan` resolves to exactly one element,
   the pill is absent. At 768 — inverted.
2. At 1280 — `New box` is in the header and no FAB is present. At 768 — the FAB
   is present.
3. The box list is genuinely multi-column: the first two `box-card` bounding
   boxes share a `y` and differ in `x`.
4. **Each card fits its frame.** Asserting the document does not scroll
   sideways proves nothing when a container clips — `overflow: hidden` turns an
   overflow bug into a silent cropping bug and the check still passes. The
   assertion compares each card's `scrollWidth` against its `clientWidth`. It
   is a guard that passes from the start; the assertion proven to fail with
   the measure reverted is (5).
5. On a 2560px window, `.sb-body`'s measured width is ≤ the 72rem cap.

Followed by a screenshot sweep at 768 / 1280 / 1920 across every route, looked
at, before any phase is called done.

No new composable or util, so no new unit tests: `useMediaQuery` is consumed
directly from `@vueuse/core` in `AppNav`, and the rail's behaviour is a user
flow, which is where e2e belongs.

## Commits

Atomic, in order:

1. **Shell** — the `main.css` measure, the `AppNav` rail branch, the layout
   offset, the `desktop` Playwright project and `responsive.spec.ts`.
2. **List grids** — every wrapper in the Screens table and its matching
   skeleton, `/reports` and `/more` included.
3. **Promoted actions** — the `/boxes` header button, box detail's relocated
   action bar.
4. **Detail and form measures** — item detail, both form routes.
5. **Leftovers** — `/login`'s own centred card, plus whatever the screenshot
   sweep turns up.
6. **`CLAUDE.md`** — the line this work earns.

## Risks

- The rail branch is the only piece with runtime behaviour rather than pure
  CSS. If `useMediaQuery` evaluates before `matchMedia` is available the nav
  renders as the pill and corrects on the next tick — visible only as a flash,
  and only in environments without `matchMedia`, which the browser is not.
- `.sb-header > *` assumes every direct child of a header block wants the cap.
  Box detail's header has three; item detail's hero is not a `.sb-header` at
  all and is handled by its own page cap. The screenshot sweep is what
  confirms this per page.
