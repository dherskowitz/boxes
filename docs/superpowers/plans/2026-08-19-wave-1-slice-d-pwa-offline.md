# Slice D — PWA / Offline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app installable on a phone and make a previously-viewed box open with zero network — title, items, and images — while being honest about what cannot be done offline.

**Architecture:** No routes and almost no UI. This slice is service-worker caching strategy, an online/offline signal, and two small components. The offline guarantee is **reads only**: a write attempted offline must say so clearly rather than failing silently or appearing to succeed.

**Tech Stack:** Nuxt 4 SPA, `@vite-pwa/nuxt` (Workbox), Nuxt UI 4, Vitest, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-19-storage-app-v1-design.md`
**Contract:** `docs/superpowers/wave-0-interface-surface.md` — read first.
**Coordination:** `docs/superpowers/plans/2026-08-19-wave-1-overview.md`

## Global Constraints

- Package manager is **pnpm**. Never npm or yarn. **Do not add a dependency** — `@vite-pwa/nuxt` is already installed and registered.
- **Done means** `pnpm lint && pnpm test && pnpm test:e2e` green in your worktree. TDD: failing test first. Never `.skip`/`.only`, never weaken a test. E2E is flaky under machine load — re-run before concluding red.
- **No `any`**, no `as` to silence an error, no non-null `!`.
- Nuxt auto-imports are on. `import type` IS required.
- **Barebones styling.** Nuxt UI defaults, layout primitives only. No colour classes, no custom CSS.
- Surface failures through `pbError(e)`.
- Commits: no attribution footers, no emoji trailers.
- **You own** the `pwa` block of `nuxt.config.ts`, `app/components/OfflineBanner.vue`, `app/components/InstallPrompt.vue`, and `app/composables/useOnline.ts`. **You do not own the rest of `nuxt.config.ts`** — do not touch `modules`, `imports`, `runtimeConfig`, `css`, or `ssr`. If you believe you need to, stop and report.

## The constraint that shapes this slice

**v1 is offline reads only.** No offline writes, no background sync, no queued mutations. PRD §3 is explicit and CLAUDE.md repeats it. Do not build a mutation queue, an outbox, or optimistic offline writes — that is v2 scope and building scaffolding for it now is exactly what the PRD says not to do.

What you must deliver instead is honesty: when the user is offline and tries to write, the UI says the action needs connectivity, and leaves their input intact.

## A dependency you should know about

The app shell renders inside `app/layouts/default.vue`, which gates every page on the `storage_app_users` membership directory. If that query cannot resolve offline, **every screen shows a membership state instead of content**, and this slice's offline guarantee is unreachable no matter what you cache.

Wave 0's fix wave addressed the error-vs-denied confusion in that layout. Your caching must still make the directory query resolve from cache offline, or the guarantee fails at the layout before it reaches any page. **Verify this explicitly in Task 4** — it is the single most likely way this slice ships looking correct and being useless.

---

### Task 1: Online/offline signal

**Files:**
- Create: `app/composables/useOnline.ts`
- Test: `tests/nuxt/useOnline.spec.ts`

**Interfaces:**
- Produces: `useOnline(): { isOnline: Ref<boolean> }`.

`@vueuse/core` is already a dependency and ships `useOnline`. Use it rather than hand-rolling `navigator.onLine` listeners — but wrap it, because `navigator.onLine` is famously optimistic: it reports `true` for a device connected to a router with no internet. The wrapper is where a future reachability check would go, and where the app gets a single import site.

Keep the wrapper thin. Do **not** build a polling reachability probe now — nothing in v1 needs that precision, and a probe that runs on a metered phone connection is a real cost.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'

const onlineRef = ref(true)
vi.mock('@vueuse/core', () => ({ useOnline: () => onlineRef }))

const { useOnline } = await import('~/composables/useOnline')

describe('useOnline', () => {
  it('reports the browser state', () => {
    onlineRef.value = true
    expect(useOnline().isOnline.value).toBe(true)
  })

  it('reacts when the browser goes offline', () => {
    onlineRef.value = false
    expect(useOnline().isOnline.value).toBe(false)
  })
})
```

- [ ] **Step 2: Run and watch it fail**

- [ ] **Step 3: Implement**

Include a comment naming the `navigator.onLine` limitation and why no probe exists yet, so the next reader does not "fix" the thin wrapper by deleting it.

- [ ] **Step 4: Run and watch it pass**

- [ ] **Step 5: Commit**

```bash
git add app/composables/useOnline.ts tests/nuxt/useOnline.spec.ts
git commit -m "Add online/offline signal composable"
```

---

### Task 2: Service worker caching strategy

**Files:**
- Modify: the `pwa` block of `nuxt.config.ts` only

This is the substance of the slice. PRD §7.8 specifies the strategies precisely:

- **App shell** — precached, so the app loads with no network. `globPatterns` already covers this; verify it includes everything the shell needs.
- **PocketBase API responses** for `storage_boxes`, `storage_items`, `storage_comments` — **stale-while-revalidate**. Cached data displays instantly and refreshes in the background when online.
- **PocketBase file storage (images)** — **cache-first**, capped at roughly 200 entries and 30 days.

Add `runtimeCaching` entries under `workbox`. The PocketBase origin comes from `NUXT_PUBLIC_POCKETBASE_URL` and differs between dev and production, so match on **URL shape**, not a hardcoded host — `/api/collections/storage_...` for records and `/api/files/` for images.

Two things worth getting right:

1. **Also cache `storage_app_users`** — the membership directory. See the dependency note above; without it the layout gates every page offline and nothing else you cache matters.
2. **Do not cache the auth endpoint.** `/api/collections/users/auth-with-password` must always hit the network. A cached auth response is a security problem, not a feature.

The manifest already exists with name, short name, theme colour, and `display: standalone`. PRD §7.9 additionally requires **192px and 512px icons minimum**. Check whether `@vite-pwa/nuxt` is generating them from a source image; if there is no source icon in `public/`, say so in your report rather than inventing artwork — that is a decision for the human, not something to fake with a placeholder.

- [ ] **Step 1: Verify the current state before changing anything**

```bash
grep -A 25 "pwa:" nuxt.config.ts
ls public/
```

Record what already exists so your report can be specific about what you changed.

- [ ] **Step 2: Add the runtime caching rules**

- [ ] **Step 3: Verify the service worker actually registers and precaches**

Build and inspect, rather than trusting config:

```bash
pnpm build
ls .output/public/sw.js .output/public/workbox-*.js
grep -c "precache" .output/public/sw.js
```

State in your report what you actually observed.

- [ ] **Step 4: Commit**

```bash
git add nuxt.config.ts
git commit -m "Add offline caching strategies for API and image responses"
```

---

### Task 3: Offline banner and write guard

**Files:**
- Create: `app/components/OfflineBanner.vue`

Required behaviour (PRD §7.8, §8):
- A **non-blocking** indicator when offline. Non-blocking is the requirement — it must not cover content or trap focus, because the whole point is that the user can still read.
- `data-testid="offline-banner"`.
- Copy that tells the user what still works: they can browse what they have already viewed, but cannot create or edit until they reconnect.

The banner is rendered from the default layout — which **you do not own**. Build the component so it can be dropped in with a single line, and state in your report exactly what that line is. Slice A or the merge step adds it. Do not edit the layout yourself.

Also required: a reusable way for write paths to refuse offline. Export a small helper from `useOnline.ts` — for example `assertOnline()` that throws a clear `Error` when offline — so the slices that own mutations have one obvious thing to call, and their `pbError` handling surfaces the message with no extra work. Document it in your report; slices A, B, E and F will each need it.

- [ ] **Step 1: Write the failing test**

Cover: the banner renders when offline, does not render when online, and `assertOnline()` throws a message naming connectivity when offline and does nothing when online.

- [ ] **Steps 2-4: Fail, implement, pass**

- [ ] **Step 5: Commit**

```bash
git add app/components/OfflineBanner.vue app/composables/useOnline.ts tests/nuxt/
git commit -m "Add offline banner and write guard"
```

---

### Task 4: Prove the offline read guarantee

**Files:**
- Test only: `tests/e2e/offline.spec.ts`

This is the acceptance criterion from PRD §10 stated almost verbatim: *"After viewing a box once while online, opening that same box with the device in airplane mode still shows its title, items, and images."*

An offline feature that is never tested offline is not a feature. Playwright can simulate this with `context.setOffline(true)`.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from '@playwright/test'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

test('a previously-viewed box still opens with no network', async ({ page, context }) => {
  // Prime the cache while online.
  await page.goto('/box/seedbox1')
  await expect(page.getByText('Winter coats and boots')).toBeVisible()
  await expect(page.getByText('Navy wool peacoat')).toBeVisible()

  await context.setOffline(true)
  await page.reload()

  // The layout gates every page on the membership directory — if that is not
  // cached, this fails here rather than on the box content, which is the whole
  // reason this assertion comes first.
  await expect(page.getByTestId('access-denied')).toBeHidden()
  await expect(page.getByTestId('membership-error')).toBeHidden()

  await expect(page.getByText('Winter coats and boots')).toBeVisible()
  await expect(page.getByText('Navy wool peacoat')).toBeVisible()
  await expect(page.getByTestId('offline-banner')).toBeVisible()

  await context.setOffline(false)
})

test('a write attempted offline says it needs connectivity', async ({ page, context }) => {
  await page.goto('/box/new')
  await context.setOffline(true)
  await page.getByLabel('Title').fill('Loft bedding')
  await page.getByRole('button', { name: 'Create box' }).click()

  await expect(page.getByText(/connect/i)).toBeVisible()
  // The user's input must survive — losing it is the failure PRD §7.8 forbids.
  await expect(page.getByLabel('Title')).toHaveValue('Loft bedding')

  await context.setOffline(false)
})
```

- [ ] **Step 2: Run and watch it fail**

- [ ] **Step 3: Make it pass**

Note the service worker does not run in Nuxt's dev server the same way it does in a build. `devOptions.enabled` is already `true` in the config, so it should — verify it actually does. If the offline test can only pass against a preview build, **say so and report it** rather than deleting the test. A test that only works against production build output is still worth having; it just needs its own script.

The second test depends on slice A's `/box/new` page, which may not exist in your worktree. If so, write the test, mark clearly in your report that it cannot run until slice A merges, and **do not** delete it or fake a passing version. Say plainly which of the two tests you actually saw pass.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/offline.spec.ts
git commit -m "Add offline read and offline write-refusal tests"
```

---

### Task 5: Install prompt

**Files:**
- Create: `app/components/InstallPrompt.vue`

Required behaviour (PRD §7.9):
- A lightweight "add to home screen" nudge on first visit.
- **Android/Chromium**: capture the `beforeinstallprompt` event, suppress the default, and offer an install button that calls `prompt()`.
- **iOS Safari has no install-prompt API at all.** It needs an instructional nudge instead — "tap Share, then Add to Home Screen". The PRD calls this out specifically, so detecting iOS and showing different content is required, not optional.
- Dismissible, and **stays dismissed** — persist that in `localStorage`. A nudge that returns on every visit is an irritation, not a feature.
- Do not show it when the app is already running installed (`display-mode: standalone`).

Like the banner, this renders from the layout you do not own. Build it drop-in, state the line, and let the merge step place it.

- [ ] **Step 1: Write the failing test**

Cover the three branches — installable (event captured), iOS (instructional copy), already-installed (renders nothing) — and that dismissal persists.

- [ ] **Steps 2-4: Fail, implement, pass**

- [ ] **Step 5: Commit**

```bash
git add app/components/InstallPrompt.vue tests/nuxt/installPrompt.spec.ts
git commit -m "Add install prompt with iOS instructional fallback"
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

- [ ] **Step 2: Confirm you stayed inside your ownership**

```bash
git diff --name-only main...HEAD
```

Only your three components/composables, the `pwa` block of `nuxt.config.ts`, and your tests. Check the `nuxt.config.ts` diff line by line — nothing outside the `pwa` block.

- [ ] **Step 3: Report what is proven and what is not**

Be specific and honest:
- Did the offline read test pass against the dev server, or only a preview build?
- Are 192px and 512px icons actually generated, or is there no source icon?
- Which install-prompt branches were tested, and which need a real device?

A reviewer reading "all green" without these caveats would reasonably conclude the app was proven installable on a phone. It will not have been.

- [ ] **Step 4: Report the drop-in lines**

State the exact single line that mounts `OfflineBanner` and `InstallPrompt` in `app/layouts/default.vue`, and the signature of `assertOnline()`. Slices A, B, E and F all need the latter for their write paths.

## Self-Review

**Spec coverage.** PRD §7.8 app-shell precache → Task 2; API stale-while-revalidate → Task 2; images cache-first with caps → Task 2; offline read of a viewed box → Task 4; no offline writes, clear message instead → Tasks 3 and 4; §7.9 manifest and icons → Task 2; installable → Task 5; iOS instructional nudge → Task 5; §8 non-blocking staleness indicator → Task 3.

**Deliberately out of scope.** Any form of offline write — queue, outbox, background sync, optimistic mutation. PRD §3 defers all of it, and §11 says not to build scaffolding for deferred features.

**Known risk.** This slice is the easiest in the wave to ship in a state that looks correct and does nothing. Config that reads plausibly, a banner that renders, and a green suite can all coexist with an app that fails completely in airplane mode. Task 4 exists to make that impossible to fake, and the membership-directory assertion inside it is the specific trap — cache everything else perfectly and miss that one request, and every screen shows a membership state offline.
