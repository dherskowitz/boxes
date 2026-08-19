# Slice C — QR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the physical loop — turn a box into a printable QR label, print many labels in one job, and scan a code from inside the app to jump to its box.

**Architecture:** QR codes are generated client-side from the box's existing `qr_id`; nothing is stored. The payload is a URL, so a phone's native camera opens it with no app involvement — the in-app scanner is a convenience for when the user is already in the app, not the primary path.

**Tech Stack:** Nuxt 4 SPA, Nuxt UI 4, `qrcode` (generation), `vue-qrcode-reader` (camera), PocketBase 0.39.11, Vitest, Playwright, pnpm. Both QR packages are already dependencies — do not add any.

**Spec:** `docs/superpowers/specs/2026-08-19-storage-app-v1-design.md`
**Contract:** `docs/superpowers/wave-0-interface-surface.md` — read first.
**Coordination:** `docs/superpowers/plans/2026-08-19-wave-1-overview.md`

## Global Constraints

- Package manager is **pnpm**. Never npm or yarn. **Do not add a dependency** — `qrcode` and `vue-qrcode-reader` are already installed, and `package.json` is not yours to edit.
- **Done means** `pnpm lint && pnpm test && pnpm test:e2e` green in your worktree. TDD: failing test first. Never `.skip`/`.only`, never weaken a test. E2E is flaky under machine load — re-run before concluding red.
- **No `any`**, no `as` to silence an error, no non-null `!`.
- Nuxt auto-imports are on. No imports for composables, components, `app/utils/`, `app/queries/`. `import type` IS required.
- **All reads go through nuxt-query.** Never call `pb.collection().…` from a component.
- **Barebones styling**, with one exception stated below.
- Every screen needs a loading state and an empty state.
- Surface failures through `pbError(e)`.
- Commits: no attribution footers, no emoji trailers.
- **You own** `app/pages/box/[qr_id]/print.vue` (replacing wave 0's stub), `app/pages/print-sheet.vue`, and `app/components/Qr*`. Nothing else. **You do not add navigation links** — slice A already links to both your routes from the box detail page and the index. If you believe you need another file, stop and report.

### The styling exception

`@media print` rules **are** permitted, and only on your two print routes. Label layout is functional: a sticker that does not fit its backing paper is a broken feature, not an ugly one. Everything else stays barebones — no colour classes, no decorative CSS, no `main.css` or `app.config.ts` edits.

## The one thing that must be right

The QR payload is `{app_origin}/box/{qr_id}` — an absolute URL, because a phone camera resolves it with no context. Get the origin from `window.location.origin`; do not hardcode one and do not read it from `runtimeConfig` (that config holds the **PocketBase** URL, which is a different host in production).

A label whose QR encodes the wrong origin is worse than no label: it is printed, stuck to a physical box, and discovered wrong months later. Task 1 tests this specifically.

---

### Task 1: QR payload and code generation

**Files:**
- Create: `app/utils/qrPayload.ts`, `app/components/QrCode.vue`
- Test: `tests/nuxt/qrPayload.spec.ts`

**Interfaces:**
- Consumes: `qrcode`.
- Produces: `boxQrUrl(qrId: string, origin: string): string` and `<QrCode :value="url" :size="240" />`.

`boxQrUrl` takes the origin as a parameter rather than reading `window` itself, so it is testable without a DOM and so the caller is forced to be explicit about which origin a label will carry.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { boxQrUrl } from '~/utils/qrPayload'

describe('boxQrUrl', () => {
  it('encodes an absolute URL a phone camera can open unaided', () => {
    expect(boxQrUrl('seedbox1', 'https://storage.example.com'))
      .toBe('https://storage.example.com/box/seedbox1')
  })

  it('does not double up the slash when the origin has a trailing one', () => {
    expect(boxQrUrl('seedbox1', 'https://storage.example.com/'))
      .toBe('https://storage.example.com/box/seedbox1')
  })

  it('works against a local dev origin including its port', () => {
    expect(boxQrUrl('abc12345', 'http://127.0.0.1:3000'))
      .toBe('http://127.0.0.1:3000/box/abc12345')
  })

  it('refuses an empty qr_id rather than printing a label to the box list', () => {
    expect(() => boxQrUrl('', 'https://storage.example.com')).toThrow()
  })

  it('refuses an empty origin rather than printing a relative URL', () => {
    expect(() => boxQrUrl('seedbox1', '')).toThrow()
  })
})
```

The two throwing cases are the point. A label encoding `/box/` or a relative path is indistinguishable from a good one until someone scans it off a physical box.

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm test tests/nuxt/qrPayload.spec.ts`
Expected: FAIL — cannot resolve `~/utils/qrPayload`.

- [ ] **Step 3: Implement**

```ts
/**
 * The URL a printed QR code carries.
 *
 * Absolute on purpose: a phone's native camera opens this with no app context,
 * so a relative path would be meaningless. The origin is a parameter rather
 * than read from `window` here so it can be tested without a DOM — and so
 * callers must be explicit about which origin they are committing to paper.
 *
 * Note this is the *app* origin, not `runtimeConfig.public.pocketbaseUrl`,
 * which is a different host in production.
 */
export function boxQrUrl(qrId: string, origin: string): string {
  if (!qrId) throw new Error('boxQrUrl: qr_id is required')
  if (!origin) throw new Error('boxQrUrl: origin is required')
  return `${origin.replace(/\/+$/, '')}/box/${qrId}`
}
```

`QrCode.vue` renders to a `<canvas>` (or a data-URL `<img>`) via `qrcode`'s `toCanvas`/`toDataURL`, with `errorCorrectionLevel: 'M'` — a label on a storage box picks up scuffs, and `M` tolerates about 15% damage at modest size cost. Expose `value` and `size` props. Regenerate when `value` changes.

- [ ] **Step 4: Run the test** — PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add app/utils/qrPayload.ts app/components/QrCode.vue tests/nuxt/qrPayload.spec.ts
git commit -m "Add QR payload builder and code component"
```

---

### Task 2: Single label print page

**Files:**
- Modify: `app/pages/box/[qr_id]/print.vue` (replace wave 0's stub)

Required behaviour (PRD §7.2):
- The box's QR code and its title, laid out for a standard label or sticker.
- The `qr_id` printed as **text** beneath the code. PRD §11 keeps `qr_id` short and typeable precisely so a human can enter it when a code will not scan — printing it only inside the QR throws that away.
- A print action, and `@media print` rules that hide the app chrome so only the label prints.
- **Loading state** while the box resolves.
- **Not-found state** for an unknown `qr_id` (`useBoxByQrId` sets `retry: false`, so the 404 arrives immediately) — `data-testid="box-not-found"`.
- A box with no title still prints a usable label; fall back to the `qr_id`.

The layout should hide the default layout's nav when printing. Since `app/layouts/default.vue` is not yours, do this from your page's own `@media print` block by hiding what you do not need, rather than changing the layout.

- [ ] **Step 1: Write the failing e2e test**

```ts
import { expect, test } from '@playwright/test'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

test('renders a printable label with the code and a typeable fallback', async ({ page }) => {
  await page.goto('/box/seedbox1/print')
  await expect(page.getByText('Winter coats and boots')).toBeVisible()
  await expect(page.getByTestId('qr-code')).toBeVisible()
  // The human-readable fallback for when a scan fails (PRD §11)
  await expect(page.getByText('seedbox1')).toBeVisible()
})

test('shows a not-found state for an unknown code', async ({ page }) => {
  await page.goto('/box/nosuchbox/print')
  await expect(page.getByTestId('box-not-found')).toBeVisible()
})
```

- [ ] **Step 2: Run and watch it fail** — the stub renders none of this.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run and watch it pass**

- [ ] **Step 5: Verify the encoded URL is actually right**

This is the failure that only shows up on paper, so assert it in the test rather than trusting the render: read the generated canvas or data URL and confirm it encodes `<origin>/box/seedbox1` with the origin Playwright is actually serving from. If decoding the canvas is impractical, expose the URL in a `data-qr-value` attribute on the component and assert that — say in your report which you did.

- [ ] **Step 6: Commit**

```bash
git add app/pages/box/\[qr_id\]/print.vue tests/e2e/qr.spec.ts
git commit -m "Add printable QR label page"
```

---

### Task 3: Batch print sheet

**Files:**
- Create: `app/pages/print-sheet.vue`

Required behaviour (PRD §7.2):
- Select multiple boxes, then render one sheet with a QR and label per box, laid out for a single print job.
- Selection should be workable for someone who has just created several boxes — offer select-all and clear-all rather than only per-row checkboxes.
- Archived boxes are excluded by default, consistent with the index.
- **Loading**, **empty** (`data-testid="print-sheet-empty"` — no boxes exist yet), and **nothing-selected** states are all distinct. Rendering an empty sheet because nothing was ticked reads as broken.
- `@media print` rules that print only the sheet, and a grid that does not split a label across a page break.

Pagination matters here: `useBoxList` returns 30 per page. Selecting across pages is scope the PRD does not ask for — restrict selection to the loaded page and say so in the UI, rather than silently fetching everything and violating the pagination rule.

- [ ] **Step 1: Write the failing e2e test**

Cover selecting two boxes and rendering two labels, and the nothing-selected state.

- [ ] **Steps 2-4: Fail, implement, pass**

- [ ] **Step 5: Commit**

```bash
git add app/pages/print-sheet.vue tests/e2e/qr.spec.ts
git commit -m "Add batch QR print sheet"
```

---

### Task 4: In-app scanner

**Files:**
- Create: `app/components/QrScanner.vue`

Required behaviour (PRD §7.3):
- Camera-based scanning via `vue-qrcode-reader`, opened from the box index. **Slice A owns the index page and already provides the entry point** — build the component so it can be opened as a modal from there, and do not edit `index.vue` yourself. If A's entry point is not present in your worktree, state that in your report; wave 3 or the merge step wires it.
- On a successful scan, extract the `qr_id` from the scanned URL and navigate to `/box/<qr_id>`.
- **A scanned code from a different app or site must not navigate.** Accept only a URL whose path matches `/box/<8 lowercase alphanumerics>`; anything else shows "That is not a storage box code" and keeps scanning. This is the security-relevant part: a QR code is untrusted input a stranger can print and leave lying around, and navigating anywhere it says is how that becomes a phishing vector.
- **Camera permission denied** is the common unhappy path on a phone and must be handled explicitly, with a message telling the user how to proceed — not a blank frame.
- No camera available at all (desktop) → a clear message, not a crash.

- [ ] **Step 1: Write the failing unit test for the parser**

The parser is where the security decision lives, so it is pure and directly tested. Put it in `app/utils/qrPayload.ts` beside `boxQrUrl`.

```ts
import { describe, expect, it } from 'vitest'
import { qrIdFromScan } from '~/utils/qrPayload'

describe('qrIdFromScan', () => {
  it('accepts a code this app printed', () => {
    expect(qrIdFromScan('https://storage.example.com/box/seedbox1')).toBe('seedbox1')
  })

  it('accepts one printed against a different origin, since the id is what matters', () => {
    expect(qrIdFromScan('http://127.0.0.1:3000/box/abc12345')).toBe('abc12345')
  })

  it('rejects an unrelated URL rather than navigating where a stranger says', () => {
    expect(qrIdFromScan('https://evil.example.com/phish')).toBeNull()
  })

  it('rejects a URL that merely contains /box/ elsewhere in the path', () => {
    expect(qrIdFromScan('https://evil.example.com/redirect?to=/box/seedbox1')).toBeNull()
  })

  it('rejects a malformed id', () => {
    expect(qrIdFromScan('https://storage.example.com/box/NOT-AN-ID')).toBeNull()
  })

  it('rejects arbitrary text', () => {
    expect(qrIdFromScan('just some text')).toBeNull()
  })

  it('rejects a javascript: payload', () => {
    expect(qrIdFromScan('javascript:alert(1)')).toBeNull()
  })
})
```

- [ ] **Step 2: Run and watch it fail**

- [ ] **Step 3: Implement**

Parse with `new URL(...)` inside a `try`, check `pathname` against `/^\/box\/([a-z0-9]{8})$/`, and return the captured id or `null`. Never regex the raw string — that is how the `?to=/box/...` case slips through.

Navigate with the extracted **id only**, never with the scanned URL. Even a well-formed scan is untrusted input; taking only the 8-character id means the worst case is landing on a box that does not exist, which already has a good state.

- [ ] **Step 4: Run the test** — PASS, 7 tests.

- [ ] **Step 5: Build the component**

Camera behaviour cannot be meaningfully driven in Playwright without a fake device stream. Do not fake a passing test. Cover what is real: the parser by unit test (done), and the permission-denied and no-camera states by rendering the component with the reader stubbed. State plainly in your report what is *not* covered — a human must scan a printed code once before this ships.

- [ ] **Step 6: Commit**

```bash
git add app/components/QrScanner.vue app/utils/qrPayload.ts tests/nuxt/qrPayload.spec.ts
git commit -m "Add in-app QR scanner with strict payload validation"
```

---

### Task 5: Slice exit check

**Files:** none.

- [ ] **Step 1: Full loop from a cold start**

```bash
docker compose down -v && docker compose up -d
sleep 5
python3 scripts/pb-seed.py http://localhost:8090
pnpm lint && pnpm test && pnpm test:e2e
```

- [ ] **Step 2: Confirm you stayed inside your ownership**

```bash
git diff --name-only main...HEAD
```

Only your two pages, `app/components/Qr*`, `app/utils/qrPayload.ts`, and your tests. **You must not have edited `app/pages/index.vue` or the box detail page** — slice A owns the links into your routes.

- [ ] **Step 3: Report honestly on what is untested**

Say explicitly that live camera scanning is not covered by automated tests and needs one manual pass with a real printed label. That sentence is the deliverable — a reviewer reading "all green" without it would reasonably assume the scanner was proven.

## Self-Review

**Spec coverage.** PRD §7.2 print page → Task 2; batch print sheet → Task 3; §7.3 QR encodes `{app_origin}/box/{qr_id}` → Task 1; native camera opens it → inherent, no code needed; in-app scanner → Task 4; box-not-found state → Task 2; §11 short typeable `qr_id` printed as text → Task 2.

**Deliberately out of scope.** `qr_id` **generation** lives in slice A (`app/utils/qrId.ts`), because `/box/new` must generate one to create a box at all — see the overview's ownership rulings. You consume `qr_id` values that already exist; you never mint one. Links into your routes are also A's.

**Known risk.** Task 4 is the least testable work in the whole wave. The parser is fully covered and is where the security decision lives, but the camera path is not, and no amount of mocking changes that. Report it rather than dressing it up.
