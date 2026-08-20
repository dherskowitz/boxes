# Wave 2 Overview — three parallel slices

> Coordination document, not an implementation plan. Each slice has its own plan
> alongside this one and its implementer reads only that.

Wave 2 closes the five acceptance criteria wave 1 could not: sharing, comments,
and search. After it, only tag wiring (wave 3) remains.

**Spec:** `docs/superpowers/specs/2026-08-19-storage-app-v1-design.md`
**Contract:** `docs/superpowers/interface-surface.md` — current as of wave 1. Read it first.
**Also:** `docs/superpowers/wave-0-interface-surface.md` for record types, query keys, view collections and the seeded fixture.

## The three slices

| Slice | Plan | Delivers | Closes |
|---|---|---|---|
| **F · Sharing** | `…-wave-2-slice-f-sharing.md` | `/box/:qr_id/share`, grant/revoke editor | criterion 5 |
| **E · Comments** | `…-wave-2-slice-e-comments.md` | comment thread on `/item/:id`, unread badge | criterion 6 |
| **G · Search** | `…-wave-2-slice-g-search.md` | `/search`, search bar on the index | criteria 7, and the search half of 12 |

## File ownership

| Slice | Owns exclusively |
|---|---|
| **F** | `app/pages/box/[qr_id]/share.vue` (replacing wave 0's stub), `app/components/Share*`, **mutations in** `app/queries/permissions.ts` |
| **E** | `app/components/Comment*`, `app/composables/useUnreadComments.ts`, **mutations in** `app/queries/comments.ts`, and the comment thread section of `app/pages/item/[id].vue` |
| **G** | `app/pages/search.vue`, `app/components/Search*`, `app/queries/search.ts` (new), and the search bar in `app/pages/index.vue` |

**Nobody owns** `app/types/pocketbase.ts`, `app/queries/keys.ts`, `app/queries/boxes.ts`, `items.ts`, `tags.ts`, `reports.ts`, `appUsers.ts`, `app/composables/useAuth.ts`, `useCanEdit.ts`, `useOnline.ts`, `app/utils/**`, `app/layouts/default.vue`, `nuxt.config.ts`, `playwright.config.ts`, `vitest.config.ts`, `package.json`, `scripts/**`, `pb_migrations/**`. A slice needing a change there **stops and reports**.

### Two slices edit a file they do not own — deliberately, and narrowly

E appends a comment thread to `app/pages/item/[id].vue`, and G adds a search bar
to `app/pages/index.vue`. Both files belong to nobody now that slice A has
merged. Each slice may add **one section** to its named file and change nothing
else in it. They touch different files, so they cannot collide with each other.

## Reserved names — check before you name anything

Nuxt flattens `composables/`, `utils/` and `queries/**` into one namespace, and a
duplicate is resolved **silently**: one wins, the other is dropped. That produced
a real defect in wave 1 that only `pnpm typecheck` caught.

Every existing name is listed in `docs/superpowers/interface-surface.md`. On top
of those, wave 2 reserves:

| Slice | May export | Must not export |
|---|---|---|
| **F** | `useGrantEditor`, `useRevokeEditor`, `useGrantableUsers` | anything starting `useComment`, `useSearch` |
| **E** | `useCreateComment`, `useUpdateComment`, `useDeleteComment`, `useUnreadComments`, `markItemRead` | anything starting `useGrant`, `useSearch` |
| **G** | `useSearch`, `searchFilter`, `SearchResult` | anything starting `useComment`, `useGrant` |

Components: F owns `Share*`, E owns `Comment*`, G owns `Search*`.

If you need a name outside your list, **stop and report** rather than inventing one.

## Binding on every slice

### The four traps wave 0 and 1 paid for

1. **`assertOnline()` is the first statement of every write mutation.** Mutations run with `networkMode: 'always'` so it executes; without the guard an offline write hangs the button forever with no message (PRD §7.8).
2. **Never interpolate into a PocketBase filter string.** Build `{ raw, params }` and call `$pb.filter(raw, params)`.
3. **Create sets the ownership field** (`user` on comments); **update omits it entirely** — the rule is `:isset = false` and rejects the payload if the field is present at all.
4. **`useAuth()` is setup-only** because it opens a query. Use `useAuthUser()` inside a submit handler or `mutationFn`.

### Testing

Every rule in the interface surface's "learned the hard way" section applies, in particular: the suite runs `workers: 1`, spec files run independently so never mutate a seeded record, teardown goes in `test.afterEach`, and call `pb.autoCancellation(false)` on a test's PocketBase client.

### Barebones styling

Nuxt UI defaults, layout primitives only. No colour classes, no custom CSS, no `main.css` or `app.config.ts` edits. Every screen needs a loading state and an empty state.

## Landing order

Slices are file-disjoint, so order barely affects conflicts. Merge **F → E → G**: F is smallest and self-contained, E adds a section to a page G does not touch, and G is the only one that changes the index page every other route links from. Full loop re-run on each merged result before the next lands.

## What wave 2 does not do

Tag wiring — mounting `TagPicker` in the box and item forms, and tag filter chips
on the index and search results — is **wave 3**. It edits slice G's search page
and slice A's forms, so it has to come after. Slice G should build its filtering
so tag chips can be added later without restructuring, but must not add them.
