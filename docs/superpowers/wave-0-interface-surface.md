# Wave 0 interface surface

Exact inventory of what wave 1 feature slices may import. Read from the actual
files on `plan/v1-implementation` at the commit verified by Task 11 (wave 0
exit check). Nothing here is inferred from the plan — every signature below
was read from source, and corrected again by the wave-0 fix wave (see
`.superpowers/sdd/2026-08-19-wave-0-foundation/fix-wave-report.md`).

**The loop** every slice must leave green:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

`pnpm typecheck` is `vue-tsc --build --noEmit` — it is what actually enforces
CLAUDE.md's no-`any` / no-`as` / no-`!` rules; eslint does not. Note it covers
`app/**` only, not `tests/`.

Auto-imports are on (Nuxt). None of the composables/utils below need an
explicit `import` statement inside `app/` — only types (`import type { ... }
from '~/types/pocketbase'`, `from '~/queries/keys'`) need importing.

## `app/types/pocketbase.ts`

```ts
export type BoxStatus = 'active' | 'archived'
export type MemberRole = 'owner' | 'admin' | 'member' | 'readonly'

interface RecordBase {           // not exported, fields inlined into every Storage* type below
  id: string
  created: string
  updated: string
}

export interface StorageTag extends RecordBase {
  name: string
  color: string               // hex code, '' when unset
  created_by: string
}

export interface StorageBox extends RecordBase {
  title: string
  description: string         // `editor` field — HTML string
  location: string
  images: string[]            // filenames, max 15; resolve via pb.files.getURL()
  qr_id: string
  status: BoxStatus           // no schema default — always send 'active' on create
  tags: string[]
  created_by: string
  expand?: {
    tags?: StorageTag[]
  }
}

export interface StorageItem extends RecordBase {
  box: string
  title: string
  description: string         // `editor` field — HTML string
  notes: string                // `editor` field — HTML string
  images: string[]            // filenames, max 99
  tags: string[]
  created_by: string
  expand?: {
    tags?: StorageTag[]
    box?: StorageBox
  }
}

export interface StorageComment extends RecordBase {
  item: string
  user: string
  text: string
}

export interface StorageBoxPermission extends RecordBase {
  box: string
  user: string
  /** The select's only value is 'editor', but it is `required: false` —
   *  an unset grant comes back as `''`. Always compare against `'editor'`. */
  role: 'editor' | ''
}

export interface AppUser {
  id: string
  name: string
  role: MemberRole
}

export interface ReportBoxFill {
  id: string
  title: string
  location: string
  status: BoxStatus
  item_count: number
  photo_count: number
}

export interface ReportTagUsage {
  id: string
  name: string
  color: string
  box_count: number
  item_count: number
}

export interface ReportGrowth {
  id: string
  month: string                // 'YYYY-MM'
  boxes_created: number
  items_created: number
}
```

`AppUser` is the only way to resolve a user id to a display name/role — the
`users` collection's `listRule` is `id = @request.auth.id`, so
`expand: 'created_by'` / `expand: 'user'` always comes back `{}`. Use
`useAppUsers()` / `useAppUserMap()` (below), never expand onto `users`.

## `app/queries/keys.ts`

```ts
export const PER_PAGE = 30        // page size for every paginated list

export interface PbFilter {
  raw: string                     // a $pb.filter() template — placeholders only
  params: Record<string, unknown>
}

export function tagClauses(tagIds?: string[]): {
  clauses: string[]               // ['tags ~ {:tag0}', 'tags ~ {:tag1}', …]
  params: Record<string, string>  // { tag0: …, tag1: … }
}
// A record matches only if it carries ALL selected tags. Shared by boxFilter
// and itemFilter so the two cannot drift.

export interface BoxListFilters {
  status?: BoxStatus            // omit → active only
  tagIds?: string[]             // box matches if it carries ALL of them
  search?: string
  page?: number
}

export interface ItemListFilters {
  boxId: string
  tagIds?: string[]
  page?: number
}

export interface SearchFilters {
  term: string
  tagIds?: string[]
}

export const keys = {
  boxes: {
    all: ['boxes'] as const,
    list: (filters: BoxListFilters = {}) => ['boxes', 'list', filters] as const,
    byQrId: (qrId: string) => ['boxes', 'qr', qrId] as const,
    byId: (id: string) => ['boxes', 'id', id] as const
  },
  items: {
    all: ['items'] as const,
    list: (filters: ItemListFilters) => ['items', 'list', filters] as const,
    byId: (id: string) => ['items', 'id', id] as const
  },
  comments: {
    all: ['comments'] as const,
    byItem: (itemId: string) => ['comments', 'item', itemId] as const
  },
  tags: {
    all: ['tags'] as const,
    list: () => ['tags', 'list'] as const
  },
  permissions: {
    all: ['permissions'] as const,
    byBox: (boxId: string) => ['permissions', 'box', boxId] as const
  },
  appUsers: {
    all: ['appUsers'] as const,
    list: () => ['appUsers', 'list'] as const,
    byId: (userId: string) => ['appUsers', 'id', userId] as const
  },
  search: {
    all: ['search'] as const,
    query: (filters: SearchFilters) => ['search', filters] as const
  },
  reports: {
    all: ['reports'] as const,
    boxFill: () => ['reports', 'boxFill'] as const,
    tagUsage: () => ['reports', 'tagUsage'] as const,
    growth: () => ['reports', 'growth'] as const
  }
} as const
```

Note: `keys.search.*` and `keys.appUsers.byId` exist in `keys.ts` but have no
corresponding query function yet in `app/queries/*.ts` — they are there for
the slices that own search and per-user lookups to use directly.

## `app/utils/pbError.ts`

```ts
export function pbError(e: unknown): string
```

Turns anything thrown by a PocketBase call into a user-facing message.
Field-validation errors are joined as `"field: message; field2: message2"`.
A 403 with no field errors becomes `"You do not have permission to do that."`
plus the server's own message when there is one (`"You do not have permission
to do that. Only superusers can perform this action."`) — on this app a 403 is
almost always an ownership-field mistake and PocketBase names the rule.
Any other `ClientResponseError` falls back to `e.response?.message ||
e.message`. Non-PocketBase `Error` → `e.message`. Anything else →
`"Something went wrong."` Always call this in a mutation's `onError` /
`catch` — never show a raw thrown value or a generic string.

## `app/composables/useAuth.ts`

```ts
export function deriveMembership(
  userId: string,
  directory: AppUser[] | undefined
): AppUser | null
```
Pure function, exported standalone for unit testing without a PocketBase
instance or component tree. Returns `null` if `userId` is `''`, `directory`
is `undefined`, or no directory row matches.

```ts
export function useAuthUser(): {
  user: Ref<import('pocketbase').AuthRecord>        // $pbUser from the pocketbase plugin; null when signed out
  userId: ComputedRef<string>                       // '' when signed out
  isLoggedIn: ComputedRef<boolean>
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export function useAuth(): ReturnType<typeof useAuthUser> & {
  member: ComputedRef<AppUser | null>                // this app's membership row for the signed-in user
  role: ComputedRef<MemberRole | null>
  isMember: ComputedRef<boolean>
  isMembershipPending: Ref<boolean>                   // true while useAppUsers() is loading
  isMembershipError: Ref<boolean>                     // the directory request failed
  membershipError: Ref<Error | null>                  // run it through pbError()
  refetchMembership: () => Promise<unknown>           // retry action for the error state
}
```

**Setup context:** `useAuth()` calls `useAppUsers()`, i.e. `useQuery` — it must
run inside a component `setup()` (or a composable called from one). Calling it
from a submit handler, a `watch` callback, or any other non-setup context
throws inside vue-query internals. `useAuthUser()` opens no query and is safe
anywhere; use it to read `userId` for the `created_by` / `user` ownership field
in a create handler.

`isMembershipError` exists because a *failed* directory request is not the same
as *not being a member* — `app/layouts/default.vue` renders
`data-testid="membership-error"` (with a retry) before it renders
`data-testid="access-denied"`. Never infer "no access" from an absent
directory; that is what made every screen unreachable offline.

`login` calls `$pb.collection('users').authWithPassword(...)` and throws on
failure — callers must catch and run the error through `pbError()`. `logout`
clears `$pb.authStore` synchronously (no promise, no navigation — callers
navigate themselves, see `app/layouts/default.vue`'s `onSignOut`).

`isMember` / `role` are UX-only gates (see CLAUDE.md — "Client-side
permission checks are UX only"). They exist to drive the access-denied
screen in `default.vue`, not as an authorization mechanism.

## `app/composables/useCanEdit.ts`

The permission matrix, re-derived from the API rules in
`pb_migrations/1787154450_storage_schema.js` (read them, do not guess):

| operation | who |
|---|---|
| box update | creator **or** an `editor` grant on that box |
| box delete | creator **only** — an editor grant does not extend to delete |
| item create / update / delete | box creator **or** an `editor` grant on the box; the item's own `created_by` is never consulted |
| comment update / delete | its author only |
| `storage_box_permissions` create / update / delete | box creator only |
| `storage_tags` create / update | any enabled member — no ownership requirement |
| `storage_tags` delete | app `owner` or `admin` |
| everything else (list/view) | any enabled member of the `storage` app |

```ts
export function canEditBox(
  box: StorageBox | undefined,
  userId: string,
  permissions: StorageBoxPermission[] | undefined
): boolean

export function canDeleteBox(box: StorageBox | undefined, userId: string): boolean

export const canEditItem = canEditBox        // item rights are its box's rights

export function canEditComment(comment: StorageComment | undefined, userId: string): boolean

export function useCanEdit(box: Ref<StorageBox | undefined>): {
  canEdit: ComputedRef<boolean>
  canDelete: ComputedRef<boolean>
}
```

The four predicates are pure — plain values in, boolean out, unit tested
without `$pb` or a component tree. They **fail closed**: no user id, no record,
or permissions still loading all yield `false`, so an edit control never
flashes for someone who cannot use it. (The creator check does not need the
permissions list, so a creator is trusted immediately.)

`useCanEdit` wires them to `useAuthUser()` and `useBoxPermissions()`, so it
must run inside `setup()`. Note `useBoxPermissions` wraps `getList` — the
payload is a paginated result, so the predicates take `data.value?.items`.

These are UX gates only. The API rules are the real guard; a `true` here is
never authorisation.

## Query modules (`app/queries/*.ts`)

All query functions wrap `useQuery` from `@peterbud/nuxt-query` /
TanStack Query and return the standard TanStack Query result object
(`data`, `isPending`, `isError`, `error`, `refetch`, …) typed by the generic
passed to `.getList<T>()` / `.getFullList<T>()` / `.getOne<T>()` /
`.getFirstListItem<T>()`. None of the modules below export a `useMutation` —
wave 0 ships reads only; create/update/delete belong to the slice that owns
each collection.

### `app/queries/appUsers.ts`

```ts
export function useAppUsers()
// useQuery over storage_app_users view, getFullList<AppUser>({ sort: 'name' })
// enabled: computed(() => $pbUser.value !== null)  — do not call before login
// staleTime: 5 minutes

export function useAppUserMap(): ComputedRef<Map<string, AppUser>>
// id -> AppUser, built from useAppUsers().data
```

### `app/queries/boxes.ts`

```ts
export function boxFilter(filters: BoxListFilters): PbFilter
// Exported for testing. Never hand-build a filter string from user input —
// always go through boxFilter() + $pb.filter(raw, params) so values are bound
// by placeholder, not interpolated (see qr_id deep-link injection history
// noted in the source comment).

export function useBoxList(filters: Ref<BoxListFilters>)
// const { raw, params } = boxFilter(filters.value)
// getList<StorageBox>(page, PER_PAGE, {
//   filter: $pb.filter(raw, params), expand: 'tags', sort: '-created' })
// queryKey recomputes from filters.value — pass a Ref, not a plain object

export function useBoxByQrId(qrId: Ref<string>)
// getFirstListItem<StorageBox>($pb.filter('qr_id = {:qrId}', { qrId: qrId.value }),
//   { expand: 'tags' })
// enabled: qrId.value !== ''; retry: false (a 404 should surface immediately, not retry)
```

`PER_PAGE` and `PbFilter` live in `keys.ts`, not here — do not import them
across a slice boundary from `boxes.ts`.

### `app/queries/items.ts`

```ts
export function itemFilter(filters: ItemListFilters): PbFilter
// { raw: 'box = {:boxId} && tags ~ {:tag0} && …', params: { boxId, tag0, … } }
// Exported for testing, same convention as boxFilter.

export function useItemList(filters: Ref<ItemListFilters>)
// const { raw, params } = itemFilter(filters.value)
// getList<StorageItem>(page, PER_PAGE, {
//   filter: $pb.filter(raw, params), expand: 'tags', sort: '-created' })
// enabled: filters.value.boxId !== ''

export function useItem(id: Ref<string>)
// getOne<StorageItem>(id.value, { expand: 'tags,box' })
// enabled: id.value !== ''; retry: false
```

`useItemList` **honours `tagIds`**: an item matches only if it carries every
selected tag, the same rule `boxFilter` applies (both go through
`tagClauses`).

### `app/queries/comments.ts`

```ts
export function useComments(itemId: Ref<string>)
// getList<StorageComment>(1, 200, {
//   filter: $pb.filter('item = {:itemId}', { itemId: itemId.value }), sort: 'created' })
// enabled: itemId.value !== ''
// Deliberately no expand: 'user' (users collection not expandable by other
// members) — resolve author names via useAppUserMap().
```

### `app/queries/tags.ts`

```ts
export function useTags()
// getFullList<StorageTag>({ sort: 'name' }) — unpaginated on purpose,
// small shared vocabulary, every picker needs the whole list
// staleTime: 5 minutes
```

### `app/queries/permissions.ts`

```ts
export function useBoxPermissions(boxId: Ref<string>)
// getList<StorageBoxPermission>(1, 200, {
//   filter: $pb.filter('box = {:boxId}', { boxId: boxId.value }) })
// Returns a paginated ListResult — read `.items`, not the payload itself.
// enabled: boxId.value !== ''
```

### `app/queries/reports.ts`

```ts
export {}
```
Intentionally empty stub. Owned by the reporting slice. The doc comment in
the file states the convention that slice must follow: aggregation happens
in PocketBase (the four view collections), never fetch full record sets and
reduce client-side — the views return tens of rows, not the underlying
`storage_items`/`storage_boxes` tables.

## The four PocketBase view collections

All four are gated by the same `listRule`/`viewRule` (`GATE` in
`scripts/pb-views.py`): authed, and an enabled `app_memberships` row for the
`storage` app. Read-only — no `createRule`/`updateRule`/`deleteRule`
(all `null`). Field types below are read from the migration
(`pb_migrations/1787154450_storage_schema.js`), not inferred.

### `storage_app_users`
| column | PocketBase field type |
|---|---|
| `id` | text (primary key) |
| `name` | text |
| `role` | text (`'owner' \| 'admin' \| 'member' \| 'readonly'`, not enforced by the view's field type — narrowed only in the TS `AppUser.role`) |

The view's `role` is `MIN(role_rank)` over the user's enabled `storage`
memberships, so a user holding several rows shows their **highest** role
(`owner` < `admin` < `member` < `readonly`), never a duplicate row.

### `storage_report_box_fill`
| column | PocketBase field type |
|---|---|
| `id` | text |
| `title` | text |
| `location` | text |
| `status` | select, single, values `active`/`archived` |
| `item_count` | number, integer |
| `photo_count` | number, integer |

### `storage_report_tag_usage`
| column | PocketBase field type |
|---|---|
| `id` | text |
| `name` | text |
| `color` | text |
| `box_count` | number, integer |
| `item_count` | number, integer |

### `storage_report_growth`
| column | PocketBase field type |
|---|---|
| `id` | text (`YYYY-MM` with the dash stripped, e.g. `202603`) |
| `month` | text (`YYYY-MM`) |
| `boxes_created` | number, integer |
| `items_created` | number, integer |

`storage_report_growth`'s rows are the union of every distinct
`strftime('%Y-%m', created)` across `storage_boxes` and `storage_items`,
ordered by month ascending — a slice does not need to sort it again.

## Seeded fixture (`scripts/pb-seed.py`)

Idempotent: wipes and recreates its own rows only (scoped to `@local.test`
users and the `storage_*` collections plus the `app_memberships` rows for
those users — never a blanket wipe of the shared `apps`/`app_memberships`
tables). All passwords: `storagedev123`.

| email | display name | `storage` app role |
|---|---|---|
| `dana@local.test` | Dana Herskowitz | owner |
| `sam@local.test` | Sam Okafor | member |
| `rae@local.test` | Rae Lindqvist | member |
| `nobody@local.test` | Jo Nakamura | none — no `app_memberships` row; use this account to test the access-denied state |

Tags (`storage_tags`, all `created_by: dana`): `fragile` (#dc2626), `winter`
(#2563eb), `kitchen` (#16a34a), `paperwork` (#ca8a04), `sentimental`
(#9333ea).

Boxes (`qr_id` is `seedbox<n>`, 1-indexed in seed order, all
`created_by: dana`):

| qr_id | title | status | tags | items |
|---|---|---|---|---|
| `seedbox1` | Winter coats and boots | active | winter | 3 items (peacoat, boots, scarves) — **Sam has an `editor` grant on this box only** (`storage_box_permissions`), the only permission row seeded |
| `seedbox2` | Kitchen overflow: the bread machine, the stand mixer bowl we never use, and assorted baking tins | active | kitchen, fragile | 2 items |
| `seedbox3` | Tax records 2019-2023 | active | paperwork | 3 items |
| `seedbox4` | Empty spare box | active | (none) | 0 items — the empty-list case |
| `seedbox5` | College photo albums | **archived** | sentimental, fragile | 1 item |

The "Navy wool peacoat" item (in `seedbox1`) has two seeded comments (Sam
asks, Dana replies) — the only item with comments.

## Conventions a slice author must follow

- **Filters:** never interpolate a value into a PocketBase filter string.
  Build `{ raw, params }` (see `boxFilter` above) and call
  `$pb.filter(raw, params)`. A raw string with a value spliced in can break
  out of its quotes and rewrite the query — this happened once already on
  the qr_id deep-link path, per the comment in `boxes.ts`.
- **Create:** always set the ownership field (`created_by` on boxes/items/
  voice notes, `user` on comments) to `@request.auth.id`'s value on create —
  the create API rule requires `@request.body.<field> = @request.auth.id`
  and an omitted field resolves to empty, which fails the rule. (Re-derived
  from the `createRule`s in `pb_migrations/1787154450_storage_schema.js` —
  correct as stated.) `storage_tags` is the exception: **no** rule on it
  mentions ownership and its `created_by` is optional. Tags are a shared
  curated vocabulary, not owned — any enabled member may create or edit one,
  and only an app `owner`/`admin` may delete one.
- **Update:** never include the ownership field in an update payload, even
  set to the already-correct value — the update rule uses `:isset = false`,
  which rejects the request if the field is present at all. Send only the
  fields that changed; never spread a fetched record into `.update()`.
- **Reads/writes go through nuxt-query only.** Never call
  `pb.collection().getList()` etc. directly from a component — it bypasses
  the query cache and breaks the v1 offline-read guarantee.
- **`Ref` vs plain value:** `useBoxList`, `useItemList`, `useBoxByQrId`,
  `useItem`, `useComments`, `useBoxPermissions` all take a `Ref` (or
  `ComputedRef`) parameter, not a plain value — the query key is built from
  `filters.value`/`id.value` inside a `computed()`, so passing a non-reactive
  object means the query never refetches on change.
- **`storage_app_users` is the only way to resolve a user id to a name or
  role.** `expand` onto `created_by`/`user` always returns `{}` because
  `users.listRule` is `id = @request.auth.id`. Use `useAppUsers()` /
  `useAppUserMap()`.
- **Reports:** aggregate in PocketBase (the view collections), never
  client-side — see `reports.ts`'s doc comment.
- **Pagination:** every list call must pass `perPage` (or use the module's
  `PER_PAGE = 30` from `~/queries/keys`) — never fetch an unbounded list
  to filter or join client-side. `useTags()` and `useAppUsers()` are the
  deliberate exceptions (small, bounded vocab/roster) via `getFullList`.
