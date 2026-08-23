# Box Manifest — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A printable list of what is in a box, to fold and tape inside the lid.

**Why:** Every route into this app's contents currently runs through a phone: scan the label, or search. A manifest is the fallback for a flat battery, a lender who does not have the app, a loft with no signal and a box that has already been opened. It is also the cheapest thing on the list — it is a second print route beside `/box/[qr_id]/print`, reusing the same page mechanics.

**Architecture:** One new route, one query it already has, and print CSS. No new collection, no new field, no new mutation.

**Tech Stack:** Nuxt 4 SPA, Nuxt UI 4, PocketBase 0.39.11, `@peterbud/nuxt-query`, Vitest, Playwright, pnpm.

## Does this need a database change?

**No.** It renders `storage_boxes` and its `storage_items`, both of which the box detail page already reads.

## Global Constraints

- **pnpm** only. **Done means** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all green.
- **No `any`**, no `as`, no non-null `!`.
- Reads through nuxt-query. Loading, empty and error states on everything.
- Follow `CLAUDE.md`. Read `docs/storage-app-prd.md` before starting.

## The one thing that will bite you

**`useInfiniteItemList` gives you the first thirty items, not all of them.** A manifest that silently stops at thirty is worse than no manifest — it is a list that looks complete and is not.

Two honest options, in order of preference:

1. **Fetch every page before rendering.** A dedicated `useBoxManifest(boxId)` that pages until `page === totalPages`, with a hard cap and a visible warning if the cap is hit. `useTags()` and `useAppUsers()` are the app's only two deliberate `getFullList` exceptions and both are justified as *small bounded vocabularies* — a box's contents is neither, so this pages rather than calling `getFullList`.
2. **Print what is loaded and say so.** Cheaper, and wrong for the use case: the whole point is completeness.

Take option 1, and put the count on the sheet (*"48 items"*) so a reader can tell at a glance whether the paper matches the box.

---

### Task 1: The query

**Files:** Modify `app/queries/items.ts` (append). Test: `tests/nuxt/itemMutations.spec.ts` or a new `tests/nuxt/boxManifest.spec.ts`

**Produces:** `useBoxManifest(boxId: Ref<string>)`

- [ ] **Step 1: Write the failing test**

- Pages until exhausted: 70 items over `PER_PAGE` 30 comes back as 70, in three requests, **sequentially** (the SDK cancels concurrent requests to the same endpoint).
- Stops at a cap — 500 — and reports `truncated: true` rather than looping forever on a bad `totalPages`.
- Gated on `boxId !== ''`, never on truthiness: `''` and `undefined` mean opposite things here (`CLAUDE.md`).
- Sorted by `title`, not `-created`. A manifest is read by eye against a physical box; creation order is meaningless on paper.

- [ ] **Step 2: Implement**
- [ ] **Step 3: Verify**

---

### Task 2: The page

**Files:** New `app/pages/box/[qr_id]/manifest.vue`

**Produces:** `/box/:qr_id/manifest`

- [ ] **Step 1: Build it**

`definePageMeta({ nav: false })`, an `AppHeader` in the box's colour with a back control and a Print button — mirror `print.vue`, which is the closest existing page.

The sheet itself:

- The box's colour band across the top with its **name, location and code** — this is the header that makes a loose sheet re-attachable to the right box.
- A small QR, so the paper is a route back into the app rather than a dead end. Reuse `<QrCode>` and `boxQrUrl`.
- The items as a plain list: title, and description where there is one. **No photos** — they are the largest thing on the page and the least useful in monochrome.
- Item **notes are editors-only in the schema.** Decide deliberately and write the decision in a comment: a manifest taped inside a lid is readable by anyone in the house, and notes are where "second battery holds charge poorly" lives. Recommendation: **include them**, because the sheet is for the household and the box's own lid is not a public place — but state it, do not let it happen by accident.
- A checkbox glyph (`☐`) beside each line so the sheet doubles as a packing check.
- A footer: item count, and the date printed. Paper goes stale; undated paper goes stale invisibly.

Print CSS: A4/Letter portrait, `@page { margin: 0.5in }`, `break-inside: avoid` on rows, and the app chrome hidden — `.sb-header` and `.no-print` are already handled by the global rule in `main.css`.

- [ ] **Step 2: Reachability**

Add it to box detail's kebab beside "Label". Do **not** add a fourth button to the Edit/Label/Archive row — it is already three wide on a 390px screen.

- [ ] **Step 3: Verify**

---

### Task 3: E2E

**Files:** New `tests/e2e/manifest.spec.ts`

- [ ] A box it creates with 35 items renders all 35, not 30. This is the assertion the whole feature turns on.
- [ ] Header carries the box name, location and code.
- [ ] An empty box gets an empty state, not a bare header with nothing under it.
- [ ] An unknown code gets the 404 screen, matching `print.vue`.
- [ ] Teardown via `throwawayBoxes()` in `afterEach`.

---

## Out of scope

- Printing manifests for several boxes at once. `/print-sheet` is the batch surface and it is about labels; a batch of multi-page manifests is a different document.
- PDF export. `window.print()` and the browser's own "Save as PDF" already cover it; a PDF library is a dependency for a button the OS provides.
- A "last checked" timestamp per box. Genuinely useful next to a manifest, and a schema change — its own plan.
