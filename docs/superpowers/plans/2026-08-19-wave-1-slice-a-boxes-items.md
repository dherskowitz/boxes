# Slice A — Boxes + Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the core of the app — create a box, get its QR identity, browse boxes, open a box, add items to it, and view an item — with edit controls gated on real permissions.

**Architecture:** Four pages plus the mutations that back them. Boxes and items are one slice deliberately: box detail hosts the item list and the add-item action, so splitting them would put two agents in the same file. Reads come from wave 0's query modules unchanged; this slice adds the create/update/delete mutations to `boxes.ts` and `items.ts`, plus three small utilities.

**Tech Stack:** Nuxt 4 SPA (`ssr: false`), Nuxt UI 4, PocketBase 0.39.11, `@peterbud/nuxt-query` / TanStack Query, `browser-image-compression`, Vitest, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-19-storage-app-v1-design.md`
**Contract:** `docs/superpowers/wave-0-interface-surface.md` — read this first; it has every signature you import.
**Coordination:** `docs/superpowers/plans/2026-08-19-wave-1-overview.md`

## Global Constraints

- Package manager is **pnpm**. Never npm or yarn.
- **Done means** `pnpm lint && pnpm test && pnpm test:e2e` all green, in your worktree. TDD: failing test first, watched fail, then implementation. Never `.skip`/`.only`, never weaken a test to reach green. The e2e suite is flaky under heavy machine load — re-run before concluding red.
- **No `any`**, no `as` to silence an error, no non-null `!`, no `@ts-expect-error` without a comment naming the reason.
- Nuxt auto-imports are on. No imports for composables, components, `#app` utilities, or anything in `app/utils/` and `app/queries/`. `import type` for types IS required.
- **All reads and writes go through nuxt-query** (`useQuery`/`useMutation`). Never call `pb.collection().…` directly from a component.
- **Barebones styling.** Nuxt UI components with default props; layout primitives only (`flex`, `grid`, `gap-*`, `p-*`, `m-*`, `w-*`, `max-w-*`, `min-h-*`, `border`, `flex-1`, text sizing). No colour classes, no custom CSS, no `main.css` or `app.config.ts` edits.
- **Every screen needs a loading state and an empty state.** Barebones governs appearance, not completeness.
- Surface every failure through `pbError(e)`. Never swallow a failed mutation; never show a generic "Something went wrong".
- **`storage_boxes.status` has no schema default** — always send `status: 'active'` on create.
- **Never interpolate into a filter string.** Use `$pb.filter(raw, params)`.
- **Create sets the ownership field; update omits it entirely.** `created_by` must equal the authed user id on create. The update rule uses `:isset = false` and rejects the payload if `created_by` is present at all. Never spread a fetched record into `.update()`.
- **Compress images before upload** with `browser-image-compression`. Never upload a raw camera file.
- Commits: no attribution footers, no `Co-Authored-By`, no emoji trailers. One logical change per commit.
- **Files you own** are listed in the overview. Do not modify anything outside them; if you believe you must, stop and report.

## Permission model you are implementing

From the PRD and verified against the live API during wave 0:

- Any enabled member can **view** every box and item, and can **create** boxes.
- Editing a box or its items requires being the box's **creator** or holding an `editor` row in `storage_box_permissions` for that box.
- **Deleting a box is creator-only** — a granted editor can edit the box and delete its items, but cannot delete the box itself.
- **Creating an item** requires creator-or-editor on the parent box, so a plain member cannot add items to someone else's box.

Client-side checks are **UX only**. Hiding a button is not access control; the API rules are the guard. Every mutation must still handle a 403 by surfacing `pbError`.

---

### Task 1: `qr_id` generation

**Files:**
- Create: `app/utils/qrId.ts`
- Test: `tests/nuxt/qrId.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `newQrId(): string` — 8 lowercase-alphanumeric characters.

`qr_id` is printed on a physical label and typed by hand when a code will not scan, so it stays short and unambiguous. It is also `UNIQUE` in the schema, so a collision is a real (if rare) failure the create path must survive — Task 4 handles the retry.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { newQrId } from '~/utils/qrId'

describe('newQrId', () => {
  it('is 8 characters', () => {
    expect(newQrId()).toHaveLength(8)
  })

  it('uses only lowercase alphanumerics, so it survives the id pattern and is typeable', () => {
    for (let i = 0; i < 200; i++) {
      expect(newQrId()).toMatch(/^[a-z0-9]{8}$/)
    }
  })

  it('does not repeat across many draws', () => {
    const seen = new Set(Array.from({ length: 500 }, () => newQrId()))
    expect(seen.size).toBe(500)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test tests/nuxt/qrId.spec.ts`
Expected: FAIL — cannot resolve `~/utils/qrId`.

- [ ] **Step 3: Implement**

`Math.random()` is not used: ids end up on printed labels that must not collide, and `crypto.getRandomValues` is available in every browser this app targets. The rejection loop avoids modulo bias.

```ts
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const LENGTH = 8

/**
 * A short, hand-typeable id for a box's printed QR label.
 *
 * Unique-constrained in the schema — the create path retries once on collision.
 * Lowercase alphanumeric only, matching PocketBase's own id pattern and
 * avoiding characters that are ambiguous on a printed sticker.
 */
export function newQrId(): string {
  const out: string[] = []
  // 252 = 7 * 36: the largest multiple of the alphabet size under 256, so
  // rejecting values above it keeps every character equally likely.
  const limit = 252
  while (out.length < LENGTH) {
    const bytes = new Uint8Array(LENGTH)
    crypto.getRandomValues(bytes)
    for (const byte of bytes) {
      if (byte < limit && out.length < LENGTH) {
        out.push(ALPHABET[byte % ALPHABET.length])
      }
    }
  }
  return out.join('')
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm test tests/nuxt/qrId.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add app/utils/qrId.ts tests/nuxt/qrId.spec.ts
git commit -m "Add qr_id generator for box labels"
```

---

### Task 2: Image compression

**Files:**
- Create: `app/utils/compressImage.ts`
- Test: `tests/nuxt/compressImage.spec.ts`

**Interfaces:**
- Consumes: `browser-image-compression` (already a dependency).
- Produces: `compressImage(file: File): Promise<File>` and `compressImages(files: File[]): Promise<File[]>`.

A phone camera file is several megabytes; the box images field caps at 15 files and items at 99. Uploading raw camera files would make the offline image cache useless and the upload slow on the phone connection this app targets.

- [ ] **Step 1: Write the failing test**

The library does real canvas work that happy-dom cannot do, so the test mocks it and asserts the **contract** — that our wrapper passes sane options and preserves the filename — rather than re-testing the library.

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const compressMock = vi.fn()
vi.mock('browser-image-compression', () => ({ default: compressMock }))

const { compressImage, compressImages } = await import('~/utils/compressImage')

function fakeFile(name: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' })
}

describe('compressImage', () => {
  beforeEach(() => {
    compressMock.mockReset()
    compressMock.mockImplementation((file: File) => Promise.resolve(file))
  })

  it('caps the long edge and the file size', async () => {
    await compressImage(fakeFile('coat.jpg', 4_000_000))
    const options = compressMock.mock.calls[0][1]
    expect(options.maxWidthOrHeight).toBe(1600)
    expect(options.maxSizeMB).toBe(1)
    expect(options.useWebWorker).toBe(true)
  })

  it('keeps the original filename so uploads stay recognisable', async () => {
    compressMock.mockResolvedValue(new File([new Uint8Array(10)], 'blob', { type: 'image/jpeg' }))
    const out = await compressImage(fakeFile('winter-coat.jpg', 4_000_000))
    expect(out.name).toBe('winter-coat.jpg')
  })

  it('compresses every file it is given', async () => {
    await compressImages([fakeFile('a.jpg', 100), fakeFile('b.jpg', 100)])
    expect(compressMock).toHaveBeenCalledTimes(2)
  })

  it('returns an empty list unchanged without calling the library', async () => {
    expect(await compressImages([])).toEqual([])
    expect(compressMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test tests/nuxt/compressImage.spec.ts`
Expected: FAIL — cannot resolve `~/utils/compressImage`.

- [ ] **Step 3: Implement**

```ts
import imageCompression from 'browser-image-compression'

const OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1600,
  useWebWorker: true
}

/**
 * Shrink a camera photo before upload.
 *
 * The primary target is a phone on a slow connection, and v1 caches images for
 * offline reads — a raw multi-megabyte camera file would blow both budgets.
 * The library returns a Blob-ish File that can lose the original name, so the
 * name is restored explicitly.
 */
export async function compressImage(file: File): Promise<File> {
  const compressed = await imageCompression(file, OPTIONS)
  if (compressed.name === file.name) return compressed
  return new File([compressed], file.name, { type: compressed.type })
}

export function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map(compressImage))
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm test tests/nuxt/compressImage.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add app/utils/compressImage.ts tests/nuxt/compressImage.spec.ts
git commit -m "Add client-side image compression for uploads"
```

---

### Task 3: (removed — moved into the shared contract)

This slice was originally to build `app/composables/useCanEdit.ts`. The final
whole-branch review on wave 0 found that **four** slices need the same
permission predicate, and that the real matrix is asymmetric in a way that is
easy to get wrong: a box's **update** rule accepts the creator *or* a granted
editor, but its **delete** rule accepts the creator **only**.

Four agents each re-deriving that from a 39KB generated migration would not have
agreed. So it now lives in wave 0's shared contract, and you **consume** it:

```ts
// pure, unit-tested, no $pb needed
canEditBox(box, userId, permissions): boolean
canDeleteBox(box, userId): boolean
canEditItem(box, userId, permissions): boolean

// the composable you will actually use on a page
useCanEdit(box: Ref<StorageBox | undefined>): {
  canEdit: ComputedRef<boolean>
  canDelete: ComputedRef<boolean>
}
```

Both fail closed while permissions are loading, so edit controls never flash on
for a user who cannot use them.

**Do not write your own version, and do not modify the shared one.** Check
`docs/superpowers/wave-0-interface-surface.md` for the exact signatures as
merged — they are authoritative over the sketch above. Use `canEdit` for edit
and add-item controls, and `canDelete` for the box delete control specifically.

Renumbering is deliberate: the tasks below keep their original numbers so that
this removal stays visible rather than silently closing the gap.

---

### Task 4: Box mutations

**Files:**
- Modify: `app/queries/boxes.ts` (append; do not alter the existing read functions or `boxFilter`)
- Test: `tests/nuxt/boxMutations.spec.ts`

**Interfaces:**
- Consumes: `keys`, `StorageBox`, `newQrId`, `compressImages`.
- Produces: `useCreateBox()`, `useUpdateBox()`, `useSetBoxStatus()`, `useDeleteBox()`, and the pure helper `boxUpdatePayload()`.

This is the highest-risk task in the slice. Both ownership rules apply here, and both were 403s during wave 0's probing.

- [ ] **Step 1: Write the failing test for the update payload builder**

The payload builder is pure and is where the `:isset = false` trap lives, so it gets a real test.

```ts
import { describe, expect, it } from 'vitest'
import { boxUpdatePayload } from '~/queries/boxes'
import type { StorageBox } from '~/types/pocketbase'

const existing: StorageBox = {
  id: 'box1', created: '', updated: '', title: 'Winter coats and boots',
  description: '', location: 'Garage shelf A3', images: ['a.jpg'],
  qr_id: 'seedbox1', status: 'active', tags: ['t_winter'], created_by: 'u_dana'
}

describe('boxUpdatePayload', () => {
  it('never includes created_by, which the update rule rejects outright', () => {
    const payload = boxUpdatePayload(existing, { title: 'Winter coats' })
    expect('created_by' in payload).toBe(false)
  })

  it('never includes qr_id, which is fixed once printed', () => {
    const payload = boxUpdatePayload(existing, { title: 'Winter coats' })
    expect('qr_id' in payload).toBe(false)
  })

  it('sends only the fields that actually changed', () => {
    expect(boxUpdatePayload(existing, { title: 'Winter coats' })).toEqual({ title: 'Winter coats' })
  })

  it('returns an empty payload when nothing changed', () => {
    expect(boxUpdatePayload(existing, { title: existing.title })).toEqual({})
  })

  it('detects a tag list change by content, not identity', () => {
    expect(boxUpdatePayload(existing, { tags: ['t_winter'] })).toEqual({})
    expect(boxUpdatePayload(existing, { tags: ['t_winter', 't_fragile'] }))
      .toEqual({ tags: ['t_winter', 't_fragile'] })
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test tests/nuxt/boxMutations.spec.ts`
Expected: FAIL — `boxUpdatePayload` is not exported.

- [ ] **Step 3: Implement, appended to `app/queries/boxes.ts`**

```ts
import type { BoxStatus, StorageBox } from '~/types/pocketbase'

/** Fields a user may edit on an existing box. */
export interface BoxEdit {
  title?: string
  description?: string
  location?: string
  tags?: string[]
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * Build a minimal update payload.
 *
 * The update rule is `@request.body.created_by:isset = false` — the request is
 * rejected if `created_by` is present *at all*, even set to the correct value.
 * So an update must never spread a fetched record. `qr_id` is excluded too:
 * it is printed on a physical label and must not drift.
 */
export function boxUpdatePayload(existing: StorageBox, edit: BoxEdit): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if (edit.title !== undefined && edit.title !== existing.title) payload.title = edit.title
  if (edit.description !== undefined && edit.description !== existing.description) payload.description = edit.description
  if (edit.location !== undefined && edit.location !== existing.location) payload.location = edit.location
  if (edit.tags !== undefined && !sameList(edit.tags, existing.tags)) payload.tags = edit.tags
  return payload
}

export interface NewBox {
  title: string
  description?: string
  location?: string
  tags?: string[]
  images?: File[]
}

export function useCreateBox() {
  const { $pb } = useNuxtApp()
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: NewBox): Promise<StorageBox> => {
      const body = new FormData()
      body.set('title', input.title)
      body.set('description', input.description ?? '')
      body.set('location', input.location ?? '')
      // No schema default: an omitted status lands empty and the box then
      // disappears from the index's `status = "active"` filter.
      body.set('status', 'active')
      // The create rule requires created_by to equal the authed user id.
      body.set('created_by', userId.value)
      for (const tag of input.tags ?? []) body.append('tags', tag)
      for (const image of await compressImages(input.images ?? [])) {
        body.append('images', image)
      }

      // qr_id is unique-constrained. A collision is vanishingly unlikely but
      // would be a confusing failure on a create form, so retry once.
      body.set('qr_id', newQrId())
      try {
        return await $pb.collection('storage_boxes').create<StorageBox>(body)
      } catch (e) {
        if (e instanceof ClientResponseError && e.status === 400 && 'qr_id' in (e.response?.data ?? {})) {
          body.set('qr_id', newQrId())
          return await $pb.collection('storage_boxes').create<StorageBox>(body)
        }
        throw e
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.boxes.all })
  })
}

export function useUpdateBox() {
  const { $pb } = useNuxtApp()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ existing, edit }: { existing: StorageBox, edit: BoxEdit }) =>
      $pb.collection('storage_boxes').update<StorageBox>(existing.id, boxUpdatePayload(existing, edit)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.boxes.all })
  })
}

/** Archive or restore. Archiving never deletes data — see PRD §7.2. */
export function useSetBoxStatus() {
  const { $pb } = useNuxtApp()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string, status: BoxStatus }) =>
      $pb.collection('storage_boxes').update<StorageBox>(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.boxes.all })
  })
}

/** Creator-only at the API. A granted editor gets a 403 here by design. */
export function useDeleteBox() {
  const { $pb } = useNuxtApp()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => $pb.collection('storage_boxes').delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.boxes.all })
  })
}
```

`ClientResponseError` needs a real import — it is a value, not a type: `import { ClientResponseError } from 'pocketbase'`.

Images go via `FormData` because PocketBase file uploads cannot be sent as JSON.

- [ ] **Step 4: Run the test**

Run: `pnpm test tests/nuxt/boxMutations.spec.ts`
Expected: PASS, 5 tests. Then `pnpm lint` clean.

- [ ] **Step 5: Commit**

```bash
git add app/queries/boxes.ts tests/nuxt/boxMutations.spec.ts
git commit -m "Add box create, update, archive and delete mutations"
```

---

### Task 5: Item mutations

**Files:**
- Modify: `app/queries/items.ts` (append)
- Test: `tests/nuxt/itemMutations.spec.ts`

**Interfaces:**
- Produces: `useCreateItem()`, `useUpdateItem()`, `useDeleteItem()`, `useMoveItems()`, and the pure `itemUpdatePayload()`.

`useMoveItems` is the bulk-move action from PRD §7.4. It moves several items to another box in one user action; PocketBase has no batch endpoint, so it issues one update per item and reports partial failure honestly rather than claiming success.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { itemUpdatePayload } from '~/queries/items'
import type { StorageItem } from '~/types/pocketbase'

const existing: StorageItem = {
  id: 'i1', created: '', updated: '', box: 'box1', title: 'Navy wool peacoat',
  description: 'Size M', notes: 'Dry clean first', images: [], tags: [],
  created_by: 'u_dana'
}

describe('itemUpdatePayload', () => {
  it('never includes created_by, which the update rule rejects outright', () => {
    expect('created_by' in itemUpdatePayload(existing, { title: 'Peacoat' })).toBe(false)
  })

  it('sends only what changed', () => {
    expect(itemUpdatePayload(existing, { notes: 'Dry clean first' })).toEqual({})
    expect(itemUpdatePayload(existing, { notes: 'Repaired' })).toEqual({ notes: 'Repaired' })
  })

  it('allows moving an item to another box', () => {
    expect(itemUpdatePayload(existing, { box: 'box2' })).toEqual({ box: 'box2' })
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test tests/nuxt/itemMutations.spec.ts`
Expected: FAIL — `itemUpdatePayload` is not exported.

- [ ] **Step 3: Implement, appended to `app/queries/items.ts`**

Mirror `boxUpdatePayload` exactly in shape — a reader who has seen one should recognise the other. Cover `title`, `description`, `notes`, `tags`, and `box`; never `created_by`.

`useCreateItem` takes `{ boxId, title, description?, notes?, tags?, images? }`, builds `FormData`, sets `box`, sets `created_by` to `userId.value`, compresses images via `compressImages`, and on success invalidates **both** `keys.items.all` and `keys.boxes.all` — a box's item count is visible on the index.

`useMoveItems` takes `{ ids: string[], toBoxId: string }` and:

```ts
mutationFn: async ({ ids, toBoxId }: { ids: string[], toBoxId: string }) => {
  const failures: string[] = []
  for (const id of ids) {
    try {
      await $pb.collection('storage_items').update(id, { box: toBoxId })
    } catch (e) {
      failures.push(pbError(e))
    }
  }
  // PocketBase has no batch update. Partial success is a real outcome and the
  // UI must say so rather than reporting a clean move.
  if (failures.length > 0) {
    throw new Error(`Moved ${ids.length - failures.length} of ${ids.length}. ${failures[0]}`)
  }
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm test tests/nuxt/itemMutations.spec.ts`
Expected: PASS, 3 tests. Then `pnpm lint` clean.

- [ ] **Step 5: Commit**

```bash
git add app/queries/items.ts tests/nuxt/itemMutations.spec.ts
git commit -m "Add item create, update, delete and bulk-move mutations"
```

---

### Task 6: Box index page

**Files:**
- Modify: `app/pages/index.vue` (replace the placeholder)
- Create: `app/components/BoxCard.vue`

**Interfaces:**
- Consumes: `useBoxList`, `useAuth`.
- Produces: the `/` screen.

Required behaviour (PRD §7.2):
- Grid of **active** boxes: title, first image as thumbnail, location when set, item count is *not* required here.
- A toggle to include archived boxes. Default hides them.
- **Loading state** — skeletons, `data-testid="box-list-loading"`.
- **Empty state** — `data-testid="box-list-empty"`, with a call to action to create the first box. Reachable on a fresh instance, so it must not look broken.
- **Error state** — `pbError(error)` surfaced, not swallowed.
- Prominent "New box" action linking to `/box/new`.
- A link to `/print-sheet` (slice C's route; the stub exists).
- A box with no title must still render something identifiable — seeded data has none, but the schema allows it. Fall back to the `qr_id`.
- `data-testid="box-card"` on each card, and each links to `/box/<qr_id>`.

Pagination: `useBoxList` returns `PER_PAGE = 30` per page. Wire a `UPagination` when `totalPages > 1`; do not fetch everything.

- [ ] **Step 1: Write the failing e2e test**

`tests/e2e/boxes.spec.ts`, using the seeded fixture as `dana`:

```ts
import { expect, test } from '@playwright/test'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

test('lists active boxes and hides archived ones by default', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Winter coats and boots')).toBeVisible()
  await expect(page.getByText('Empty spare box')).toBeVisible()
  // seedbox5 is archived
  await expect(page.getByText('College photo albums')).toBeHidden()
})

test('can reveal archived boxes', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('show-archived').click()
  await expect(page.getByText('College photo albums')).toBeVisible()
})

test('opens a box from its card', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Winter coats and boots').click()
  await expect(page).toHaveURL('/box/seedbox1')
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test:e2e tests/e2e/boxes.spec.ts`
Expected: FAIL — the placeholder page renders none of this.

- [ ] **Step 3: Implement the page and `BoxCard`**

Thumbnails resolve with `$pb.files.getURL(box, box.images[0], { thumb: '200x200' })`. Guard the no-image case.

- [ ] **Step 4: Run the test**

Expected: PASS, 3 tests.

- [ ] **Step 5: Verify the empty state is genuinely reachable**

The seed always creates boxes, so assert the empty state directly rather than leaving it untested: filter to a tag that matches nothing, or temporarily archive everything in a test that restores afterwards. State in your report which approach you took and why.

- [ ] **Step 6: Commit**

```bash
git add app/pages/index.vue app/components/BoxCard.vue tests/e2e/boxes.spec.ts
git commit -m "Add box index page"
```

---

### Task 7: Create-box page

**Files:**
- Create: `app/pages/box/new.vue`, `app/components/BoxForm.vue`

`BoxForm` is shared by create and by the edit path in Task 8, so build it to take an optional existing box and emit a payload.

Required behaviour (PRD §7.2 and acceptance criteria):
- **Title is the only field a user must fill.** Everything else — description, location, images, tags — is optional. The acceptance criteria call out "create a box with just a title" explicitly.
- Multiple image upload, compressed via `compressImages`, capped at 15 with a clear message rather than a silent truncation.
- On success, navigate to the new box's `/box/<qr_id>` so the QR is immediately printable.
- Submit disabled while pending; **duplicate submit must not create two boxes**.
- Failure surfaces `pbError` and leaves the user on the form with their input intact.
- Tags: leave a slot for slice B's `TagPicker` but **do not import it** — B owns that component and it may not exist in your worktree. Ship the form without tag selection; wave 3 wires it in.

- [ ] **Step 1: Write the failing e2e test**

Covering the acceptance criterion directly, plus the duplicate-submit unhappy path. The test must delete the box it creates.

```ts
test('creates a box with only a title and lands on its page', async ({ page }) => {
  await page.goto('/box/new')
  await page.getByLabel('Title').fill('Loft bedding and spare pillows')
  await page.getByRole('button', { name: 'Create box' }).click()
  await expect(page).toHaveURL(/\/box\/[a-z0-9]{8}$/)
  await expect(page.getByText('Loft bedding and spare pillows')).toBeVisible()
})
```

- [ ] **Step 2-4: Watch it fail, implement, watch it pass**

- [ ] **Step 5: Commit**

```bash
git add app/pages/box/new.vue app/components/BoxForm.vue tests/e2e/boxes.spec.ts
git commit -m "Add create-box page"
```

---

### Task 8: Box detail page

**Files:**
- Create: `app/pages/box/[qr_id]/index.vue`, `app/components/ItemCard.vue`

The most-linked page in the app and the target of every printed QR code.

Required behaviour:
- Box title, description, location, image gallery.
- The **item list** for this box, via `useItemList`, paginated, each item linking to `/item/<id>`.
- **"+ Add item"** action, visible only when `canEdit`.
- **Edit** and **Archive/Unarchive** controls, visible only when `canEdit`; **Delete** only when `canDelete`.
- Links to `/box/<qr_id>/print` and `/box/<qr_id>/share` — both are stubs owned by other slices; link to them anyway.
- **Loading state** and an **empty item list state** (`seedbox4` is the fixture for this).
- **Box-not-found state** for an unknown `qr_id`: PRD §7.3 requires a clear "box not found", not a generic error. `useBoxByQrId` sets `retry: false` so the 404 arrives immediately — render a distinct `data-testid="box-not-found"`.
- Bulk move (PRD §7.4): a selection mode over the item list with a "Move to…" action calling `useMoveItems`, gated on `canEdit`.

- [ ] **Step 1: Write the failing e2e tests**

Three permission perspectives, using the seeded grants — this is where the permission model is actually proven:

```ts
test.describe('as the box creator', () => {
  test.use({ storageState: 'tests/e2e/.auth/dana.json' })
  test('sees edit and delete controls', async ({ page }) => {
    await page.goto('/box/seedbox1')
    await expect(page.getByTestId('edit-box')).toBeVisible()
    await expect(page.getByTestId('delete-box')).toBeVisible()
  })
  test('lists the items in the box', async ({ page }) => {
    await page.goto('/box/seedbox1')
    await expect(page.getByText('Navy wool peacoat')).toBeVisible()
  })
  test('shows an empty state for a box with no items', async ({ page }) => {
    await page.goto('/box/seedbox4')
    await expect(page.getByTestId('item-list-empty')).toBeVisible()
  })
  test('shows a not-found state for an unknown code', async ({ page }) => {
    await page.goto('/box/nosuchbox')
    await expect(page.getByTestId('box-not-found')).toBeVisible()
  })
})

test.describe('as a granted editor', () => {
  test.use({ storageState: 'tests/e2e/.auth/sam.json' })
  test('can edit the box they were granted, but not delete it', async ({ page }) => {
    await page.goto('/box/seedbox1')
    await expect(page.getByTestId('edit-box')).toBeVisible()
    await expect(page.getByTestId('delete-box')).toBeHidden()
  })
  test('cannot edit a box they were not granted', async ({ page }) => {
    await page.goto('/box/seedbox2')
    await expect(page.getByTestId('edit-box')).toBeHidden()
  })
})

test.describe('as a read-only member', () => {
  test.use({ storageState: 'tests/e2e/.auth/rae.json' })
  test('can view every box but edit none', async ({ page }) => {
    await page.goto('/box/seedbox1')
    await expect(page.getByText('Winter coats and boots')).toBeVisible()
    await expect(page.getByTestId('edit-box')).toBeHidden()
    await expect(page.getByTestId('add-item')).toBeHidden()
  })
})
```

- [ ] **Step 2: Run and watch them fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run and watch them pass**

- [ ] **Step 5: Extend wave 0's deep-link test**

`tests/e2e/auth.spec.ts` currently asserts only that `/box/seedbox1` is the URL after login — because this page did not exist. Now it does. Extend that assertion to check the box's title renders, so the test proves a working screen is reached rather than just a surviving URL.

This is the one file outside your ownership you are explicitly authorised to touch, and only for this assertion.

- [ ] **Step 6: Commit**

```bash
git add app/pages/box/\[qr_id\]/index.vue app/components/ItemCard.vue tests/e2e/
git commit -m "Add box detail page with permission-gated controls"
```

---

### Task 9: Item create and detail

**Files:**
- Create: `app/pages/item/[id].vue`, `app/components/ItemForm.vue`

Required behaviour (PRD §7.4):
- Create from box detail: **title required**, description, notes, multiple images optional. Associates to the current box.
- Item detail shows title, description, notes, and an image **gallery supporting multiple images** — the acceptance criteria call this out specifically.
- Edit and delete, gated on `canEdit` for the **parent** box (`useItem` expands `box`, so the parent is available without a second fetch).
- Loading, empty-gallery, and not-found states.
- Leave room below the item body for slice E's comment thread in wave 2, but **do not build it**.

- [ ] **Step 1: Write the failing e2e test**

Include the multi-image acceptance criterion, uploading two real fixture images. Create small PNGs on the fly rather than committing binary fixtures. Clean up the created item.

- [ ] **Steps 2-4: Fail, implement, pass**

- [ ] **Step 5: Commit**

```bash
git add app/pages/item app/components/ItemForm.vue tests/e2e/
git commit -m "Add item create and detail pages"
```

---

### Task 10: Slice exit check

**Files:** none.

- [ ] **Step 1: Full loop from a cold start**

```bash
docker compose down -v && docker compose up -d
sleep 5
python3 scripts/pb-seed.py http://localhost:8090
pnpm lint && pnpm test && pnpm test:e2e
```

Green with no manual steps. Re-run e2e before concluding red — it is flaky under machine load.

- [ ] **Step 2: Confirm you stayed inside your ownership**

```bash
git diff --name-only main...HEAD
```

Every path must be one you own, plus `tests/e2e/auth.spec.ts` (the authorised deep-link assertion). Anything else is a finding to report, not to keep.

- [ ] **Step 3: Report the interfaces you produced**

List the exact exports other slices may now use — the mutation hooks, `useCanEdit`, `newQrId`, `compressImage`/`compressImages` — with their signatures. Wave 2 and 3 plans are written against this.

## Self-Review

**Spec coverage.** PRD §7.2 create box → Task 7; box index → Task 6; box detail → Task 8; archive → Tasks 4 and 8; §7.4 create item → Task 9; item detail → Task 9; edit/delete item → Tasks 5 and 9; bulk move → Tasks 5 and 8. Acceptance criteria "create with just a title" → Task 7 step 1; "multiple photos in a gallery" → Task 9; "second member cannot edit" → Task 8 step 1; "creator can grant editor" → wave 2 slice F, not here.

**Deliberately out of scope.** Tag selection in the box and item forms (slice B builds `TagPicker`; wave 3 wires it in), the comment thread (wave 2 slice E), the share page (wave 2 slice F), search (wave 2 slice G), and the QR image itself (slice C). Their routes are linked from here and resolve to wave 0's stubs.

**Contract dependency.** `useCanEdit` / `canEditBox` / `canDeleteBox` come from wave 0 (see the removed Task 3). If they are not present in your worktree, stop and report rather than writing a local copy — a divergent permission check is the defect this consolidation exists to prevent.

**Known risk.** Task 8 is the largest single task and touches permissions, pagination, empty states and bulk move. If it grows beyond what one reviewable diff should hold, split bulk move into its own task rather than letting the diff sprawl — say so in the report rather than deciding silently.
