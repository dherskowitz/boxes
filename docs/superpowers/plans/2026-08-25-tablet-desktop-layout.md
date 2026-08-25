# Tablet and Desktop Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a phone-only PWA lay out deliberately at tablet and desktop widths without changing anything below 768px.

**Architecture:** Three breakpoints (`md` 768, `lg` 1024, `xl` 1280). At `lg` a fixed side rail replaces the floating nav pill and the content measure is capped in CSS rather than in fourteen templates. Row lists become card grids at `md`. Fixed thumb-zone controls promote into their page's own header at `lg`. One new Playwright project runs one new spec at desktop width; the existing 29 specs keep running at 412px, untouched.

**Tech Stack:** Nuxt 4 (SPA, `ssr: false`), Nuxt UI 4, Tailwind 4, `@vueuse/core` (already a dependency), Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-25-tablet-desktop-layout-design.md`

## Global Constraints

- **Every class this work adds is `md:`- or `lg:`-prefixed. No base class is edited or removed.** The 29 existing e2e specs run at 412px and must stay green without being modified. If a change cannot be expressed as a breakpoint-prefixed addition, it is a change to the phone layout and is out of scope.
- Package manager is **pnpm**. Never npm or yarn.
- The loop must be green before any commit: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`.
- No `any`, no `as` to silence an error, no non-null `!`. Narrow with a thrown error instead.
- No empty `catch`. No attribution footers in commit messages (no `Co-Authored-By`, no "Generated with", no emoji trailers). One logical change per commit.
- Nuxt auto-imports are on for `composables/`, `utils/` and `queries/` — do not write imports for those. `@vueuse/core` is **not** auto-imported: import it explicitly, as `app/components/InfiniteList.vue` already does.
- Use Nuxt UI components (`UButton`, `UModal`, …) before hand-rolling Tailwind.
- `.sb-body` and `.sb-page` live **outside** any `@layer` in `app/assets/css/main.css`, so unlayered rules beat Tailwind utilities. Never try to override them with a `lg:max-w-*` utility — it silently loses. Add a dedicated class in the same unlayered block instead.
- Cap value is **72rem** for list screens, **48rem** for article-style screens, **42rem** for forms. Rail width is **15rem**. Desktop breakpoint is **1024px** and is written in exactly two places that must agree: `DESKTOP` in `app/utils/breakpoints.ts` and the `@media (min-width: 1024px)` blocks in `main.css`.

---

### Task 1: Desktop shell — side rail, content measure, desktop test project

**Files:**
- Create: `app/utils/breakpoints.ts`
- Create: `tests/e2e/responsive.spec.ts`
- Modify: `app/assets/css/main.css`
- Modify: `app/components/AppNav.vue`
- Modify: `app/layouts/default.vue`
- Modify: `app/types/nav.d.ts`
- Modify: `app/pages/scan.vue:9`
- Modify: `playwright.config.ts:42-49`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `DESKTOP: string` — the media query string, auto-imported from `app/utils/breakpoints.ts`.
  - `data-testid="nav-rail"` on the desktop nav element, `data-testid="nav-pill"` on the phone nav element. Exactly one of the two is in the DOM at a time.
  - CSS classes `.sb-shell-offset` (rail gutter), `.sb-measure-form` (42rem), `.sb-measure-article` (48rem) — Tasks 4 and 5 use the last two.
  - `RouteMeta.rail?: boolean` — `rail: false` opts a page out of the rail at every width.
  - Playwright project `desktop`, which runs only `responsive.spec.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/responsive.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

// dana owns the seeded boxes, so /boxes has enough cards to prove a grid.
test.use({ storageState: 'tests/e2e/.auth/dana.json' })

const TABLET = { width: 768, height: 1024 }

test.describe('desktop shell', () => {
  test('navigates from a side rail, not the floating pill', async ({ page }) => {
    await page.goto('/boxes')
    await expect(page.getByTestId('nav-rail')).toBeVisible()
    await expect(page.getByTestId('nav-pill')).toHaveCount(0)
    // One nav in the DOM at a time: two would make every existing
    // getByTestId('nav-*') in the suite ambiguous.
    await expect(page.getByTestId('nav-boxes')).toHaveCount(1)
  })

  test('falls back to the pill at tablet width', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await page.goto('/boxes')
    await expect(page.getByTestId('nav-pill')).toBeVisible()
    await expect(page.getByTestId('nav-rail')).toHaveCount(0)
    await expect(page.getByTestId('nav-boxes')).toHaveCount(1)
  })

  test('shows the rail on a screen that hides the pill', async ({ page }) => {
    // Box detail sets `nav: false` because the pill covers the thumb zone it
    // needs for Add item. A side rail takes no thumb zone, so it stays.
    await page.goto('/boxes')
    await page.getByTestId('box-card').first().click()
    await expect(page.getByTestId('add-item')).toBeVisible()
    await expect(page.getByTestId('nav-rail')).toBeVisible()
  })

  test('leaves the scanner chromeless', async ({ page }) => {
    await page.goto('/scan')
    await expect(page.getByTestId('nav-rail')).toHaveCount(0)
    await expect(page.getByTestId('nav-pill')).toHaveCount(0)
  })

  test('caps the content measure on a very wide window', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1200 })
    await page.goto('/boxes')
    const body = page.locator('.sb-body')
    await expect(body).toBeVisible()
    const box = await body.boundingBox()
    if (!box) throw new Error('expected a measured content region')
    // 72rem at the app's 16px root.
    expect(box.width).toBeLessThanOrEqual(1152)
  })

  test('keeps the content clear of the rail', async ({ page }) => {
    await page.goto('/boxes')
    const card = page.getByTestId('box-card').first()
    await expect(card).toBeVisible()
    const rail = await page.getByTestId('nav-rail').boundingBox()
    const first = await card.boundingBox()
    if (!rail || !first) throw new Error('expected a rail and a first card')
    expect(first.x).toBeGreaterThanOrEqual(rail.x + rail.width)
  })
})
```

- [ ] **Step 2: Run it and watch it fail for the right reason**

```bash
pnpm exec playwright test responsive.spec.ts --project=desktop
```

Expected: `Error: Project(s) "desktop" not found`. That is the right first failure — the project does not exist yet.

- [ ] **Step 3: Add the desktop Playwright project**

In `playwright.config.ts`, replace the `projects` array (lines 42-49):

```ts
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'mobile',
      // The desktop layout gets its own project and its own viewport. Run this
      // spec at 412px and it asserts a rail exists exactly where it must not.
      testIgnore: /responsive\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
      dependencies: ['setup']
    },
    {
      name: 'desktop',
      testMatch: /responsive\.spec\.ts/,
      // An explicit viewport rather than devices['Desktop Chrome']: that preset
      // carries `channel: 'chrome'`, which needs real Chrome installed rather
      // than the bundled Chromium every other project uses. `isMobile` and
      // `hasTouch` must be turned off by hand, because the top-level `use`
      // spreads Pixel 7 and those would otherwise be inherited as true.
      use: {
        viewport: { width: 1280, height: 800 },
        isMobile: false,
        hasTouch: false,
        deviceScaleFactor: 1
      },
      dependencies: ['setup']
    }
  ]
```

- [ ] **Step 4: Run it again and watch it fail on the real assertion**

```bash
pnpm exec playwright test responsive.spec.ts --project=desktop
```

Expected: FAIL on `nav-rail` — `expect(locator).toBeVisible() failed, locator resolved to 0 elements`. The project now exists; the rail does not.

- [ ] **Step 5: Add the shared breakpoint constant**

Create `app/utils/breakpoints.ts`:

```ts
/**
 * The width at which the app stops being a phone: the floating nav pill is
 * replaced by a side rail and the content measure is capped.
 *
 * Written twice on purpose and only twice — here, and as
 * `@media (min-width: 1024px)` in `app/assets/css/main.css`. The rail and the
 * measure are two halves of one layout; change one and you must change the
 * other, so keep them findable by grepping for 1024.
 */
export const DESKTOP = '(min-width: 1024px)'
```

- [ ] **Step 6: Give `AppNav` a rail branch**

In `app/components/AppNav.vue`, add the import and the rail's link list to the top of `<script setup>`, after the existing `rightLinks`:

```ts
import { useMediaQuery } from '@vueuse/core'
```

```ts
// One ordered list for the rail. The pill splits its four destinations around
// the raised scan button; a vertical rail has no thumb zone to raise anything
// into, so scan sits in sequence and keeps its amber only as a badge.
const railLinks = [...links, { to: '/scan', label: 'Scan', icon: 'i-lucide-scan-line' }, ...rightLinks] as const

// `v-if`, not `hidden lg:flex`. Both navs in the DOM makes every existing
// `getByTestId('nav-*')` in the e2e suite match two elements. `ssr: false`
// means this renders client-only, so there is no server pass to mismatch.
const isDesktop = useMediaQuery(DESKTOP)
```

Then wrap the template. The existing `<nav>` becomes the `v-else` branch and gains `data-testid="nav-pill"`; the rail goes first:

```vue
<template>
  <nav
    v-if="isDesktop"
    data-testid="nav-rail"
    class="sb-nav fixed inset-y-0 left-0 z-40 flex w-60 flex-col gap-1 px-4 py-6"
    :style="{ background: 'var(--sb-ink)' }"
    aria-label="Main"
  >
    <p class="sb-mono mb-4 px-3 text-white/55">Storage Boxes</p>

    <NuxtLink
      v-for="link in railLinks"
      :key="link.to"
      :to="link.to"
      :data-testid="`nav-${link.label.toLowerCase()}`"
      class="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-extrabold"
      :class="isActive(link.to) ? 'bg-white/10 text-white' : 'text-[#7d786e] hover:text-white'"
      :aria-current="isActive(link.to) ? 'page' : undefined"
    >
      <span
        v-if="link.to === '/scan'"
        class="flex size-8 shrink-0 items-center justify-center rounded-xl"
        :style="{ background: 'var(--sb-amber)', color: 'var(--sb-amber-ink)' }"
      >
        <UIcon :name="link.icon" class="size-[18px]" aria-hidden="true" />
      </span>
      <UIcon v-else :name="link.icon" class="size-[22px] shrink-0" aria-hidden="true" />
      {{ link.label }}
    </NuxtLink>
  </nav>

  <nav
    v-else
    data-testid="nav-pill"
    class="sb-nav fixed inset-x-[max(1.375rem,env(safe-area-inset-left))] z-40 flex items-center justify-between rounded-[1.625rem] px-4 py-3"
    ...unchanged...
  >
    ...unchanged...
  </nav>
</template>
```

The rail keeps the `sb-nav` class, so the existing `@media print { .sb-nav { display: none } }` still hides it.

- [ ] **Step 7: Declare the `rail` route meta**

Replace `app/types/nav.d.ts` in full:

```ts
// `nav: false` hides the floating nav pill for a screen, `offlineBanner: false`
// the layout's offline notice, `rail: false` the desktop side rail — see
// `app/layouts/default.vue`. Declared here so `definePageMeta` type-checks them.
declare module 'vue-router' {
  interface RouteMeta {
    nav?: boolean
    offlineBanner?: boolean
    rail?: boolean
  }
}

export {}
```

- [ ] **Step 8: Teach the layout about the rail**

In `app/layouts/default.vue`, add to `<script setup>`:

```ts
import { useMediaQuery } from '@vueuse/core'
```

and replace the `showNav` computed:

```ts
const route = useRoute()
const isDesktop = useMediaQuery(DESKTOP)
// `nav: false` exists because the floating pill covers the thumb zone a detail
// screen needs for its own actions — box detail's Add item sits exactly there.
// A side rail takes no thumb zone, so at desktop width those screens keep their
// navigation. `rail: false` is the opt-out for a screen that must stay
// chromeless at every width: the scanner.
const showNav = computed(() =>
  isDesktop.value ? route.meta.rail !== false : route.meta.nav !== false
)
const showOffline = computed(() => route.meta.offlineBanner !== false)
```

and the root element's class binding:

```vue
  <div class="flex min-h-screen flex-col" :class="{ 'sb-page sb-shell-offset': showNav }">
```

- [ ] **Step 9: Opt the scanner out of the rail**

In `app/pages/scan.vue:9`:

```ts
definePageMeta({ nav: false, rail: false, offlineBanner: false })
```

- [ ] **Step 10: Add the content measure**

In `app/assets/css/main.css`, first **move** the existing `.sb-body` rule (currently the last rule in the file) so it sits immediately after the `.sb-page` rule and before the `@media print` block. It is an unlayered rule with no competitor, so this is a pure source-order move with no visual change at any width — but it has to precede the override below, and the print reset has to follow both.

Then, directly after it, add:

```css
/* --- Tablet and desktop --------------------------------------------------
   Additive only: the phone layout is the base and nothing here fires below
   1024px. Keep this width in step with `DESKTOP` in app/utils/breakpoints.ts
   — the rail and these measures are two halves of one layout.

   Unlayered, like `.sb-body` and `.sb-page` above, and deliberately so: an
   unlayered rule beats a Tailwind utility, which means `lg:max-w-2xl` on a
   `.sb-body` element silently loses. That is why the narrower measures below
   are classes rather than utilities.
------------------------------------------------------------------------- */
@media (min-width: 1024px) {
  /* The header block stays full-bleed — its colour is the "you are here"
     signal and should span the region — but its contents are capped, so a
     title does not start 900px from the body text underneath it. Reaches
     AppHeader, FormHeader and box detail's hand-rolled header in one rule. */
  .sb-header > * {
    max-width: 72rem;
    margin-inline: auto;
  }

  .sb-body {
    max-width: 72rem;
    margin-inline: auto;
    padding-inline: 2rem;
  }

  /* Narrower measures, for screens that read as one column of prose rather
     than a board of cards. Same specificity as `.sb-body`, declared after it,
     so a page opts in by adding the class and nothing else. */
  .sb-measure-article {
    max-width: 48rem;
    margin-inline: auto;
  }

  .sb-measure-form {
    max-width: 42rem;
    margin-inline: auto;
  }

  /* 9rem of it clears the floating pill. There is no pill at this width. */
  .sb-page {
    padding-bottom: 3rem;
  }

  /* Gutter for the fixed rail. */
  .sb-shell-offset {
    padding-left: 15rem;
  }
}
```

And extend the existing `@media print` block — which now follows the rules above — so a print surface never inherits a desktop measure or a rail gutter:

```css
@media print {
  .sb-nav,
  .sb-header,
  .no-print {
    display: none !important;
  }

  .sb-page {
    padding-bottom: 0;
  }

  .sb-body {
    max-width: none;
    margin-inline: 0;
  }

  .sb-shell-offset {
    padding-left: 0;
  }
}
```

- [ ] **Step 11: Run the desktop spec and watch it pass**

```bash
pnpm exec playwright test responsive.spec.ts --project=desktop
```

Expected: 6 passed. If `caps the content measure` fails by a few px, read the failure — a `.sb-body` wider than 1152 means the move in Step 10 put the base rule after the override.

- [ ] **Step 12: Prove the measure assertion is not vacuous**

Temporarily delete the `.sb-body { max-width: 72rem; … }` declaration from the `@media (min-width: 1024px)` block, re-run the spec, and confirm `caps the content measure on a very wide window` **fails**. Then put it back and confirm it passes again. An assertion that cannot fail is not a test.

- [ ] **Step 13: Run the whole loop**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

Expected: all green, including the 29 existing specs at 412px. If `pnpm typecheck` reports auto-imported symbols as "Cannot find name", run `pnpm nuxt prepare` first — that is a stale `.nuxt/imports.d.ts`, not a real error.

- [ ] **Step 14: Commit**

```bash
git add app/utils/breakpoints.ts app/assets/css/main.css app/components/AppNav.vue \
        app/layouts/default.vue app/types/nav.d.ts app/pages/scan.vue \
        playwright.config.ts tests/e2e/responsive.spec.ts
git commit -m "Give the app a desktop shell: side rail and a capped measure"
```

---

### Task 2: List grids

**Files:**
- Modify: `app/components/BoxSection.vue:56,98`
- Modify: `app/pages/index.vue:128,150`
- Modify: `app/pages/box/[qr_id]/index.vue:356`
- Modify: `app/pages/items.vue:117`
- Modify: `app/components/SearchResultList.vue:68,98`
- Modify: `app/pages/archived.vue:92,142`
- Modify: `app/pages/tags.vue:118,143`
- Modify: `app/pages/reports.vue:71-77`
- Modify: `app/pages/more.vue:92`
- Test: `tests/e2e/responsive.spec.ts`

**Interfaces:**
- Consumes: `data-testid="nav-rail"` and the 72rem measure from Task 1.
- Produces: nothing new. Existing testids (`box-card`, `item-row`, `search-result-box`, `archived-box`) are unchanged and are what the new assertions address.

**A rule that applies to every change in this task:** a loading skeleton takes the *same* grid classes as the list it stands in for. A single-column skeleton resolving into a three-column grid is a visible layout jump.

- [ ] **Step 1: Write the failing tests**

Append to `tests/e2e/responsive.spec.ts`:

```ts
test.describe('list grids', () => {
  /** Two elements are side by side when they share a row and do not overlap. */
  async function assertSideBySide(page: import('@playwright/test').Page, testId: string) {
    const cards = page.getByTestId(testId)
    await expect(cards.first()).toBeVisible()
    const a = await cards.nth(0).boundingBox()
    const b = await cards.nth(1).boundingBox()
    if (!a || !b) throw new Error(`expected at least two ${testId} elements`)
    expect(Math.abs(b.y - a.y)).toBeLessThan(2)
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.width)
  }

  test('lays boxes out side by side', async ({ page }) => {
    await page.goto('/boxes')
    await assertSideBySide(page, 'box-card')
  })

  test('lays items out side by side', async ({ page }) => {
    await page.goto('/items')
    await assertSideBySide(page, 'item-row')
  })

  test('grids at tablet width too', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await page.goto('/boxes')
    await assertSideBySide(page, 'box-card')
  })

  test('every card fits its frame', async ({ page }) => {
    // Asserting the document does not scroll sideways proves nothing when a
    // container clips: `overflow: hidden` turns an overflow bug into a silent
    // cropping bug and the check still passes. Measure each card instead.
    await page.goto('/boxes')
    await expect(page.getByTestId('box-card').first()).toBeVisible()
    const overflowing = await page
      .getByTestId('box-card')
      .evaluateAll(els => els.filter(el => el.scrollWidth > el.clientWidth + 1).length)
    expect(overflowing).toBe(0)
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

```bash
pnpm exec playwright test responsive.spec.ts --project=desktop
```

Expected: `lays boxes out side by side`, `lays items out side by side` and `grids at tablet width too` FAIL on `expect(received).toBeGreaterThanOrEqual` — the second card sits below the first, not beside it. `every card fits its frame` should already pass; it is the guard, not the driver.

- [ ] **Step 3: Grid the box lists**

`app/components/BoxSection.vue` — both the skeleton wrapper (line 56) and the card wrapper (line 98):

```vue
class="grid gap-[11px] md:grid-cols-2 xl:grid-cols-3"
```

replacing `class="flex flex-col gap-[11px]"` in each.

`app/pages/index.vue` — the same replacement at lines 128 and 150.

- [ ] **Step 4: Grid the item lists**

`app/pages/items.vue:117`:

```vue
      <div v-else class="grid gap-[9px] md:grid-cols-2">
```

`app/pages/items.vue` skeleton (the `items-loading` wrapper) — change `class="flex flex-col gap-2"` to `class="grid gap-2 md:grid-cols-2"`.

`app/pages/box/[qr_id]/index.vue:356` — the layout-switching class binding:

```vue
          :class="itemLayout === 'grid'
            ? 'grid grid-cols-2 gap-[9px] md:grid-cols-3 xl:grid-cols-4'
            : 'grid gap-[9px] md:grid-cols-2'"
```

and its skeleton (`item-list-loading`) becomes `class="grid gap-2 md:grid-cols-2"`.

- [ ] **Step 5: Grid the remaining lists**

`app/components/SearchResultList.vue` — each `<section>` holds an `<h2>` alongside its links, so the grid goes on a **new wrapper around the links**, not on the section. For both sections (lines 68 and 98), keep `<section class="flex flex-col gap-2.5">` and wrap the `v-for` link in:

```vue
      <div class="grid gap-2.5 md:grid-cols-2">
        <NuxtLink ...unchanged...>...</NuxtLink>
      </div>
```

`app/pages/archived.vue` — line 92 skeleton and line 142 `<ul>` both become `class="grid gap-2.5 md:grid-cols-2"`.

`app/pages/tags.vue` — line 118 skeleton and line 143 `<ul>` both become `class="grid gap-2.5 md:grid-cols-2"`.

`app/pages/more.vue:92` — same shape as SearchResultList: the `<section>` keeps its heading, and the links get a wrapper:

```vue
      <section v-for="section in sections" :key="section.heading" class="flex flex-col gap-2.5">
        <h2 class="sb-mono" :style="{ color: 'var(--sb-muted)' }">{{ section.heading }}</h2>
        <div class="grid gap-2.5 md:grid-cols-2">
          <NuxtLink ...unchanged...>...</NuxtLink>
        </div>
      </section>
```

Leave `app/pages/more.vue:70` alone — that section holds one card, and a grid of one is a grid for nothing.

- [ ] **Step 6: Grid the reports**

`app/pages/reports.vue` — the five report components are direct children of the `sb-body` flex column. Wrap them, and let the totals strip span the full width since it is already a four-up row of its own:

```vue
      <template v-else>
        <div class="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start">
          <ReportTotals :totals="totals" class="lg:col-span-2" />
          <ReportItemsPerBox :box-fill="boxFill ?? []" />
          <ReportLocations :box-fill="boxFill ?? []" />
          <ReportTagUsage :tag-usage="tagUsage ?? []" />
          <ReportGrowth :growth="growth ?? []" />
        </div>
      </template>
```

`lg:items-start` matters: without it a short chart card stretches to the height of the tall one beside it.

- [ ] **Step 7: Run the desktop spec and watch it pass**

```bash
pnpm exec playwright test responsive.spec.ts --project=desktop
```

Expected: all pass.

- [ ] **Step 8: Run the whole loop**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

Expected: all green. Pay particular attention to `infiniteScroll.spec.ts` and `searchGrouped.spec.ts` — both count and click list rows, and both must be unaffected because every class added is `md:`-prefixed.

- [ ] **Step 9: Commit**

```bash
git add app/components/BoxSection.vue app/components/SearchResultList.vue \
        app/pages/index.vue app/pages/items.vue app/pages/archived.vue \
        app/pages/tags.vue app/pages/reports.vue app/pages/more.vue \
        "app/pages/box/[qr_id]/index.vue" tests/e2e/responsive.spec.ts
git commit -m "Lay lists out as grids from tablet width up"
```

---

### Task 3: Promote the fixed actions into their headers

**Files:**
- Modify: `app/pages/boxes.vue` (the `AppHeader` `#actions` slot, and the FAB at the end of the template)
- Modify: `app/pages/box/[qr_id]/index.vue` (the fixed action bar, lines 371-407)
- Test: `tests/e2e/responsive.spec.ts`

**Interfaces:**
- Consumes: the `@media (min-width: 1024px)` block from Task 1, which this task adds one rule to.
- Produces: `data-testid="new-box-fab"` on the `/boxes` floating button, `data-testid="new-box"` on its desktop header counterpart.

- [ ] **Step 1: Write the failing tests**

Append to `tests/e2e/responsive.spec.ts`:

```ts
test.describe('promoted actions', () => {
  test('offers New box in the header, not as a floating button', async ({ page }) => {
    await page.goto('/boxes')
    await expect(page.getByTestId('new-box')).toBeVisible()
    // Still in the DOM, hidden by CSS — assert visibility, not count.
    await expect(page.getByTestId('new-box-fab')).toBeHidden()
  })

  test('keeps the floating button at tablet width', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await page.goto('/boxes')
    await expect(page.getByTestId('new-box-fab')).toBeVisible()
    await expect(page.getByTestId('new-box')).toBeHidden()
  })

  test('New box in the header actually opens the form', async ({ page }) => {
    await page.goto('/boxes')
    await page.getByTestId('new-box').click()
    await expect(page).toHaveURL('/box/new')
  })

  test('sits Add item beside the Items heading, not over the page', async ({ page }) => {
    await page.goto('/boxes')
    await page.getByTestId('box-card').first().click()
    const add = page.getByTestId('add-item')
    await expect(add).toBeVisible()
    // Static, not fixed: a floating bar across a wide window reads as
    // leftover phone chrome, and it would sit under the rail.
    const position = await add.evaluate(el => {
      const bar = el.closest('.sb-action-bar')
      if (!bar) throw new Error('expected Add item inside .sb-action-bar')
      return getComputedStyle(bar).position
    })
    expect(position).toBe('static')
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

```bash
pnpm exec playwright test responsive.spec.ts --project=desktop
```

Expected: the first three FAIL on `getByTestId('new-box')` resolving to 0 elements; the fourth FAILs on `expected Add item inside .sb-action-bar`.

- [ ] **Step 3: Add the desktop New box button**

In `app/pages/boxes.vue`, the header currently renders an `#actions` slot only on the empty state. Replace that block so the action slot always renders, with the avatar kept as it was:

```vue
      <template #actions>
        <!-- Desktop only. The floating button below is the phone affordance,
             and there is no thumb zone here to put it in. `hidden` is
             display:none, so `getByRole` never sees both at once. -->
        <UButton
          v-if="!isEmpty"
          to="/box/new"
          data-testid="new-box"
          icon="i-lucide-plus"
          color="neutral"
          class="hidden shrink-0 rounded-full bg-white/20 font-extrabold text-current hover:bg-white/30 lg:flex"
        >
          New box
        </UButton>
        <NuxtLink v-if="isEmpty" to="/more" aria-label="Your account">
          <UserAvatar :name="member?.name" />
        </NuxtLink>
      </template>
```

- [ ] **Step 4: Retire the FAB at desktop width**

Same file, on the floating `UButton` at the end of the template, add the testid and the hide:

```vue
    <UButton
      v-if="!isEmpty"
      to="/box/new"
      data-testid="new-box-fab"
      aria-label="New box"
      icon="i-lucide-plus"
      class="fixed right-[1.375rem] z-40 flex size-15 items-center justify-center rounded-full text-white lg:hidden"
```

The rest of the element — the `:style` block and `:ui` prop — is unchanged. `boxes.spec.ts:55` asserts `getByLabel('New box')` is hidden on the empty state; the new header button has visible text and no `aria-label`, so `getByLabel` still matches only this one.

- [ ] **Step 5: Move box detail's action bar into the flow**

In `app/pages/box/[qr_id]/index.vue`, cut the entire `<div v-if="canEdit" class="fixed inset-x-0 bottom-0 …">` block (the one holding `move-items` and `add-item`) and paste it immediately after the heading row that contains `<h2 class="sb-mono">Items…</h2>` and the layout toggle — inside the `.sb-body` container, before the loading branch. `position: fixed` is out of flow, so where it sits in the DOM is invisible below `lg`.

Then change its class and style:

```vue
        <div
          v-if="canEdit"
          class="sb-action-bar fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-2.5 px-[1.375rem] pt-3.5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:static lg:justify-end lg:gap-3 lg:p-0"
        >
```

The inline `:style="{ background: 'linear-gradient(...)' }"` is **deleted** — an inline style cannot be scoped to a breakpoint, and at `lg` the bar no longer floats over anything to fade into. The gradient moves to `main.css` in two pieces. Add the base rule to the `@layer components` block:

```css
  /* The fade the fixed bottom action bar sits on, so the list scrolls out
     under it rather than colliding with it. Reset at desktop width, where the
     bar is a static row beside its heading. */
  .sb-action-bar {
    background: linear-gradient(to top, var(--sb-bg) 72%, transparent);
  }
```

and the reset inside Task 1's `@media (min-width: 1024px)` block, after `.sb-shell-offset`:

```css
  /* Nothing to fade into: at this width the bar does not float over content. */
  .sb-action-bar {
    background: none;
  }
```

Also relax the page's bottom padding, which existed to clear the floating bar — on the `<div v-else-if="box" class="pb-40">` wrapper:

```vue
    <div v-else-if="box" class="pb-40 lg:pb-10">
```

And keep the two buttons from stretching across a desktop row — on each of `move-items` and `add-item`, add `lg:flex-none` to the existing class list.

- [ ] **Step 6: Run the desktop spec and watch it pass**

```bash
pnpm exec playwright test responsive.spec.ts --project=desktop
```

Expected: all pass.

- [ ] **Step 7: Run the whole loop**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

Expected: all green. `boxes.spec.ts` and `boxDetail.spec.ts` are the two that exercise these controls at 412px; if either fails, a base class was changed rather than added to.

- [ ] **Step 8: Commit**

```bash
git add app/pages/boxes.vue "app/pages/box/[qr_id]/index.vue" \
        app/assets/css/main.css tests/e2e/responsive.spec.ts
git commit -m "Promote the floating actions into their headers on desktop"
```

---

### Task 4: Article and form measures

**Files:**
- Modify: `app/pages/item/[id].vue` (the three top-level branch wrappers)
- Modify: `app/pages/box/new.vue:44`
- Modify: `app/pages/box/[qr_id]/item/new.vue:73`
- Test: `tests/e2e/responsive.spec.ts`

**Interfaces:**
- Consumes: `.sb-measure-article` (48rem) and `.sb-measure-form` (42rem) from Task 1.
- Produces: nothing new.

- [ ] **Step 1: Write the failing tests**

Append to `tests/e2e/responsive.spec.ts`:

```ts
test.describe('article and form measures', () => {
  test('reads an item as one narrow column', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1200 })
    await page.goto('/boxes')
    await page.getByTestId('box-card').first().click()
    await page.getByTestId('item-card').first().click()
    const article = page.locator('.sb-measure-article')
    await expect(article).toBeVisible()
    const box = await article.boundingBox()
    if (!box) throw new Error('expected a measured article region')
    expect(box.width).toBeLessThanOrEqual(768) // 48rem
  })

  test('holds a form to a form-sized measure', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1200 })
    await page.goto('/box/new')
    const form = page.locator('.sb-measure-form')
    await expect(form).toBeVisible()
    const box = await form.boundingBox()
    if (!box) throw new Error('expected a measured form region')
    expect(box.width).toBeLessThanOrEqual(672) // 42rem
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

```bash
pnpm exec playwright test responsive.spec.ts --project=desktop
```

Expected: both FAIL — `.sb-measure-article` and `.sb-measure-form` resolve to 0 elements.

- [ ] **Step 3: Cap item detail**

In `app/pages/item/[id].vue`, add `sb-measure-article` to all three top-level branches so the page does not change width as it loads:

```vue
    <div v-if="isPending" data-testid="item-loading" class="sb-body sb-measure-article flex flex-col gap-4 pt-6">
```

```vue
    <UAlert v-else-if="isError" color="error" class="sb-measure-article m-[1.375rem]" :description="errorMessage" />
```

```vue
    <div v-else-if="item" class="sb-measure-article pb-10">
```

The hero stays inside the capped column — the whole point is that the item reads as an article rather than a dashboard — and its `-mt-6 rounded-t-[1.875rem]` overlap is unaffected by a narrower parent.

- [ ] **Step 4: Cap the two form routes**

`app/pages/box/new.vue:44`:

```vue
    <div class="sb-body sb-measure-form pb-8">
```

`app/pages/box/[qr_id]/item/new.vue:73`:

```vue
    <div class="sb-body sb-measure-form pb-8">
```

The `FormHeader` block above each stays full-bleed with its contents capped at 72rem by Task 1's `.sb-header > *` rule — a Cancel/Save bar that tracks the page width is the one piece of chrome that should stay wide.

- [ ] **Step 5: Run the desktop spec and watch it pass**

```bash
pnpm exec playwright test responsive.spec.ts --project=desktop
```

Expected: all pass. If the form measure comes back as 1152 rather than 672, the `.sb-measure-form` rule is declared *before* `.sb-body` in the media block — they share specificity, so order decides.

- [ ] **Step 6: Run the whole loop**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add "app/pages/item/[id].vue" app/pages/box/new.vue \
        "app/pages/box/[qr_id]/item/new.vue" tests/e2e/responsive.spec.ts
git commit -m "Hold item detail and the forms to a reading measure"
```

---

### Task 5: Login, and the screenshot sweep

**Files:**
- Modify: `app/pages/login.vue` (the root wrapper)
- Create: `/tmp/claude-1000/-home-daniel-Projects-storage-app/23dca17e-0249-49cb-bb2e-bce31931b811/scratchpad/shoot.mjs` (throwaway, never committed)
- Modify: whatever the sweep turns up
- Test: `tests/e2e/responsive.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Append to `tests/e2e/responsive.spec.ts`:

```ts
test.describe('login', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('centres its card instead of stretching it', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1200 })
    await page.goto('/login')
    const field = page.getByLabel('Email')
    await expect(field).toBeVisible()
    const box = await field.boundingBox()
    if (!box) throw new Error('expected a measured email field')
    expect(box.width).toBeLessThanOrEqual(600)
    // Centred, not pinned left: the card's midpoint sits near the viewport's.
    expect(box.x + box.width / 2).toBeGreaterThan(900)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm exec playwright test responsive.spec.ts --project=desktop
```

Expected: FAIL — the field spans nearly the full 2560px.

- [ ] **Step 3: Centre the login card**

`app/pages/login.vue` uses `definePageMeta({ layout: false })`, so it inherits none of the shell and needs its own measure. The accent background must still fill the window, so it moves off the card wrapper and onto a new page-filling parent:

```vue
<template>
  <div class="min-h-screen" :style="{ background: 'var(--sb-accent)' }">
    <div class="flex min-h-screen flex-col justify-center gap-7 px-[1.625rem] py-[max(env(safe-area-inset-top),2rem)] text-white md:mx-auto md:w-full md:max-w-md">
      ...everything that was inside, unchanged...
    </div>
  </div>
</template>
```

- [ ] **Step 4: Run the desktop spec and watch it pass**

```bash
pnpm exec playwright test responsive.spec.ts --project=desktop
```

Expected: all pass.

- [ ] **Step 5: Write the screenshot script**

CLAUDE.md: screenshot any screen you build and look at it before calling it done. Write this to the scratchpad, not the repo:

```js
// shoot.mjs — throwaway. Run against a dev server already on :3000.
import { chromium } from 'playwright'

const WIDTHS = [768, 1280, 1920]
const OUT = process.env.OUT ?? '.'

const browser = await chromium.launch()
for (const width of WIDTHS) {
  const context = await browser.newContext({
    storageState: 'tests/e2e/.auth/dana.json',
    viewport: { width, height: 1000 },
    serviceWorkers: 'block'
  })
  const page = await context.newPage()

  // Resolve one real box and one real item by clicking, so no id is hardcoded.
  await page.goto('http://127.0.0.1:3000/boxes')
  await page.getByTestId('box-card').first().click()
  await page.waitForURL(/\/box\//)
  const boxPath = new URL(page.url()).pathname
  await page.getByTestId('item-card').first().click()
  await page.waitForURL(/\/item\//)
  const itemPath = new URL(page.url()).pathname

  const routes = [
    '/', '/boxes', '/items', '/search?q=coat', '/tags', '/reports', '/more',
    '/archived', boxPath, itemPath, '/box/new', `${boxPath}/item/new`,
    '/print-sheet', `${boxPath}/print`, '/scan'
  ]

  for (const route of routes) {
    await page.goto(`http://127.0.0.1:3000${route}`)
    await page.waitForLoadState('networkidle')
    const name = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'
    await page.screenshot({ path: `${OUT}/${width}-${name}.png`, fullPage: true })
  }
  await context.close()
}
await browser.close()
```

- [ ] **Step 6: Run the sweep and look at every shot**

```bash
pnpm dev --host 127.0.0.1 --port 3000 &
# wait for it to be listening, then:
OUT=/tmp/claude-1000/-home-daniel-Projects-storage-app/23dca17e-0249-49cb-bb2e-bce31931b811/scratchpad/shots \
  node /tmp/claude-1000/-home-daniel-Projects-storage-app/23dca17e-0249-49cb-bb2e-bce31931b811/scratchpad/shoot.mjs
```

Read every PNG. What you are looking for: clipped text, a header whose contents no longer line up with the body under it, a card stretched to a silly aspect ratio, a control sitting under the rail, an empty state adrift in the middle of a wide column, a chart that did not reflow.

**Kill the dev server when the sweep is done.** A leftover `pnpm dev` on :3000 makes `authCache.spec.ts` and `offline.spec.ts` fail together with `waitForFunction` timeouts, because `reuseExistingServer` hands the suite a server whose service worker a config change invalidated.

- [ ] **Step 7: Fix what the sweep found**

Breakpoint-prefixed additions only, same as everywhere else. If a fix needs a base class change, stop and say so rather than making it.

- [ ] **Step 8: Run the whole loop**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add app/pages/login.vue tests/e2e/responsive.spec.ts   # plus any sweep fixes
git commit -m "Centre the sign-in card and settle the wide-screen sweep"
```

---

### Task 6: Record what this taught us

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Add the lines**

`CLAUDE.md` is a failure log — every line exists because something went wrong at least once. Add these under **UI**, in the imperative, and keep the file under 200 lines:

```markdown
- Tablet and desktop are additive: every responsive class is `md:`- or `lg:`-prefixed and no base class changes. The 29 phone specs run at 412px and must stay green untouched. `AppNav` picks its rail or its pill with `v-if` on `useMediaQuery(DESKTOP)`, never `hidden lg:flex` — both navs in the DOM makes every `getByTestId('nav-*')` match two elements.
- `.sb-body` and `.sb-page` sit outside any `@layer`, so they beat Tailwind utilities: `lg:max-w-2xl` on a `.sb-body` element silently loses. Add a class in the same unlayered block (`.sb-measure-form`, `.sb-measure-article`) and declare it after `.sb-body` — they share specificity, so source order decides.
- `nav: false` hides the pill because it covers a screen's thumb zone; a side rail does not, so at `lg` those screens keep their navigation. `rail: false` is the opt-out for a screen that must stay chromeless at every width.
```

And under **Tests**:

```markdown
- Desktop layout has its own Playwright project (`desktop`) running only `responsive.spec.ts`; `mobile` ignores that file. The project sets an explicit viewport rather than `devices['Desktop Chrome']`, whose `channel: 'chrome'` needs real Chrome, and turns off `isMobile` / `hasTouch` by hand because the top-level `use` spreads Pixel 7.
```

- [ ] **Step 2: Check the length**

```bash
wc -l CLAUDE.md
```

Expected: under 200. If it is over, the fix is to tighten existing lines, not to drop one of these.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Record the responsive-layout rules in CLAUDE.md"
```
