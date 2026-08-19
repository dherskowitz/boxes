# Design: Storage Boxes PWA — v1 + v1.1 Reporting

Date: 2026-08-19
Status: approved, ready for implementation planning
Source requirements: `docs/storage-app-prd.md`, `docs/pocketbase-schema.md`

## 1. Scope

Everything in PRD §10 (v1 acceptance criteria) plus §7.10 reporting (v1.1).

Explicitly out: voice notes (v2), offline writes, notifications, multi-tenant,
native app. The `storage_item_voice_notes` collection already exists in
`pb_migrations/` — it is left untouched and nothing is built against it.

## 2. Strategy

Ten feature slices built by subagents in isolated git worktrees, across three
waves. Parallelism is safe only because a serial **wave 0** ships the shared
contract first. Nothing in a feature wave may edit a wave 0 contract file.

The controlling risk is not feature complexity, it is three files that every
slice would otherwise touch: query keys, PocketBase types, and
`nuxt.config.ts`. Wave 0 owns all three permanently.

### 2.1 Barebones styling contract

Binding on every feature agent until a later styling phase:

- Nuxt UI components with default props (`UButton`, `UCard`, `UInput`, `UModal`, `UTable`, …).
- Layout primitives only: `flex`, `grid`, `gap-*`, `p-*`, `m-*`, `w-*`, `max-w-*`.
- No colour classes, no custom CSS, no additions to `app/assets/css/main.css`, no `app.config.ts` theme edits. Sole exception: `@media print` rules on the two print routes, where layout is functional rather than decorative.
- Every screen still needs a loading state and an empty state (PRD §8, CLAUDE.md). Barebones governs appearance, not completeness.
- The CLAUDE.md screenshot-review rule is suspended for these waves. Correctness is proven by Playwright assertions instead.

### 2.2 Definition of done, per slice

A slice is done when, in its own worktree, `pnpm lint && pnpm test && pnpm test:e2e`
is green, tests were written before implementation, and no file outside the
slice's declared ownership was modified.

## 3. Wave 0 — foundation (serial, main worktree)

No feature work begins until this is merged to `main` and green.

### 3.1 Types — `app/types/pocketbase.ts`

Hand-written interfaces for `storage_boxes`, `storage_items`, `storage_comments`,
`storage_tags`, `storage_box_permissions`, plus `users`, `apps`,
`app_memberships`, and the three `storage_report_*` views. Includes `expand`
shapes for the relations actually used (`box`, `tags`, `created_by`, `user`).

Rejected: `pocketbase-typegen`. A dependency plus a build step to generate ~70
lines of interfaces over a schema that changes rarely. Revisit if the schema
starts drifting from the types in practice.

### 3.2 Query keys — `app/queries/keys.ts`

A single exported `keys` object covering every collection and every query
variant used anywhere in the app (lists with filters, single records,
report views). Feature agents import from here and **never** define a key
inline. This is the primary conflict-prevention mechanism.

### 3.3 Query modules — `app/queries/*.ts`

One module per collection: `boxes.ts`, `items.ts`, `comments.ts`, `tags.ts`,
`permissions.ts`, `reports.ts`. Wave 0 creates each with the read composables
needed by more than one slice; each feature agent extends only the module
matching its slice.

All modules obey CLAUDE.md's PocketBase rules, which the spec restates because
they are the most common source of 403s:

- Reads and writes go through `useQuery` / `useMutation`. No `pb.collection().getList()` from a component.
- Every list paginates via `perPage`; relations resolve via `expand`, never client-side joins.
- Create mutations **must** set the ownership field (`created_by`, or `user` on comments) to the authed user id.
- Update mutations **must not** include the ownership field at all. Send only changed fields. Never spread a fetched record into `update()`.

### 3.4 Auth

- `app/composables/useAuth.ts` — login, logout, current user from `pb.authStore`, and a membership check requiring an `app_memberships` row with `enabled = true` whose `app.key = "storage"`.
- `app/middleware/auth.global.ts` — unauthenticated users redirect to `/login?redirect=<intended>`. This is what makes QR deep links (PRD §7.3) survive a login round-trip.
- `app/pages/login.vue` — email/password against PocketBase; distinct access-denied state for an authenticated user without enabled membership (PRD §7.1).

### 3.5 Shell — `app/layouts/default.vue`

Minimal nav: Boxes, Search, Tags, Reports, logout. Feature agents may add a nav
entry and nothing else in this file.

### 3.6 Route file layout

Because `/box/:qr_id` has children owned by other slices, wave 0 creates the
directory shape so no two agents invent a different one:

```
app/pages/box/[qr_id]/index.vue   # box detail        — slice A
app/pages/box/[qr_id]/print.vue   # printable label   — slice C
app/pages/box/[qr_id]/share.vue   # manage editors    — slice F
```

Wave 0 leaves `print.vue` and `share.vue` as placeholder stubs so the routes
resolve; the owning slices replace them.

### 3.7 Errors — `app/utils/pbError.ts`

`pbError(e: unknown): string` narrowing `ClientResponseError` to a user-facing
message, with `unknown` narrowing rather than `as`. Exists so ten agents do not
write ten variants of the same narrowing. Every mutation surfaces its result
through this helper; no failed write is swallowed.

### 3.8 Seed — `scripts/pb-seed.py`

Idempotent, matches the existing `scripts/pb-snapshot.py` in language and
invocation style. Seeds:

- Three users covering the permission matrix in PRD §10: a box **creator**, a **granted editor**, and a **plain member** with view-only access.
- Enabled `app_memberships` rows for each, with at least one `owner`/`admin` role so tag deletion (PRD §7.7) is testable.
- Realistic boxes, items, tags, and comments — real names and locations, long titles, and at least one empty box so empty states are reachable. Never "Test User" or lorem ipsum (CLAUDE.md).

### 3.9 E2E auth fixture

Playwright global setup logs in as each seeded role once and reuses
`storageState`, so tests do not repeat the login flow. Tests that mutate data
clean up after themselves; the seed is a fixed baseline, not per-test state.

### 3.10 Dependencies

Wave 0 installs everything the whole plan needs — currently just `nuxt-charts`
for the reporting screen. After wave 0, **no feature agent touches
`package.json` or `pnpm-lock.yaml`**, which removes the one merge conflict that
cannot be resolved by reading the diff.

### 3.11 Schema change — view collections

Two related additions, both **view** collections (read-only SQL projections with
no write surface), both additive `storage_*` collections. No shared collection
is modified.

#### `storage_app_users` — the member directory

Verified against the running instance: `users.listRule` and `users.viewRule` are
both `id = @request.auth.id`, so a user can only ever see themselves. Measured
consequences — `?expand=created_by` on a box and `?expand=user` on a comment both
return `expand: {}` for any record authored by someone else, and listing `users`
returns exactly one row. Separately, `app_memberships` has **no API rules at all**,
so it is superuser-only and a client cannot read even its own membership row.

That breaks PRD §7.5 (comments show their author), §7.2 (sharing page picks a user
to grant editor to), and §7.1 (client-side access-denied state).

The fix is one view collection scoped to this app:

```sql
SELECT
  u.id   AS id,
  u.name AS name,
  m.role AS role
FROM users u
JOIN app_memberships m ON m.user = u.id
JOIN apps a ON a.id IN (SELECT value FROM json_each(m.app))
WHERE m.enabled = TRUE AND a.key = 'storage'
```

`app` is a multi-relation, hence the `json_each` join. `listRule`/`viewRule` use
the standard enabled-membership gate.

This single collection answers four questions the app could not otherwise ask:
is the current user a member, what is their role (gating tag delete), what is a
given user id's display name (comments, creator labels), and who can be granted
editor rights. The client fetches it once and maps `id → name` locally; the
group is small and trusted, so a directory fetch is cheaper than per-record
expansion would have been anyway.

Confirmed by probe: a member sees every member with their role; a non-member and
an anonymous caller both receive an empty set. Note that a failing **list** rule
in PocketBase filters rows rather than returning 403, so "empty" is the correct
denial signal here, not an error.

#### `storage_report_*` — reporting aggregates

`storage_report_box_fill`, `storage_report_tag_usage`, and
`storage_report_growth` per PRD §6, gated by the same membership rule.

#### Procedure

All four are created via the admin API against the local instance, verified in
`http://localhost:8090/_/`, then captured with `python3 scripts/pb-snapshot.py`.
The generated migration is never hand-edited. The diff is reviewed before wave 1
starts. These are the only schema changes in the plan; any further change stops
and asks.

The three view collections in PRD §6 do not exist yet. Wave 0 creates
`storage_report_box_fill`, `storage_report_tag_usage`, and
`storage_report_growth` as PocketBase **view** collections (read-only SQL
projections) via the admin API against the local instance, verifies them in
`http://localhost:8090/_/`, then captures them with
`python3 scripts/pb-snapshot.py`. The generated migration is never hand-edited.

Their `listRule`/`viewRule` use the same enabled-membership gate as every other
`storage_*` collection.

The migration diff is reviewed before wave 1 starts. This is the only schema
change in the plan; any further change stops and asks.

## 4. Wave 1 — five parallel slices

| Slice | Routes / surface | Owns |
|---|---|---|
| **A · Boxes + Items** | `/`, `/box/new`, `/box/:qr_id`, `/item/:id` | `app/pages/index.vue`, `app/pages/box/new.vue`, `app/pages/box/[qr_id]/index.vue`, `app/pages/item/**`, `app/components/Box*`, `app/components/Item*`, extends `queries/boxes.ts` + `queries/items.ts` |
| **B · Tags** | `/tags` | `app/pages/tags.vue`, `app/components/TagPicker.vue`, `app/components/Tag*`, extends `queries/tags.ts` |
| **C · QR** | `/box/:qr_id/print`, `/print-sheet` | `app/pages/box/[qr_id]/print.vue` (stub replaced), `app/pages/print-sheet.vue`, `app/components/Qr*`, `app/utils/qrId.ts` |
| **D · PWA / offline** | no route | `nuxt.config.ts` `pwa` block, `app/components/OfflineBanner.vue`, `app/components/InstallPrompt.vue`, `app/composables/useOnline.ts` |
| **J · Reports** | `/reports` | `app/pages/reports.vue`, `app/components/Report*`, extends `queries/reports.ts` |

**A is deliberately one slice, not two.** Box detail hosts the item list and the
add-item action, so splitting boxes from items guarantees a conflict on the most
heavily edited file in the repo. Cohesion beats parallelism here.

Slice notes:

- **A** covers create-with-title-only, archive/unarchive (status flip, no deletion), and the "box not found" state for an unknown `qr_id` (PRD §7.3). Edit and archive controls render only for creator or granted editor — restated from CLAUDE.md, the UI check is UX, the API rule is the guard. Item images compress through `browser-image-compression` before upload; never a raw camera file.
- **B** builds `TagPicker.vue` as a standalone component with autocomplete and inline create, but does **not** wire it into the box or item forms. That wiring is wave 3, so B and A never edit the same file. Tag delete is gated on `app_memberships.role` in (`owner`, `admin`) and prompts with the usage count.
- **C** generates `qr_id` as 8 characters from `crypto.getRandomValues`, retrying once on a unique-constraint collision. QR payload is `{app_origin}/box/{qr_id}`. Scanner uses `vue-qrcode-reader` — see §7 on the PRD inconsistency. Print pages are the one place custom CSS is allowed, limited to `@media print` rules, because label layout is functional rather than decorative.
- **D** configures workbox `runtimeCaching`: stale-while-revalidate for `storage_boxes`/`storage_items`/`storage_comments` API responses, cache-first for PocketBase file storage capped at 200 entries / 30 days (PRD §7.8). The A2HS nudge handles `beforeinstallprompt` on Android and falls back to an instructional nudge on iOS Safari, which has no install-prompt API. Attempting a write while offline shows a clear "requires connectivity" message rather than failing silently.
- **J** reads only the three view collections — tens of rows, never full record sets reduced in the browser. The single permitted client-side grouping is the locations donut. Every chart has an explicit empty state, because a fresh instance has zero of everything and an empty chart reads as broken. The screen is online-only and shows a needs-connection state offline, since partial aggregates would mislead. Archived boxes are included but visually distinguished, and excluded from the items-per-box ranking. No export, no date range, no drill-through.

## 5. Wave 2 — three parallel slices

Each adds exactly one section or link to a wave 1 page, in a declared region.

| Slice | Surface | Owns | Touches |
|---|---|---|---|
| **E · Comments** | thread on `/item/:id` | `app/components/Comment*`, extends `queries/comments.ts` | appends thread to `pages/item/[id].vue` |
| **F · Sharing** | `/box/:qr_id/share` | `app/pages/box/[qr_id]/share.vue` (stub replaced), `app/composables/useCanEdit.ts`, extends `queries/permissions.ts` | adds a Share link to box detail |
| **G · Search** | `/search` | `app/pages/search.vue`, `app/components/SearchBar.vue` | adds the search bar to `pages/index.vue` |

- **E**: any member comments; only the author edits or deletes their own. Unread tracking uses a per-item `localStorage` timestamp — PRD §11 leaves the mechanism to the implementer, and a persisted field would cost a second schema change for a badge.
- **F**: creator-only. Lists current editors from `storage_box_permissions`, adds an editor by selecting from users with app access, removes an editor. `useCanEdit` centralises the creator-or-granted-editor test so slices stop re-deriving it.
- **G**: searches box titles, item titles, item descriptions, and item notes; results distinguish boxes from items and link to the right detail page. Archived boxes and their items are excluded by default. Filtering runs in the PocketBase query, not the browser.

## 6. Wave 3 — two parallel slices

| Slice | Work |
|---|---|
| **H · Tag wiring** | Mount `TagPicker` in the box and item forms; add tag filter chips to the box index and search results. Depends on A, B, and G. |
| **I · Bulk move** | Multi-select on box detail, move selected items to another box in one action. Depends on A. |

## 7. Decisions and assumptions

- **Unread comments** → per-item `localStorage` timestamp. Not cross-device; a PocketBase field is the upgrade path if that matters.
- **`qr_id`** → 8 chars from `crypto.getRandomValues`, one retry on collision. Kept short and typeable, per the PRD §11 note about a manual fallback entry point.
- **QR scanner library** → `vue-qrcode-reader`. The PRD is internally inconsistent: §5 specifies `vue-qrcode-reader`, which is what `package.json` installs, while §7.3 names `qr-scanner`/`html5-qrcode`. Going with the installed one.
- **`storage_item_voice_notes`** → already present in `pb_migrations/` even though PRD §3 says not to scaffold it in v1. Left exactly as is; no code references it.
- **Merge flow** → each agent finishes in its worktree; the full loop runs on the merged result before it lands on `main`; a summary follows each wave.
### 7.1 Verified against the running instance

These were probed during planning, not assumed. `docs/pocketbase-schema.md` is
stale on several points; **`pb_migrations/` is the source of truth** and the
plan follows it.

- Back-relations `app_memberships_via_user` and `storage_box_permissions_via_user` resolve correctly. The schema doc's "Known Uncertainty" section is resolved — nothing needs to plan around it.
- The permission matrix behaves as specified: a plain member lists every box, is blocked from editing another user's box (404), and is blocked from adding an item to it (400).
- `app_memberships.role` values are `owner` / `admin` / `member` / **`readonly`** — the schema doc says `reader`, which is wrong.
- `storage_boxes.description`, `storage_items.description`, and `storage_items.notes` are **`editor`** (rich text) fields, not plain text. Barebones UI uses a plain `UTextarea` against them.
- **`storage_boxes.status` has no default.** Every box create must send `status: 'active'` explicitly, or the record lands with an empty status and vanishes from the index filter. This is the single easiest bug to ship in this codebase.
- `storage_boxes` **delete** is creator-only; a granted editor can edit a box and delete its items, but cannot delete the box itself.
- `storage_items` **create** requires box creator or granted editor, so a plain member cannot add items to someone else's box.
- `images` `maxSelect` is 15 on boxes and 99 on items.
- `storage_tags` delete is already gated on `owner`/`admin` in the migration, matching PRD §7.7 with no rule change needed.

## 8. Testing

Per CLAUDE.md: the failing test comes first, and the loop
(`pnpm lint`, `pnpm test`, `pnpm test:e2e`) runs after every meaningful edit,
not once at the end. Unit tests cover composables and utils; e2e covers user
flows against the local PocketBase, never a hosted instance.

Unhappy paths are deliberate, not incidental: offline read of a
previously-viewed box, expired session, duplicate submit, a non-creator
attempting an edit, an unknown `qr_id`, and a tag delete by a member without
`owner`/`admin`.
