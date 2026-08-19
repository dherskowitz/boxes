# storage-app

Mobile-first PWA for tracking items in physical storage boxes. Each box gets a printable QR code; scanning it opens that box's item list.

**Read `docs/storage-app-prd.md` before implementing any feature.**
`docs/pocketbase-schema.md` is the live schema — collections already exist, do not modify `apps` / `app_memberships`.

## Stack

- Nuxt 4, SPA mode (`ssr: false`) — app code lives in `app/`
- Nuxt UI 4 + Tailwind 4, icons via `@nuxt/icon`
- `@vite-pwa/nuxt` for the service worker
- PocketBase (separate host) — auth, database, file storage
- `@peterbud/nuxt-query` / TanStack Query for server state
- Package manager: **pnpm**. Never npm or yarn.

## Rules

- v1 is offline **reads** only. No offline writes, no notifications, no voice notes — see PRD §3.
- Nuxt auto-imports are on. Don't write imports for composables, components, or `#app` utilities.

### PocketBase

- The PocketBase URL comes from `runtimeConfig.public.pocketbaseUrl` (`NUXT_PUBLIC_POCKETBASE_URL`). Never hardcode a URL or commit credentials.
- **All reads and writes go through nuxt-query** (`useQuery` / `useMutation`). Never call `pb.collection().getList()` directly from a component — bypassing the query cache breaks offline reads.
- **Client-side permission checks are UX only.** Hiding an Edit button is not access control; PocketBase API rules are the real guard. Never assume a check in the UI makes an operation safe.
- **Always set the ownership field on create.** `created_by` on boxes, items and voice notes, `user` on comments — all must equal the authed user id. The create rules compare `@request.body.<field> = @request.auth.id`, and an omitted field resolves to empty and fails.
- **Never include an ownership field in an update.** The update rules use `:isset = false`, which rejects the payload if `created_by` / `user` is present *at all* — even set to the correct value. Send only changed fields; never spread a fetched record into `update()`.

### UI

- Use Nuxt UI components (`UButton`, `UModal`, `UInput`, `UCard`, …) before hand-rolling Tailwind. Reach for raw markup only when no component fits.
- Compress images with `browser-image-compression` before uploading to PocketBase. Never upload a raw camera file.

### Commits

- **Never add attribution footers.** No `Co-Authored-By`, no "Generated with Claude Code", no emoji trailers.
- Commit atomically — one logical change per commit. Don't batch unrelated work.

### Tests

- Every feature ships with tests. Aim for full coverage: unit tests for composables and utils, e2e tests for user flows.
- Write the test before or alongside the implementation, never as a follow-up commit.
- Unit: `pnpm test` (Vitest, `tests/unit/*.spec.ts`, runs in the Nuxt environment).
- E2E: `pnpm test:e2e` (Playwright, `tests/e2e/*.spec.ts`, emulates Pixel 7 — this is a mobile-first app).
- Lint: `pnpm lint`.
