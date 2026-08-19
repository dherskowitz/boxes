# Wave 1 Overview — five parallel slices

> Not an implementation plan. This is the coordination document: who owns which
> file, what every slice must obey, and the order things land. Each slice has
> its own plan alongside this one and its implementer reads only that.

**Spec:** `docs/superpowers/specs/2026-08-19-storage-app-v1-design.md`
**Contract produced by wave 0:** `docs/superpowers/wave-0-interface-surface.md` — the exact signatures every slice imports. Read it before writing any slice code.

## The five slices

| Slice | Plan | Routes it delivers |
|---|---|---|
| **A · Boxes + Items** | `…-wave-1-slice-a-boxes-items.md` | `/`, `/box/new`, `/box/:qr_id`, `/item/:id` |
| **B · Tags** | `…-wave-1-slice-b-tags.md` | `/tags`, plus the reusable `TagPicker` |
| **C · QR** | `…-wave-1-slice-c-qr.md` | `/box/:qr_id/print`, `/print-sheet`, in-app scanner |
| **D · PWA / offline** | `…-wave-1-slice-d-pwa-offline.md` | no route — service worker, offline banner, install nudge |
| **J · Reports** | `…-wave-1-slice-j-reports.md` | `/reports` |

A is much the largest. B, C, D and J are comparable to each other and smaller.

## File ownership — the conflict map

Each slice works in its own git worktree. A file appears **once** in this table. Touching a file you do not own is the failure mode this table exists to prevent; if a slice believes it needs to, it stops and reports rather than editing.

| Slice | Owns exclusively |
|---|---|
| **A** | `app/pages/index.vue`, `app/pages/box/new.vue`, `app/pages/box/[qr_id]/index.vue`, `app/pages/item/**`, `app/components/Box*`, `app/components/Item*`, `app/utils/qrId.ts`, `app/utils/compressImage.ts`, **mutations in** `app/queries/boxes.ts` and `app/queries/items.ts` |
| **B** | `app/pages/tags.vue`, `app/components/TagPicker.vue`, `app/components/Tag*`, **mutations in** `app/queries/tags.ts` |
| **C** | `app/pages/box/[qr_id]/print.vue`, `app/pages/print-sheet.vue`, `app/components/Qr*` |
| **D** | the `pwa` block of `nuxt.config.ts`, `app/components/OfflineBanner.vue`, `app/components/InstallPrompt.vue`, `app/composables/useOnline.ts` |
| **J** | `app/pages/reports.vue`, `app/components/Report*`, all of `app/queries/reports.ts` |

**Nobody owns** `app/types/pocketbase.ts`, `app/queries/keys.ts`, `app/utils/pbError.ts`, `app/composables/useAuth.ts`, `app/composables/useCanEdit.ts`, `app/queries/appUsers.ts`, `app/plugins/pocketbase.ts`, `app/layouts/default.vue`, `app/app.vue`, `scripts/**`, `pb_migrations/**`, `package.json`, `pnpm-lock.yaml`. These are wave 0's contract. A slice needing a change here **stops and reports** — a contract change has to be made once, centrally, not five times in five worktrees.

### The three ownership decisions worth knowing

1. **`app/utils/qrId.ts` is A's, not C's.** `/box/new` must generate a `qr_id` to create a box at all. C only renders a QR image from an existing one.
2. **`app/composables/useCanEdit.ts` belongs to wave 0, not to any slice.** It was originally slice A's. The final whole-branch review found four slices need the same predicate, and that the matrix is asymmetric — a box's *update* rule accepts creator-or-editor, its *delete* rule accepts creator only. Four agents re-deriving that would not have agreed, so it is shared contract and every slice consumes it.
3. **A adds every link to sibling slices' routes** — to `/box/:qr_id/print`, `/box/:qr_id/share` and `/print-sheet`. Those links originate from A's two pages, and having C and F reach into A's files is exactly the conflict this table prevents. Wave 0 left stubs at all three targets, so the links resolve from day one.

## Binding on every slice

### Barebones styling
Nuxt UI components with default props. Layout primitives only: `flex`, `grid`, `gap-*`, `p-*`, `m-*`, `w-*`, `max-w-*`, `min-h-*`, `border`, `flex-1`, text sizing. **No colour classes, no custom CSS, no `app/assets/css/main.css` additions, no `app.config.ts` theme edits.** The sole exception is `@media print` rules on slice C's two print routes, where layout is functional rather than decorative.

Styling is a later phase. A slice that "just improves the look a bit" creates a conflict with that phase and will be sent back.

### The four traps wave 0 paid for
Every one of these was a real bug caught during wave 0. They are restated in each slice plan.

1. **`storage_boxes.status` has no schema default.** A create that omits it lands with an empty status and the box vanishes from the index filter. Always send `status: 'active'`.
2. **Never interpolate a value into a PocketBase filter string.** Build `{ raw, params }` and call `$pb.filter(raw, params)`. A spliced value once broke out of its quotes and rewrote the query on the `qr_id` deep-link path.
3. **Create must set the ownership field** (`created_by`, or `user` on comments); **update must omit it entirely.** The update rule uses `:isset = false` and rejects the payload if the field is present at all, even set correctly. Never spread a fetched record into `.update()`.
4. **`app/queries/` is auto-imported only because `nuxt.config.ts` says so.** A new top-level directory under `app/` is not auto-imported; only `composables/`, `utils/` (and `shared/`) are scanned by default.

### Definition of done, per slice
In its own worktree: `pnpm lint && pnpm test && pnpm test:e2e` all green, tests written before implementation, and no file outside the slice's ownership modified. The e2e suite is flaky under heavy machine load — re-run before concluding red, and never weaken a test to reach green.

### Testing
Unit tests for composables and utils; e2e for user flows against the local PocketBase. Use the seeded fixture (`scripts/pb-seed.py`, all passwords `storagedev123`) rather than creating ad-hoc data:

- `dana@local.test` — owner, created every seeded box
- `sam@local.test` — member, `editor` on `seedbox1` only
- `rae@local.test` — member, read-only everywhere
- `nobody@local.test` — no membership; the access-denied case

Boxes are `seedbox1`…`seedbox5`; `seedbox4` is empty (the empty-state case) and `seedbox5` is archived. Tests that mutate data must clean up after themselves — the seed is a shared baseline, not per-test state.

## Landing order

Slices run concurrently in separate worktrees, but merge one at a time, with the full loop re-run on the merged result before the next lands. Merge **A first** — it is the largest, it touches the index page every other slice links from, and rebasing the others onto it is cheaper than rebasing it onto them.

Suggested order: **A → B → J → C → D.** C and D land last because C's print pages and D's service-worker config are the least entangled with anything else.

## Known trip hazards carried from wave 0

- `app/pages/box/[qr_id]/index.vue` does not exist yet — slice A creates it. Until it does, the wave 0 e2e deep-link test asserts only that the URL survives login, not that a box screen renders. **Slice A must extend that test** to assert real box content.
- `/search`, `/tags` and `/reports` are nav links with no page files yet, which produces benign router warnings in e2e logs. B and J remove two of them; `/search` waits for wave 2.
- No query module has a `useMutation` yet. Wave 0 is reads-only by design — a slice adding the first mutation to a module is expected, not a sign something is missing.
- `keys.search.*` and `keys.appUsers.byId` are defined but unused. They are there for the slices that need them.
