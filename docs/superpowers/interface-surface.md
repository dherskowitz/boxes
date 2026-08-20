# Current interface surface

What a feature slice may import, as it exists on `main` after wave 1. This
supersedes `wave-0-interface-surface.md` for anything wave 1 changed — a stale
contract caused a real defect last wave (two slices independently exported
`useTagUsage` with different return types; Nuxt resolved the collision silently
and only `pnpm typecheck` caught it).

Read `wave-0-interface-surface.md` as well for the record types, query keys, view
collections, and seeded fixture — those are unchanged and not repeated here.

## The auto-import namespace — check before you name anything

Nuxt flattens `composables/`, `utils/` and `queries/**` into **one** namespace.
Two files exporting the same name is not an error: Nuxt picks one silently and
drops the other. Every name below is taken.

```
useAuth  useAuthUser  deriveMembership
useCanEdit  canEditBox  canDeleteBox  canEditItem  canEditComment
useOnline  assertOnline
pbError  newQrId  boxQrUrl  qrIdFromScan  compressImage  compressImages
useAppUsers  useAppUserMap
useBoxList  useBoxByQrId  boxFilter  boxUpdatePayload
useCreateBox  useUpdateBox  useSetBoxStatus  useDeleteBox   BoxEdit  NewBox
useItemList  useItem  itemFilter  itemUpdatePayload
useCreateItem  useUpdateItem  useDeleteItem  useMoveItems   ItemEdit  NewItem
useComments
useBoxPermissions
useTags  normalizeTagName  useCreateTag  useRenameTag  useDeleteTag
indexTagUsage  useTagUsageMap
useBoxFill  useTagUsage  useGrowth
topBoxesByItems  groupByLocation  topTagsByUsage  reportTotals
keys  PER_PAGE  tagClauses  PbFilter  BoxListFilters  ItemListFilters  SearchFilters
ReportTotalsResult  LocationGroup
```

Components share a namespace too: `BoxCard BoxForm BoxSection ItemCard ItemForm
OfflineBanner InstallPrompt QrCode QrScanner TagPicker ReportGrowth
ReportItemsPerBox ReportLocations ReportTagUsage ReportTotals`.

## Added in wave 1

### `app/composables/useCanEdit.ts` — the permission predicates

The API rules are asymmetric; these encode them so four slices cannot each
re-derive them differently. All fail closed while data is loading.

```ts
canEditBox(box: StorageBox | undefined, userId: string, permissions: StorageBoxPermission[] | undefined): boolean
canDeleteBox(box: StorageBox | undefined, userId: string): boolean   // creator only
canEditItem = canEditBox                                              // item rights follow its box
canEditComment(comment: StorageComment | undefined, userId: string): boolean  // author only

useCanEdit(box: Ref<StorageBox | undefined>): { canEdit: ComputedRef<boolean>, canDelete: ComputedRef<boolean> }
```

`canEditComment` already exists — the comments slice **consumes** it.

### `app/composables/useOnline.ts` — the offline signal and write guard

```ts
useOnline(): { isOnline: Ref<boolean> }   // reactive; only call inside setup()
assertOnline(): void                       // throws when offline; safe to call anywhere
```

**Every write mutation calls `assertOnline()` as its first statement.** Mutations
run with `networkMode: 'always'` (set once in `nuxt.config.ts`) precisely so the
function executes and can refuse with a message; TanStack's default would pause
the mutation silently and leave the button stuck loading — the failure PRD §7.8
forbids. Follow this in any new mutation.

### `app/composables/useAuth.ts`

`useAuth()` opens a query, so it is **setup-only**. To read the current user id
inside a submit handler or a `mutationFn`, use `useAuthUser()`, which does not.

### `app/queries/keys.ts`

```ts
PER_PAGE = 30
tagClauses(tagIds: string[] | undefined, prefix: string): PbFilter   // AND-matching tag clauses
interface PbFilter { raw: string, params: Record<string, unknown> }
```

`keys.search.query(filters)` and `keys.appUsers.byId(id)` are **defined and
unused** — they exist for the slices that need them.

### Mutation modules

`boxes.ts` and `items.ts` now export full create/update/delete sets, `tags.ts`
exports create/rename/delete. Read one before writing another: they share a
shape — `assertOnline()` first, ownership field on create, a diffing
`*UpdatePayload` helper so a fetched record can never be spread into `.update()`,
and `onSettled` invalidation so a partial failure still refreshes the cache.

`comments.ts` and `permissions.ts` are still **read-only**. Adding their
mutations is wave 2 work.

## Testing rules learned the hard way in wave 1

All of these cost real time. They are in `CLAUDE.md` too.

- **The e2e suite runs with `workers: 1`.** Two workers made `/tags` intermittently render its empty state, only in a full parallel run; the shared Nuxt dev server is the contended resource. Do not raise it.
- **`describe.configure({ mode: 'serial' })` orders one file only.** Spec files run independently, so a test must never mutate a seeded record — create the boxes, items and tags it writes to.
- **Put fixture teardown in `test.afterEach`, never a `finally`.** Playwright hard-kills a timed-out test and the `finally` never runs.
- **Call `pb.autoCancellation(false)`** on a test's PocketBase client. The SDK cancels concurrent requests to the same endpoint, so a parallel fixture build silently keeps only the last write — and the cancelled ones still land server-side afterwards.
- **Never assert an absolute count on a global aggregate.** `/reports` sums the whole database; derive expected numbers from the API at assertion time.
- **Service workers are blocked in Playwright** except in `offline.spec.ts`. `page.route` does not intercept service-worker-initiated requests, and a stale-while-revalidate cache will serve a test its own pre-write list back.
- **Run `pnpm nuxt prepare` before `pnpm typecheck`** after a merge or branch switch, or a stale `.nuxt/imports.d.ts` reports every auto-imported symbol as "Cannot find name".
- The loop is `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`. Use `pnpm test --hookTimeout=180000` on a loaded machine.
