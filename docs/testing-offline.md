# Testing offline reads by hand

The automated offline-read test (`tests/e2e/offline.spec.ts`, "a previously-viewed
box still opens with no network") **cannot pass against the dev server**, and is
left failing on purpose rather than deleted or skipped. This document is how to
verify the feature until that gap is closed.

## Why the automated test can't run under `pnpm dev`

Verified by dumping the dev service worker at `/dev-sw.js?dev-sw`:

- Its precache manifest is exactly `[{ url: '/' }]`. `globPatterns` is applied at
  build time only, so no JS, CSS, or route shell is precached in dev.
- Its navigation route carries a dev-only `allowlist: [/^\/$/]`, so `/box/<qr_id>`
  is never served from cache.

Reloading a box page offline therefore fails with `ERR_INTERNET_DISCONNECTED`
regardless of whether the caching config is correct.

Closing it properly needs a second Playwright project running against built
output on its own port, with `auth.setup.ts` re-run for that baseURL — Playwright
scopes `storageState` per origin. That is deliberately deferred.

## Verify it by hand instead

A production build precaches the whole shell (84 entries, including `/`), so the
feature genuinely works there.

```bash
pnpm preview:offline        # nuxt build && nuxt preview, serves on :3000
```

Make sure PocketBase is running and seeded first:

```bash
docker compose up -d
python3 scripts/pb-seed.py http://localhost:8090
```

Then, in Chrome:

1. Open <http://localhost:3000> and sign in as `dana@local.test` / `storagedev123`.
2. Open a box — <http://localhost:3000/box/seedbox1> — and let its items and any
   images load. This is what primes the cache.
3. DevTools → **Application** → **Service Workers**: confirm one is **activated
   and running**. If it says "waiting", tick *Update on reload* and refresh once.
4. DevTools → **Network** → set throttling to **Offline**.
   *(The **Application → Service Workers → Offline** checkbox also works. Do not
   use airplane mode on the host — the app and PocketBase are both on localhost
   and would stay reachable.)*
5. Reload the page.

### What should happen

- The box title, its item list, and any images render from cache.
- The offline banner appears, inline above the content — it must not cover
  anything, because the point is that you can still read.
- Navigating to another **previously visited** box works.
- A box you have never opened does not — v1 caches what you have seen, nothing more.

### The failure worth watching for

If the screen shows the **access-denied** or **membership-error** state instead of
the box, the `storage_app_users` directory is not being cached. The default layout
gates every page on that request, so missing it makes the entire offline feature
useless no matter how well boxes and items are cached. That is the single most
important thing this manual pass checks.

## Also check that writes refuse honestly

Still offline, from step 4:

1. Go to `/box/new`, type a title, and press **Create box**.
2. You should get a visible message that the action needs a connection, the
   button should return to enabled, and **your typed title must still be there**.

v1 has no offline writes by design (PRD §3). The requirement is an honest refusal
that loses nothing — not a queue.

## Clearing state between attempts

DevTools → Application → **Storage** → *Clear site data*. Re-priming from step 1
is required afterwards, since the cache is exactly what is under test.
