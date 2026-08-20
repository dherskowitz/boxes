# PRD: Storage Boxes PWA

## 1. Summary

A mobile-first Progressive Web App for tracking items kept in physical storage boxes. Each box has an auto-generated QR code that can be printed and stuck to the physical box. Scanning the code opens the app directly to that box's contents. Multiple people share one common pool of boxes (no multi-tenant/household concept needed).

## 2. Goals

- Let a user create a "box" record with optional title, description, and images, and get a printable QR code for it.
- Scanning a box's QR code opens the app directly to that box's item list, even with no network signal (if previously viewed).
- Let users add items to a box, each with title, description, notes, and photos.
- Let users find things fast via search across box/item titles, descriptions, and notes.
- Support light collaboration: comments on items, and box-level edit permissions beyond the box creator.

## 3. Non-Goals (out of scope for v1)

- Reminders/notifications of any kind (date-based, recurring, or push).
- **Voice notes on items** — recording/playback of audio notes, kept separate from the text description field. Deferred to v2. Design intent: multiple voice recordings per item over time (a running audio log, not a single slot), stored via a `storage_item_voice_notes` collection (see `pocketbase-schema.md`, already scoped but not built in v1).
- Offline **writes** — creating/editing while offline. v1 only guarantees offline **reads** of previously-viewed data.
- Multi-tenant support (separate isolated groups within one deployment). All app members share one pool of boxes.
- Native mobile app — this is PWA-only.
- **Reporting screen** — deferred to v1.1. Specified in §7.10; not part of the v1 acceptance criteria.

## 4. Users & Access Model

All users are members of a shared PocketBase instance that also hosts other apps. Access to this specific app is controlled by an existing `app_memberships` collection (see `pocketbase-schema.md`):

- A user must have an **enabled** `app_memberships` row referencing this app (`apps.key = "storage"`) to use the app at all.
- Any such member can **view** every box and item.
- **Editing** a box or its items is allowed for: the box's creator, or any user granted `editor` via the `storage_box_permissions` table.
- Only a box's creator can grant/revoke editor access for that box.
- Comments can only be edited/deleted by their author.

No separate signup/invite flow is in scope — membership provisioning happens outside this app (via `app_memberships`, managed elsewhere).

## 5. Tech Stack

- **Frontend framework**: Nuxt 4, SPA mode (`ssr: false`)
- **PWA tooling**: `@vite-pwa/nuxt` (Workbox-based service worker)
- **Backend**: PocketBase — auth, database, file storage. The schema is owned by `pb_migrations/` in this repo (see §5.1); `pocketbase-schema.md` remains the human-readable reference. Never modify the shared `apps`/`app_memberships` collections.
- **QR generation**: `qrcode` npm package (client-side generation of the box's QR image from its `qr_id`)
- **QR scanning**: `vue-qrcode-reader` npm package (camera access)
- **Server state**: `@peterbud/nuxt-query` (TanStack Query) — all PocketBase reads and writes go through it so the offline read cache stays authoritative.
- **Image handling**: `browser-image-compression` — photos are compressed client-side before upload.
- **Charts** (v1.1): `nuxt-charts` — Nuxt module for `vue-chrts`, built on Unovis. Used only by the reporting screen (§7.10).
- **Hosting**: static frontend (Vercel or Netlify); PocketBase hosted separately. The deployed PocketBase must not sit behind Cloudflare Access or any other edge auth on `/api/*` — browsers cannot complete a CORS preflight through it. Protect `/_/` (the admin dashboard) instead.

### 5.1 Schema provisioning

`pb_migrations/` is the source of truth for the schema. It recreates every
`storage_*` collection, creates the shared `apps`/`app_memberships` collections
only when absent, and seeds the `apps` row with `key = "storage"`. Import runs
in extend mode, so collections belonging to other apps on a shared instance are
never touched.

- Local development: `docker compose up -d` starts PocketBase on `:8090` with the migrations mounted and applied automatically.
- Schema changes are made in the PocketBase admin UI, then captured with `python3 scripts/pb-snapshot.py <url>` and committed.

## 6. Data Model

See `pocketbase-schema.md` for full field definitions and API rules. Summary:

- `storage_boxes` — title, description, location, images, qr_id (unique), status (active/archived), tags (relation, multiple), created_by
- `storage_items` — box (relation), title, description, notes, images, tags (relation, multiple), created_by
- `storage_comments` — item (relation), user, text
- `storage_tags` — name (unique), color, created_by — shared curated tag list applied to both boxes and items
- `storage_box_permissions` — box, user, role (editor) — sparse override table for edit access beyond the creator
- `storage_item_voice_notes` (v2, not built in v1) — item (relation), audio file, label, created_by — multiple recordings per item

Reporting adds three **view** collections (v1.1, §7.10). PocketBase view collections are read-only SQL projections — they have no write surface, and their `listRule`/`viewRule` use the same enabled-membership gate as the tables above:

- `storage_report_box_fill` — one row per box: title, location, status, item_count, photo_count
- `storage_report_tag_usage` — one row per tag: name, color, box_count, item_count
- `storage_report_growth` — one row per month: month, boxes_created, items_created

These collections and their API rules are provisioned by `pb_migrations/` (§5.1), so a fresh PocketBase instance is fully set up by starting it. The API rules are the real access control — see §4 — and the frontend must satisfy them: ownership fields (`created_by`, and `user` on comments) are required on create and rejected on update.

## 7. Functional Requirements

### 7.1 Auth
- Login page authenticates against PocketBase using existing user accounts.
- After login, verify the user has an enabled `app_memberships` row for this app; if not, show an access-denied state (don't attempt to create membership — that's out of scope).
- Route guard redirects unauthenticated users to `/login`, preserving the intended destination URL (important for QR deep links — see 7.3).

### 7.2 Box management
- **Create box**: form with optional title, optional description, optional location (free text), optional multiple images. On save, generate a unique `qr_id` (short random slug) and persist the box.
- **Box index page** (`/`): list/grid of all active boxes (title, thumbnail, location if set). Includes a search bar (see 7.6). Archived boxes are hidden by default with a toggle to show them.
- **Box detail page** (`/box/:qr_id`): shows box title/description/location/images, and the list of items inside it. Includes controls to edit the box, archive/unarchive it, and a prominent "+ Add Item" action. Edit/archive controls are only visible/enabled for users with edit rights (creator or granted editor) — the API will also enforce this server-side, but the UI should reflect it.
- **Archive**: sets `status = archived`; does not delete data. Archived boxes are excluded from the default index view and search results unless explicitly included.
- **QR print page** (`/box/:qr_id/print`): renders a printable view with the box's QR code and title, styled for a standard label/sticker print.
- **Batch print page** (`/print-sheet`): lets the user select multiple boxes and renders a printable sheet with one QR + label per box, laid out for a single print job.
- **Sharing page** (`/box/:qr_id/share`): for the box creator only — list current editors (from `storage_box_permissions`), add a new editor by selecting from users with app access, remove an editor.

### 7.3 QR scan → deep link flow
- Each box's QR code encodes a URL of the form `{app_origin}/box/{qr_id}`.
- Scanning with a phone's native camera app should open that URL directly in the browser/PWA (standard behavior for any QR containing a URL — no special native integration needed).
- The app should also provide an in-app scanner (using `qr-scanner`/`html5-qrcode`) accessible from the box index page, for cases where the user wants to scan without leaving the app (e.g. "scan to jump to a box").
- If the scanned/visited box doesn't exist, show a clear "box not found" state rather than a generic error.

### 7.4 Item management
- **Create item**: from a box's detail page, form with required title, optional description, optional notes, optional multiple images. Associates to the current box.
- **Item detail page** (`/item/:id`): shows title, description, notes, image gallery/carousel (supports multiple images), and a comment thread below.
- **Edit/delete item**: available to users with edit rights on the parent box.
- **Bulk move**: from a box detail page, allow selecting multiple items and moving them to a different box in one action.

### 7.5 Comments
- Any app member can add a comment to an item.
- Comments show author and timestamp.
- Only the comment's author can edit or delete their own comment.
- No push notifications — show a simple unread/new-comment indicator in-app (e.g. a badge on the item if comments were added since the user last viewed it). Exact "unread" tracking mechanism is an implementation detail — a reasonable approach is storing a per-user "last viewed" timestamp per item, either client-side or in a small PocketBase field/collection if persistence across devices is wanted.

### 7.6 Search
- Search page/bar queries across box titles, item titles, item descriptions, and item notes.
- Results should distinguish boxes from items and link to the appropriate detail page.
- Archived boxes/their items are excluded from search by default.

### 7.7 Tags
- Tags apply to both boxes and items, drawn from a single shared, curated tag list (`storage_tags`) — not freeform per-entity text.
- When adding/editing a box or item, the tag field offers autocomplete against existing tags and allows creating a new tag inline if no match exists.
- A box or item can have zero or more tags.
- Renaming a tag (editing `storage_tags.name`) updates its display everywhere it's applied, since it's a relation, not a copied string.
- The box index page and search results support filtering by one or more tags (in addition to free-text search).
- Any enabled app member can create or rename tags. **Deleting** a tag requires an `app_memberships.role` of `owner` or `admin`, since a delete strips the tag from every box and item that had it applied.
- Deleting a tag removes it from any boxes/items that had it applied (no orphaned data, no confirmation-cascade complexity beyond a simple "this tag is used on N items, delete anyway?" prompt).

### 7.8 Offline support (reads only, v1)
- Service worker caches the app shell for offline load.
- PocketBase API responses for `storage_boxes`/`storage_items`/`storage_comments` collections use a stale-while-revalidate caching strategy: cached data displays instantly, and refreshes in the background when online.
- Images served from PocketBase file storage use a cache-first strategy with a reasonable cache size/age cap (e.g. 200 entries, 30 days).
- Practical outcome: a box/item that has been viewed before (by that user, on that device) should display fully — including images — with zero network connectivity.
- No offline write support in v1: if the user attempts to create/edit while offline, show a clear message that the action requires connectivity rather than silently failing or losing data.

### 7.9 PWA baseline
- Web app manifest with name, icons (192px and 512px minimum), theme color, `display: standalone`.
- Installable on iOS/Android home screens.
- A lightweight "Add to Home Screen" prompt/nudge on first visit (respecting each platform's install-prompt constraints — iOS Safari has no native install prompt API, so this needs to be an in-app instructional nudge on iOS specifically).

### 7.10 Reporting (v1.1)

A read-only `/reports` screen showing the shape of the collection at a glance. Available to any enabled app member; there is no per-user or per-box scoping, since every member can already see every box.

**Aggregation happens in PocketBase, not the browser.** Each chart reads one of the view collections in §6, so the screen fetches tens of rows rather than every item. Do not fetch full record sets and reduce them client-side.

Contents, top to bottom:

1. **Totals** — boxes, items, tags, photos. Stat tiles, not charts.
2. **Items per box** — horizontal bar, top 10 by `item_count`. Answers "which boxes are crowded".
3. **Boxes by location** — donut, grouped from `storage_report_box_fill` rows in the browser (tens of rows, not thousands of records — this is the one permitted client-side grouping).
4. **Tag usage** — horizontal bar, top 10 by combined `box_count + item_count`.
5. **Growth** — area chart, boxes and items created per month.

Requirements:

- Every chart has an explicit empty state. A fresh instance has zero of everything, and an empty chart reads as broken rather than empty.
- Offline, the figures are **served from cache and carry a staleness notice** (amended in v1.2; they were online-only in v1.1). The original reasoning stands and is why the notice is required rather than optional: a partial or out-of-date aggregate presented with authority is actively misleading. Reporting moved to a dashboard at `/` (§7.11), and blocking the app's front door offline would break §10's promise that the app opens with no connectivity — so the figures are shown with the warning instead of withheld. The notice appears only when the screen is actually showing cached figures: offline with nothing cached there is nothing stale to warn about, and a notice that is always on screen is one people stop reading.
- Archived boxes are included but visually distinguished in the status split; they are excluded from the "items per box" ranking.
- No export, no date-range picker, no drill-through in v1.1. Charts are not links.

### 7.11 Dashboard (v1.2)

`/` is the app's default screen and its offline front door. Read-only, available to any enabled member.

Blocks, top to bottom:

1. **Actions** — the cross-collection search bar, New box, Print sheet. Writes still refuse offline (§7.8).
2. **Totals** — boxes, items, tags, photos. The same tiles as §7.10 item 1.
3. **Items per box, top 5** — the most actionable of the five reporting blocks: which boxes are crowded.
4. **Recent boxes** — the six most recently created active boxes.
5. A link to `/reports` for the full picture.

Requirements:

- Every figure comes from the §6 view collections and the same helpers `/reports` uses. A figure that differs between the two screens is a bug.
- The aggregate blocks (2 and 3) carry the §7.10 staleness notice offline. **Recent boxes do not** — a cached box list is the offline read v1 already promises and needs no apology.
- Loading, empty and error states for both the figures and the box list.
- Behind the auth guard like every other route; nothing about being the default page makes it public.

### 7.12 Items (v1.2)

`/items` lists every item across every box, for browsing rather than looking something up.

- Free-text over item **title, description and notes** — the same three fields §7.6 covers for items.
- **Tag filter chips**, AND-matched: an item must carry every selected tag.
- Paginated, newest first. Each row shows the item and which box it is in.
- **Items in archived boxes are excluded**, matching search (§7.2).
- Term and selected tags live in the URL, so a filtered view is linkable and survives a reload.
- Loading, empty ("no items yet"), no-matches ("nothing matches these filters") and error are four distinct states.
- No box dropdown and no archived items in v1.2: term plus tags covers the need, and archived content here would contradict how the rest of the app treats archived boxes.

## 8. Non-Functional Requirements

- **Mobile-first**: primary design target is a phone screen; layouts should scale up gracefully to tablet/desktop but should never be designed desktop-first.
- **Performance**: box/item pages with cached data should render near-instantly (perceived offline-first feel even when online).
- **Resilience**: network failures during data fetch should degrade to cached data where available, with a visible (non-blocking) indicator that data may be stale.

## 9. Routes

| Route | Purpose |
|---|---|
| `/login` | Auth |
| `/` | Dashboard: totals, one chart, recent boxes (v1.2, §7.11) |
| `/boxes` | Box index + search |
| `/items` | All items across boxes, with search and tag filter chips (v1.2, §7.12) |
| `/box/new` | Create box |
| `/box/:qr_id` | Box detail: items list, add item, edit/archive box |
| `/box/:qr_id/print` | Printable single QR label |
| `/box/:qr_id/share` | Manage editors for this box (creator only) |
| `/print-sheet` | Batch printable QR sheet |
| `/item/:id` | Item detail: description/notes/images/comments |
| `/search` | Cross-box/item search, with tag filter chips |
| `/tags` | Browse/manage the shared tag list (rename, delete, see usage count) |
| `/reports` | Read-only charts over the whole collection (v1.1, §7.10) |

## 10. Acceptance Criteria (high-level)

- A user can create a box with just a title (all other fields optional) and immediately see/print its QR code.
- Scanning a printed QR code with a phone camera opens the app to that exact box, prompting login first if needed and landing on the box afterward.
- A user can add an item with multiple photos to a box and see them in a gallery on the item page.
- A second app member (not the box creator) can view every box by default but cannot edit a box/item unless granted editor access or is the creator.
- The box creator can grant a second user editor rights via the share page, after which that user can edit the box and its items.
- Comments are visible to all members; only the author can edit/delete their own comment.
- Searching a term that appears only in an item's notes returns that item.
- A user can tag a box or item using an existing tag (via autocomplete) or by creating a new one inline.
- Renaming a tag updates its label on every box/item that has it applied.
- Filtering the box index or search results by a tag returns only matching boxes/items.
- After viewing a box once while online, opening that same box with the device in airplane mode still shows its title, items, and images. Opening `/` in airplane mode likewise shows the cached box list and the cached figures with a staleness notice (§7.11) — never an error screen.
- Archiving a box removes it from the default index and search but preserves all its data.

## 11. Open Questions / Decisions Deferred

- Exact mechanism for tracking "unread" comments per user (client-side timestamp vs. persisted field) — implementer's discretion for v1.
- Whether `qr_id` should also be human-typeable as a manual fallback entry point if a QR won't scan — not required for v1 but worth keeping the `qr_id` short and simple in case this is added later.
- Reminders and push notifications are deferred to a future version — do not build scaffolding for them now.
- Voice notes are deferred to v2; the `storage_item_voice_notes` collection schema is planned but should not be created or scaffolded in v1.
- ~~Whether tag create/rename/delete should be restricted to an admin role~~ — **decided**: deleting a tag requires an `app_memberships.role` of `owner` or `admin` (§7.7). Create and rename remain open to every member.

## 12. Reference

Full PocketBase collection schema and API rules: see `pocketbase-schema.md` (companion document).
