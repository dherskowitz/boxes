# Slice C — QR

Branch `slice-c`. Printable QR labels, a batch print sheet, and an in-app scanner.
`qr_id` values are consumed, never minted (slice A owns generation).

## Commits

| Commit | What |
|---|---|
| `7015554` | Fix broken `maplibre-gl` build-approval value in `pnpm-workspace.yaml` |
| `dfcc37c` | QR payload builder (`boxQrUrl`) and `QrCode.vue` |
| `427b486` | Printable single-label page `/box/[qr_id]/print` |
| `909ac0e` | Batch print sheet `/print-sheet` |
| `52d863a` | In-app scanner `QrScanner.vue` with strict payload validation |

## The loop — all green

Run in the foreground under machine load ~22/8 cores, with the two documented
load workarounds passed as CLI flags (no shared config file was edited):

| Command | Result |
|---|---|
| `pnpm lint` | clean, no output |
| `pnpm typecheck` | clean, no output |
| `pnpm test --hookTimeout=180000` | 8 files, **59 passed**, 25.6s |
| `E2E_PORT=3004 pnpm test:e2e --workers=1` | **18 passed**, 3.2m |

`--hookTimeout=180000` is needed because the default 30s `setupNuxt` hook times out
under load and fails every Nuxt-environment suite with no code fault.
`--workers=1` because pre-existing tests time out at Playwright's default 4 workers.
`E2E_PORT=3004` avoids colliding with other agents' stacks on 3000.

## How the encoded URL was verified

A label encoding the wrong origin is only discovered months later, off a physical
box, so this is asserted rather than eyeballed.

`boxQrUrl(qrId, origin)` takes the origin as a **parameter** — it never reads
`window` itself, so callers must be explicit about the origin they commit to paper,
and it is unit-testable without a DOM. Both print routes pass
`window.location.origin`, never `runtimeConfig.public.pocketbaseUrl` (a different
host in production).

Verified at two levels:

1. **Unit** (`tests/nuxt/qrPayload.spec.ts`) — exact-string assertions for a
   production origin, a trailing-slash origin, and a dev origin with a port; plus
   two throwing cases (empty `qr_id`, empty origin) so a label can never encode
   `/box/` or a relative path.
2. **E2E** (`tests/e2e/qr.spec.ts`, "encodes the app origin the page is actually
   served from") — `QrCode.vue` exposes its input as `data-qr-value`, and the test
   asserts it equals `${new URL(page.url()).origin}/box/seedbox1`, i.e. the origin
   Playwright is genuinely serving from. **Decoding the rendered image was not
   attempted** — the assertion is on the attribute feeding `qrcode.toDataURL`, not
   on the pixels. The gap between that string and the encoded bitmap is the
   `qrcode` library's own correctness.

## The security boundary — `qrIdFromScan`

A scanned QR code is untrusted input a stranger can print and leave lying around.
Reviewed line by line and confirmed correct as written:

- Parses with `new URL(raw)` inside a `try`; a parse failure returns `null`.
- Tests **only `url.pathname`** against `/^\/box\/([a-z0-9]{8})$/`. The raw string is
  never regexed — that is exactly how
  `https://evil.example.com/redirect?to=/box/seedbox1` would slip through, and it is
  a covered test case (rejected: pathname is `/redirect`).
- `javascript:alert(1)` parses as a valid URL but its pathname is `alert(1)`, which
  fails the shape test → `null`.
- The **origin is deliberately not checked**: a label printed against another
  deployment still carries a real id worth honouring.
- `QrScanner.vue` navigates with `navigateTo(\`/box/${qrId}\`)` — the extracted
  8-character id only, **never** the scanned URL. Worst case for a well-formed but
  hostile scan is landing on a box that does not exist, which already has a state.

7 parser cases pass, including malformed id, arbitrary text, and `javascript:`.

## What is NOT verified

**Live camera scanning is not covered by any automated test and needs one manual
pass with a real printed label before this ships.** Playwright cannot drive a camera
without a fake device stream, and no amount of mocking changes that. Faking a green
test here was declined deliberately.

Covered instead: the parser by unit test (where the security decision actually
lives), and the camera unhappy paths with `vue-qrcode-reader` stubbed —
permission-denied (`NotAllowedError`), no-camera (`NotFoundError` /
`OverconstrainedError`), and any other camera error surfaced through `pbError`
rather than a blank frame.

Also unverified: actual print output on paper. `@media print` rules are asserted to
exist but no test renders a physical page; `break-inside: avoid` on each label is
untested against a real page break.

## Notes for the merge

- **No navigation links were added.** `app/pages/index.vue` is still wave 0's stub in
  this worktree and slice A's scanner entry point is not present, so `QrScanner.vue`
  is built as a self-contained component with no consumer yet — wave 3 or the merge
  step wires it into the index.
- `app/pages/box/[qr_id]/index.vue` also does not exist here (slice A owns it), so a
  successful scan currently navigates to an unrouted path in *this* worktree only.
- `app/utils/qrcode.d.ts` was added because the `qrcode` package ships no type
  declarations and adding `@types/qrcode` would mean editing `package.json`, which
  this slice does not own. It is a minimal ambient shim for `toDataURL` — the one
  function `QrCode.vue` calls — not a general-purpose typing.
- `pnpm-workspace.yaml` carries the `maplibre-gl: false` build-approval fix, ruled
  canonical by the coordinator.
- `git diff --name-only main...HEAD` touches only this slice's files: the two print
  routes, `app/components/Qr*`, `app/utils/qrPayload.ts` + its `.d.ts`, the three test
  files, and `pnpm-workspace.yaml`.
