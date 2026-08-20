# storage-app

Mobile-first PWA for tracking items in physical storage boxes. Each box gets a printable QR code; scanning it opens that box's item list.

**Read `docs/storage-app-prd.md` before implementing any feature.**
`docs/pocketbase-schema.md` is the human-readable schema reference; `pb_migrations/` is the source of truth. Never modify the shared `apps` / `app_memberships` collections.

## Stack

- Nuxt 4, SPA mode (`ssr: false`) — app code lives in `app/`
- Nuxt UI 4 + Tailwind 4, icons via `@nuxt/icon`
- `@vite-pwa/nuxt` for the service worker
- PocketBase 0.39.11 — auth, database, file storage
- `@peterbud/nuxt-query` / TanStack Query for server state
- Package manager: **pnpm**. Never npm or yarn.

## Local development

```bash
docker compose up -d   # PocketBase on :8090, migrations auto-apply
pnpm dev               # set NUXT_PUBLIC_POCKETBASE_URL=http://localhost:8090 in .env first
```

Seed realistic fixture data (idempotent, local only):

```bash
python3 scripts/pb-seed.py http://localhost:8090
```

Accounts: `dana@local.test` (owner, creates the boxes), `sam@local.test`
(member, editor on one box), `rae@local.test` (member, read-only),
`nobody@local.test` (no membership — the access-denied case). Password for all:
`storagedev123`.

Admin dashboard: <http://localhost:8090/_/> — `dev@local.test` / `devpassword123`
(seeded by compose; override with `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD`).
Local-only credentials, bound to loopback. `docker compose down -v` resets the
instance to a clean migrated state.

### Running an isolated stack (parallel worktrees)

Each worktree needs its own PocketBase and dev server, or concurrent
`pnpm test:e2e` runs collide. Pick a slot number per worktree, then:

```bash
PB_PORT=809<n> docker compose -p storage-<slot> up -d   # e.g. slot 1 -> PB_PORT=8091
# set NUXT_PUBLIC_POCKETBASE_URL=http://localhost:809<n> in that worktree's .env
python3 scripts/pb-seed.py http://localhost:809<n>
E2E_PORT=300<n> pnpm test:e2e
docker compose -p storage-<slot> down -v   # when done
```

The `-p` project name is what isolates the `pb_data` volume — a distinct
`PB_PORT` alone still shares one database across worktrees.

### Schema changes

`pb_migrations/` recreates every `storage_*` collection, creates
`apps` / `app_memberships` only if absent, and seeds the `apps` row with
`key = "storage"`. Import runs in extend mode, so unrelated collections on a
shared instance are never touched.

Schema edits are made in a PocketBase admin UI, then captured:

```bash
python3 scripts/pb-snapshot.py <url>   # rewrites the migration from a live instance
git diff pb_migrations/                # should show only the change you made
```

The snapshot strips per-instance timestamps, so a non-empty diff always means a
real schema change. Never hand-edit the generated migration.

## The loop

A task is not done until this is green.

```bash
pnpm lint        # eslint
pnpm typecheck   # vue-tsc, catches the any/as/! rules eslint does not
pnpm test        # vitest, unit, runs in the Nuxt environment
pnpm test:e2e    # playwright, boots and stops its own dev server
```

- Write the failing test first. Watch it fail for the right reason, then make it pass.
- Run the loop after every meaningful edit, not once at the end.
- Never report success on a red loop. Never skip or `.only` a test to get to green.
- If a test is wrong, say so and explain why before changing it.
- Run `pnpm nuxt prepare` before `pnpm typecheck` after any merge or branch switch. A stale `.nuxt/imports.d.ts` reports every auto-imported symbol as "Cannot find name" — phantom errors that vanish on regeneration.
- Don't leave `pnpm dev` running to "verify" — `test:e2e` manages its own server, and a stale one on `:3000` gets reused and produces confusing results.

## Rules

- v1 is offline **reads** only. No offline writes, no notifications, no voice notes — see PRD §3.
- Nuxt auto-imports are on. Don't write imports for composables, components, or `#app` utilities.

### PocketBase

- The URL comes from `runtimeConfig.public.pocketbaseUrl` (`NUXT_PUBLIC_POCKETBASE_URL`). Never hardcode a URL or commit credentials.
- **All reads and writes go through nuxt-query** (`useQuery` / `useMutation`). Never call `pb.collection().getList()` directly from a component — bypassing the query cache breaks offline reads.
- **Client-side permission checks are UX only.** Hiding an Edit button is not access control; the API rules are the real guard. Never assume a check in the UI makes an operation safe.
- **Always set the ownership field on create.** `created_by` on boxes, items and voice notes, `user` on comments — all must equal the authed user id. The create rules compare `@request.body.<field> = @request.auth.id`, and an omitted field resolves to empty and fails.
- **Never include an ownership field in an update.** The update rules use `:isset = false`, which rejects the payload if `created_by` / `user` is present *at all* — even set to the correct value. Send only changed fields; never spread a fetched record into `update()`.
- Paginate every list. Use `perPage` and `expand` for relations — never fetch all records to filter or join them client-side.
- Every write mutation calls `assertOnline()` first, and mutations run with `networkMode: 'always'` (set once in `nuxt.config.ts`). TanStack's default pauses a mutation offline: `mutationFn` never runs and the promise never settles, so the button hangs with no message.
- `useTags()` and `useAppUsers()` are the only deliberate `getFullList` exceptions — small bounded vocab/roster every picker needs whole. Leave them unpaginated.
- `app/queries/` is auto-imported via `imports.dirs` in `nuxt.config.ts`. Adding a new top-level `app/` directory does **not** auto-import it — only `composables/` and `utils/` are scanned by default.
- A deployed PocketBase must not sit behind Cloudflare Access on `/api/*`; browsers cannot complete a CORS preflight through it. Protect `/_/` instead.

### UI

- Use Nuxt UI components (`UButton`, `UModal`, `UInput`, `UCard`, …) before hand-rolling Tailwind. Reach for raw markup only when no component fits.
- Compress images with `browser-image-compression` before uploading. Never upload a raw camera file.
- Every screen needs a loading state and an empty state. Both are reachable on a phone with a slow connection, which is the primary target.
- Screenshot any screen you build and look at it before calling it done. Check the narrow viewport for clipped text and content under the safe area.

### TypeScript

- No `any`. If a type is genuinely unknown, use `unknown` and narrow it.
- No `as` to silence an error, and no non-null `!`. Fix the type or narrow properly.
- No `@ts-expect-error` without a comment naming the reason.

### Error handling

- No empty `catch`, no `catch { console.log(e) }`. Handle it meaningfully or let it propagate.
- PocketBase throws `ClientResponseError`; surface its message to the user rather than a generic "Something went wrong". A 403 usually means an API rule rejected the payload — check the ownership-field rules above before assuming a bug.
- Never swallow a failed mutation. If a write fails, the UI must say so and leave the user somewhere recoverable.

### Commits

- **Never add attribution footers.** No `Co-Authored-By`, no "Generated with Claude Code", no emoji trailers.
- Commit atomically — one logical change per commit. Don't batch unrelated work.

### Tests

- Every feature ships with tests: unit for composables and utils, e2e for user flows.
- Write the test before or alongside the implementation, never as a follow-up commit.
- E2E runs against the local PocketBase, never a hosted instance. Test the unhappy paths deliberately: offline read, expired session, duplicate submit.
- `describe.configure({ mode: 'serial' })` only orders one file. Spec files run in parallel, so a test must never mutate a seeded record — create the boxes and items it writes to.
- Put e2e fixture teardown in `test.afterEach`, not a `finally`: Playwright hard-kills a timed-out test and the `finally` never runs, leaving the fixture dirty for every later run.
- Call `pb.autoCancellation(false)` on a test's PocketBase client. The SDK cancels concurrent requests to the same endpoint, so a parallel fixture build silently keeps only the last write — and the cancelled ones still land server-side afterwards.
- Playwright blocks service workers (`playwright.config.ts`); only `offline.spec.ts` allows them. The dev service worker bypasses `page.route` stubs and serves a stale list back to a test that just wrote.
- Offline reads cannot be verified under `pnpm dev` — the dev service worker precaches only `/` and its navigation allowlist is `/^\/$/`. Verify by hand against a build: see `docs/testing-offline.md`.
- Use realistic seed data — real box and item names, long titles, empty lists. Never "Test User" or lorem ipsum.

## Ask before you assume

If a task leaves something open — which screen, what happens on failure, whether it needs a schema change — ask. One question up front is cheaper than half a day in the wrong direction.

- Ask when the request could reasonably mean two different things.
- Ask before changing the PocketBase schema or an API rule.
- Do not invent product decisions, copy, or acceptance criteria.
- Do not widen scope past what was asked. Note the adjacent thing you spotted; don't fix it unprompted.
- If you had to assume something you could not resolve, say so explicitly in your summary.

## Keeping this file current

This file is a failure log, not a wishlist. Every line exists because something went wrong at least once.

When you get corrected, or discover something about this repo that wasn't written down, add one line in the imperative describing the correct behaviour, and include it in the same commit. Keep it specific to this repo — general advice belongs nowhere.

Keep this file under 200 lines. It loads into every session, and long context makes you less reliable, not more.
