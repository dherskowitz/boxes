# Bulk Add Items — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill a box in one pass instead of one modal at a time. Paste or type a list of names, get one item per line.

**Why:** Adding twelve items to a box is currently twelve round trips through `ItemForm`. The empty-box copy already promises the other half of this — *"Add items one at a time, or photograph the whole box and label things later"* — and nothing implements the second clause. Unpacking a box is a burst activity; the form is built for the single afterthought.

**Architecture:** One new modal on box detail, one mutation that creates N items in sequence, and a pure parser. No new collection, no new field.

**Tech Stack:** Nuxt 4 SPA, Nuxt UI 4, PocketBase 0.39.11, `@peterbud/nuxt-query`, Vitest, Playwright, pnpm.

## Does this need a database change?

**No.** `storage_items` already has everything: `box` (required relation), `title` (required), and `created_by`. A bulk add is N ordinary creates. Nothing in `pb_migrations/` moves.

## Global Constraints

- **pnpm** only. **Done means** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all green. TDD: failing test first.
- **No `any`**, no `as` to silence an error, no non-null `!`.
- All reads and writes through nuxt-query. `assertOnline()` first in the mutation. `created_by` set on every create, from `useAuthUser()`.
- Surface failures through `pbError(e)`.
- Follow `CLAUDE.md`. Read `docs/storage-app-prd.md` before starting.

## The one thing that will bite you

**PocketBase's SDK cancels concurrent requests to the same endpoint.** `Promise.all` over twelve creates keeps roughly the last one and silently drops the rest — and the cancelled ones still land server-side afterwards, so the list you refetch is neither what you sent nor what you see. This is already written down in `CLAUDE.md` for tests; it applies with more force here, because this is production code creating a dozen records at once.

Create them **sequentially**, and report progress as you go.

---

### Task 1: The parser

**Files:** New `app/utils/parseItemLines.ts`. Test: `tests/nuxt/parseItemLines.spec.ts`

**Produces:** `parseItemLines(raw: string): string[]`

A pure function so the rules are testable without a browser or a database.

- [ ] **Step 1: Write the failing test**

Cover, at minimum:

```ts
// Trims, drops blank lines, and keeps the order typed.
expect(parseItemLines(' Kettle lead\n\n  HDMI cable  \n')).toEqual(['Kettle lead', 'HDMI cable'])

// A pasted bulleted list is the most likely input — strip the bullet, not the words.
expect(parseItemLines('- Kettle lead\n* HDMI cable\n• Mains adaptor')).toEqual([
  'Kettle lead', 'HDMI cable', 'Mains adaptor'
])

// Numbered lists too: "1. " and "1) " are list markup, "2019 returns" is a title.
expect(parseItemLines('1. Kettle lead\n2) HDMI cable')).toEqual(['Kettle lead', 'HDMI cable'])
expect(parseItemLines('2019 returns and receipts')).toEqual(['2019 returns and receipts'])

// Duplicates within one paste are kept: two identical cables are two cables.
expect(parseItemLines('Kettle lead\nKettle lead')).toHaveLength(2)

// Nothing usable is an empty list, not a list of one empty string.
expect(parseItemLines('   \n\n  ')).toEqual([])
```

- [ ] **Step 2: Implement**
- [ ] **Step 3: Verify** — `pnpm test`, then `pnpm lint && pnpm typecheck`

---

### Task 2: The mutation

**Files:** Modify `app/queries/items.ts` (append). Test: `tests/nuxt/itemMutations.spec.ts` (append)

**Produces:** `useCreateItems()`

```ts
useCreateItems(): { boxId: string, titles: string[] } => Promise<{ created: StorageItem[], failed: { title: string, message: string }[] }>
```

- [ ] **Step 1: Write the failing test**

The behaviour that needs proving is the failure path, not the happy one:

- Creates run **in sequence**, not concurrently. Assert the mock was called in order and never re-entered.
- **A failure part-way does not roll back and does not abort the rest.** Item 7 of 12 failing must still leave items 1–6 and 8–12 created, and must come back in `failed`. There is no transaction to hide behind, and losing eleven good items because one had a bad character is the worse outcome.
- `created_by` is set on every create — the create rule compares `@request.body.created_by = @request.auth.id` and an omitted field resolves to empty and fails.
- Progress is observable: expose a `progress` ref (`{ done, total }`) so the UI can say "7 of 12" rather than spinning.

- [ ] **Step 2: Implement**

`assertOnline()` once, before the loop — not per item.

Invalidate `keys.items.all` **once, at the end**. Invalidating per item refetches the list a dozen times.

- [ ] **Step 3: Verify**

---

### Task 3: The modal

**Files:** New `app/components/BulkAddItems.vue`. Modify `app/pages/box/[qr_id]/index.vue`.

**Produces:** A "Add several" affordance next to "Add item" on box detail.

- [ ] **Step 1: Build it**

- A `UTextarea`, `rows="8"`, placeholder showing the format by example, not by instruction.
- A live count under it — "12 items" — parsed with `parseItemLines`. That is the preview; do not build a second list of chips the user then has to keep in sync with the text they are still editing.
- Submit is disabled only while pending, never as a stand-in for validation (`CLAUDE.md`). An empty paste shows a `FormError`, it does not grey the button.
- While pending: "Adding 7 of 12…", from the mutation's `progress`.
- On partial failure: keep the modal open, list what failed with its reason, and **leave the failed titles in the textarea** so the user can fix and retry without retyping. Do not close a modal that half-worked.

- [ ] **Step 2: Wire it into box detail**

The fixed action bar already holds Move/Add item. Put this behind the existing kebab (`DropdownMenuItem`) rather than adding a third button to a bar that is already two wide on a 390px screen.

- [ ] **Step 3: Verify**

---

### Task 4: E2E

**Files:** New `tests/e2e/bulkAdd.spec.ts`

- [ ] Pastes six lines into a box it creates itself, asserts six rows appear **without a reload** (the service worker's cache is network-first now — this is the assertion that keeps it that way).
- [ ] A bulleted paste produces clean titles, no leading `-`.
- [ ] Offline: `assertOnline()` surfaces a message in the modal, the textarea keeps its content, and the button is usable again (PRD §7.8).
- [ ] Teardown via `throwawayBoxes()` in `afterEach`, never a `finally`.

---

## Out of scope

- Descriptions, notes, tags or photos per line. A bulk add is for names; anything else is a second pass through the item you just made.
- CSV or spreadsheet import. The empty index nods at it (`OR IMPORT A SPREADSHEET`) but that is a file picker, a column mapper and an encoding problem — its own plan.
