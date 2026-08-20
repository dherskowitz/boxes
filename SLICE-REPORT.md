# Slice D — PWA / Offline

Branch `slice-d`. Everything below was observed, not inferred.

## Loop results

| Step | Result |
|---|---|
| `pnpm lint` | pass |
| `pnpm typecheck` | pass |
| `pnpm test` | pass — 9 files, 54 tests |
| `E2E_PORT=3005 pnpm test:e2e` | **red** — 2 structural failures in `tests/e2e/offline.spec.ts`, plus load-induced flakes in `auth.spec.ts` |

`.output/` must not be left in the worktree when running `pnpm test`. With a build
present the Nuxt test environment exceeds its 30s hook timeout under load and 5 of
9 files fail to start. `rm -rf .output` and they pass.

### Which e2e tests actually ran

Neither offline test can pass on this branch. **Both were left in place.**

- `offline.spec.ts:5` *a previously-viewed box still opens with no network* — navigates
  to `/box/seedbox1`. `app/pages/box/[qr_id]/index.vue` does not exist here (only
  `print.vue` and `share.vue`), so the router logs `No match found for location with
  path "/box/seedbox1"` and the assertion fails on the box title, before it ever
  reaches the offline behaviour. Needs slice A/B.
- `offline.spec.ts:27` *a write attempted offline says it needs connectivity* — needs
  slice A's `/box/new`. It times out waiting for the Title field. Not deleted, not faked.

`auth.spec.ts` is flaky under the current machine load, not broken by this slice. Run
alone it is 12/12 green. Across three full-suite runs it failed 1, 0 and 2 tests, a
different set each time — cold Vite route compiles exceeding the 15s expect timeout
while four other slices build concurrently.

The offline behaviour itself was therefore verified out-of-band with a throwaway
Playwright script against a real build (see below), not by the committed e2e tests.

## Mount lines for `app/layouts/default.vue`

I do not own that file; neither component is mounted anywhere yet. Place both inside
`<main>`, above the membership branches, so they are visible even when the directory
gate is showing an error:

```vue
<OfflineBanner />
```

```vue
<InstallPrompt />
```

Auto-imported, no props, no events, no imports needed.

## Write guard signature

`app/composables/useOnline.ts`:

```ts
export function assertOnline(): void
```

Throws `Error('This action needs an internet connection. Reconnect and try again.')`
when offline; returns `void` otherwise. Call it as the first statement of a mutation
handler. The thrown message flows through `pbError()` unchanged, so no extra handling
is required at the call site. There is also `useOnline(): { isOnline: Ref<boolean> }`
for reactive UI; `assertOnline` is the one slices A, B, E and F need.

## PWA icons — needs a human decision

**No icons are generated, and there is no source icon to generate them from.**

`public/` contains only `favicon.ico` and `robots.txt`. The built
`manifest.webmanifest` has **no `icons` key at all**, and `.output/public` contains no
PNG. Android will refuse the install prompt without 192px and 512px icons, so
`beforeinstallprompt` will not fire in production as it stands.

I did not add a placeholder. This needs a real source icon (512px+ square PNG or SVG)
dropped in `public/`, then `pwa.manifest.icons` wired to it. Product decision, not mine
to invent.

## Install-prompt coverage

Covered by `tests/nuxt/InstallPrompt.spec.ts`:

- install button appears after `beforeinstallprompt` fires
- iOS instructional fallback when there is no install-prompt API
- renders nothing when already running standalone
- stays dismissed across remounts (localStorage)

**Needs a real device / cannot be unit tested:** the `prompt()` call itself and its
`userChoice` outcome (Chromium only shows the native sheet on a real installable
origin), and the actual iOS Share → Add to Home Screen flow. Also untestable here:
whether Android fires `beforeinstallprompt` at all — it will not until the icons above
exist.

## Is `storage_app_users` genuinely cached offline?

**Yes — but only after a fix, and only in a `pnpm generate` build. It was completely
broken as originally committed.**

Verified by driving a real browser against a real build: prime `/` online, confirm the
SW controls the page, reload online, inspect `caches`, then `setOffline(true)` and
reload.

Two defects, both found this way:

1. **Cross-origin RegExp never matched (fixed, commit `79e26cb`).** Workbox skips a
   RegExp runtime-caching route for a cross-origin request unless the pattern matches
   from the *start of the full URL*. PocketBase is always a different origin from the
   app, so `/\/api\/collections\/storage_[^/]+\/records/` matched nothing — the
   `pb-api-storage` and `pb-files` caches were never even created. Both patterns are
   now anchored as `/^https?:\/\/[^/]+\/api\/...`.

2. **`nuxt build` never precaches the app shell (not fixed — outside this slice).**
   `navigateFallback: '/'` compiles to `createHandlerBoundToURL("/")`, but with
   `ssr: false` a plain `nuxt build` emits **no `index.html`** into `.output/public`,
   so `/` is absent from the precache manifest and offline navigation dies with
   `ERR_INTERNET_DISCONNECTED`. `pnpm generate` emits `index.html` / `200.html` /
   `404.html`, `/` enters the precache (40 entries vs 36), and offline navigation
   works.

   **The deploy must use `pnpm generate`, or `nuxt build` must be given
   `nitro.prerender.routes: ['/']`.** I did not add that key — I own the `pwa` block
   only, and the build/deploy target is a human call.

With the fix, on a `generate` build:

```
CACHE NAMES: ["workbox-precache-v2-...", "pb-api-storage"]
pb-api-storage :: http://localhost:8095/api/collections/storage_app_users/records?...
OFFLINE NAVIGATION SERVED: true
OFFLINE RESULT: accessDenied=false membershipError=false pending=false
```

i.e. the layout's membership gate resolves from cache offline and renders the app
shell rather than access-denied.

### Caveats the merge step must know

- **Dev server offline reads do not work, at all.** Under `pnpm dev` the SW never takes
  control of the page and no API response is cached (`SW CONTROLS PAGE: false`,
  `pb-api-storage` absent). Any e2e test of offline reads must run against a
  `generate` build, not the dev server the current `playwright.config.ts` boots. The
  committed `offline.spec.ts` would not pass against the dev server even once slices
  A/B land their pages.
- **First load after a fresh install caches nothing.** The SW claims the client only
  after the first API request has already gone out, so the directory is cached from the
  *second* page load onward. A user who installs and immediately goes offline gets
  access-denied. Acceptable for v1; worth knowing.
- `/api/collections/users/auth-with-password` is deliberately not matched — the auth
  endpoint always hits the network.

## nuxt.config.ts

Only the `pwa` block changed. `modules`, `imports`, `runtimeConfig`, `css`, `ssr`,
`nuxtQuery`, `compatibilityDate` and `devtools` are untouched (`git diff 05ca66a..HEAD
-- nuxt.config.ts`).

## Commits

- `bfdccfa` online/offline signal composable
- `19e859c` offline caching strategies for API and image responses
- `0bc92f9` offline banner
- `7dd68e1` install prompt with iOS instructional fallback
- `2c68911` offline read and offline write-refusal tests
- `a23ac56` Skip the unused maplibre-gl native build
- `79e26cb` Anchor the runtime cache patterns at the origin

## Review fix: `assertOnline()` leaked window event listeners

`assertOnline()` called `@vueuse/core`'s `useOnline()`, which registers two
`window` `online`/`offline` listeners per call via `useEventListener`. Vue only
disposes those automatically inside an active component effect scope
(`setup()`); `assertOnline()` runs as the first statement of a mutation
handler, outside `setup()`, so every mutation leaked two more listeners for
the life of the tab — invisible to `tests/nuxt/useOnline.spec.ts` because it
mocked `@vueuse/core` wholesale.

Fixed by reading `navigator.onLine` directly for this one-shot check — no
subscription needed. `useOnline()` (the reactive composable used by
`OfflineBanner` / `InstallPrompt`) is unchanged: it is created once inside a
long-lived component's `setup()`, where Vue does dispose it correctly.

Added a regression guard in `tests/nuxt/useOnline.spec.ts` that unmocks
`@vueuse/core` (`vi.doUnmock` + `vi.resetModules`, re-importing the
composable fresh) and spies on `window.addEventListener` across 50 calls to
`assertOnline()`, asserting zero calls. Verified this guard actually fails
against the old implementation before restoring the fix — with the buggy
code it caught 100 real listener registrations (2 per call × 50).
