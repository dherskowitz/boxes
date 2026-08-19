# Wave 0 decision log

Every decision made on the user's behalf during wave 0 execution, preserved
from the SDD ledger before its scratch workspace was deleted. Each entry
records what was decided, why, and what it costs if wrong.

## Ruling: no worktree for wave 0
Wave 0 is serial by design — nothing runs concurrently, so a worktree buys no
isolation and costs a full `pnpm install` plus a `.nuxt` rebuild. Running on
`plan/v1-implementation`, which is not main and was clean at start. Worktrees
are used for waves 1-3, where parallelism actually needs them (that is what the
user asked them for).
Cost if wrong: main is never touched either way; at worst wave 0 commits sit on
a branch that needs rebasing. Cheap to undo.

## Ruling: DEFECT 1 — auto-generated migrations
PocketBase writes `*_created_*.js` / `*_deleted_*.js` into `pb_migrations/` on
every admin-API schema change (confirmed: my planning probe left two such files
behind, now deleted). Left in place they would double-apply the views on a fresh
instance and fight the generated baseline.
Decision: Task 1 gains an explicit step to delete auto-generated migrations
after running `pb-views.py` and before snapshotting, and Task 1's verification
asserts `pb_migrations/` contains exactly the one baseline file.
Cost if wrong: a fresh `docker compose up` fails to migrate — caught loudly by
Task 1 step 6 and Task 11, not silently.

## Ruling: DEFECT 2 — authStore listener leak
`useAuth()` as drafted calls `$pb.authStore.onChange(...)` on every invocation
and never unsubscribes, so each component using it adds a permanent listener.
Decision: move the reactive auth record into the existing
`app/plugins/pocketbase.ts` plugin, which runs once, and have `useAuth` read it.
Cost if wrong: none material — the plugin is the conventional Nuxt place for
app-lifetime singletons.

## Ruling: DEFECT 3 — directory query fires when logged out
`useAuth()` calls `useAppUsers()` unconditionally, so the login page requests
`storage_app_users` with no session and logs a failed request on every visit.
Decision: gate `useAppUsers` on an authenticated session via `enabled`.
Cost if wrong: none — an unauthenticated caller receives an empty set anyway
(verified during planning), so this is noise reduction, not a behaviour change.

## Ruling: DEFECT 4 — existing e2e smoke test breaks under the auth guard
`tests/e2e/smoke.spec.ts` asserts `getByText('Storage Boxes')` on `/`, which now
redirects to `/login`. It would either fail or pass for the wrong reason, since
the login page also renders that string.
Decision: Task 10 deletes `tests/e2e/smoke.spec.ts`. Its coverage — the app
shell loads — is strictly subsumed by the new `auth.spec.ts`, which asserts the
shell renders for a signed-in member. Keeping a second test of the same thing
that passes for the wrong reason is worse than not having it.
Cost if wrong: one trivially recreated smoke test. The unit smoke test
(`tests/unit/smoke.spec.ts`) is untouched and still guards the Nuxt harness.

## Ruling: F1 (Important) duplicate rows in storage_app_users — FIX
Real. `app_memberships` carries no unique index on (user, app) and `app` is a
maxSelect-999 multi-relation, so two enabled membership rows referencing the
storage app yield two view rows sharing `u.id` — which is the view's primary
key. Membership provisioning happens outside this app (PRD §4), so we do not
control whether that occurs. Fixing with GROUP BY also forces a decision on
which role wins when a user holds several; arbitrary selection would corrupt the
owner/admin gate on tag deletion, so highest privilege wins, deterministically.
Cost if wrong: slightly more SQL than strictly needed if duplicates never occur.
Cost of NOT fixing: a duplicate-id view record, whose read behaviour PocketBase
does not define, surfacing in the sharing picker in wave 2.

## Ruling: F2 (Important) aggregate columns typed json — FIX
Real. PocketBase cannot infer a type from COUNT(*)/strftime() and falls back to
`json`, and slice J sorts and filters these columns ("top 10 by item_count").
`json`-typed filter and sort semantics differ from numeric ones. CAST is the
standard remedy, but whether it changes PocketBase's inference must be VERIFIED
in the regenerated migration, not assumed — the fix is only done when the field
reads `"type": "number"`.
Cost if wrong: if CAST does not change inference, we learn it now instead of in
wave 1, and record the constraint for slice J.

## Ruling: F3 (Minor) growth view id violates the id pattern — FIX
`2026-08` contains a dash; the cloned id field's pattern is `^[a-z0-9]+$`. The
reviewer is right that it is unenforced on read, but the fix is one REPLACE()
and removes a latent trap. Keeping a separate `month` column for display.

## Ruling: F4 (Minor) redundant options.query in pb-views.py — FIX
Dead vestigial payload field. One line, same file already being edited.

## Ruling: role select->text regression — ACCEPT, do not fix
Real and correctly spotted, but it is the unavoidable cost of F1: once `role` is
computed by a CASE expression instead of passed through from a select-typed
source column, PocketBase cannot infer an enum. There is no fix that keeps both
dedup and enum typing. Correctness of the row set outranks schema documentation.
The reviewer's stated downside — "a typegen-derived TS type degrades to string" —
does not apply here: this project deliberately rejected pocketbase-typegen (spec
§3.1) and hand-writes `MemberRole` as a four-value union in Task 3, so the
TypeScript contract is unchanged. The SQL guarantees only those four strings.
Cost if wrong: the schema self-documents one field less well. No runtime or type
consequence.

## Ruling: F2 residual (month) — FIX in round 2
One-line change, remedy already identified by the re-reviewer: move the
CAST(... AS TEXT) from the inner derived table to wrap the outer `m.month`,
matching the pattern that demonstrably worked for all six count columns.
Worth a round because a json-typed field types as `unknown`, and CLAUDE.md bans
`any` and requires narrowing — so every consumption site in slice J pays for it.
Task 1: fix round 2/5 — commit 1fe60bb. Controller-verified: month now "text".
Task 1: scoped re-review r2 dispatched (haiku), range 96a7621..1fe60bb.
Task 1: re-review r2 clean — F2 residual ADDRESSED, no new breakage.
Task 1: complete (commits 7a627e3..1fe60bb, review clean after 2 fix rounds)

## Ruling: filter injection — FIX with pb.filter(), not a custom escaper
The reviewer is right and the concrete case is live: qr_id is read straight from
the URL, so /box/x" || id != " yields `qr_id = "x" || id != ""` — always true —
and the QR deep link opens an arbitrary box. Same shape in items/comments/
permissions.
Scope correction: this is NOT privilege escalation. Every enabled member can
already list every box, item and comment (PRD §4), so nothing leaks that the
list rules did not already permit. It is a correctness bug with an injection
primitive attached — which becomes a security bug the moment any rule tightens.
Remedy: the PocketBase SDK already ships `pb.filter(raw, params)` with `{:name}`
placeholders (verified present in pocketbase 0.27.3). Use it. Writing our own
escaping helper would be reinventing the library, and hand-rolled quote
stripping is exactly what produced this defect.
`boxFilter` returns { raw, params } so it stays unit-testable without a pb
instance; the caller passes both to $pb.filter.
This is plan-mandated — my brief's code carried the flaw. Fixing at the shared
layer once, per CLAUDE.md's root-cause rule, rather than at six call sites.
Cost if wrong: a slightly different query-module signature than the plan text,
which the wave 1 slice plans have not been written against yet. Cheap now,
expensive after ten slices consume it.

## Ruling: local-only guard is a substring check — FIX
`if "localhost" not in root and "127.0.0.1" not in root` matches the substring
anywhere, so http://notlocalhost.example.com and
https://attacker.example.com/?x=127.0.0.1 both pass. This guards a script that
authenticates as superuser and then unconditionally deletes records. Low
practical risk (the target must also accept the dev superuser password), but a
weak guard on a destructive operation is exactly the kind of thing that must not
be simplified away. Fix: urlparse(root).hostname in ("localhost","127.0.0.1").
One import, one line. Plan-mandated (my brief's code).

## Ruling: app_memberships total wipe — UPGRADE Minor -> Important, FIX
The reviewer rated this Minor because docker-compose provisions a dedicated
single-app instance locally. I am overriding that on two grounds it did not
weigh: CLAUDE.md states plainly "Never modify the shared apps / app_memberships
collections", and PRD §4 says this app runs on an existing multi-app PocketBase
instance — a shared instance is the documented deployment model, not a fringe
case. A developer pointing the seed at a shared local instance would silently
delete every other app's memberships.
Fix: scope the membership wipe to the seeded @local.test accounts only.
Cost if wrong: a few more lines of wipe logic. Cost of not fixing: another
app's access control destroyed with no warning.

## Ruling: Task 10 plan defect — projects snippet would drop the mobile device
The plan's step-3 snippet adds `{ name: 'chromium', use: devices['Desktop Chrome'] }`.
The existing playwright.config.ts deliberately sets `...devices['Pixel 7']` with a
comment, and CLAUDE.md/PRD §8 make mobile-first the primary target. Adopting the
snippet verbatim would silently move the whole e2e suite to a desktop viewport —
exactly the regression the "check the narrow viewport" rule exists to prevent.
Decision: keep Pixel 7 as the device for the main project; the setup project
needs no device. Carried into the Task 10 dispatch.
Cost if wrong: none — reverting to desktop is a one-line change, and nothing
else depends on the viewport.
Task 10: implementer reported BLOCKED with a correct root cause. Refused to
  work around it. Good call.

## Ruling: app/queries/ is not auto-imported — LOAD-BEARING plan defect, FIX NOW
Verified independently: `grep useAppUsers .nuxt/imports.d.ts` returns nothing,
and app/composables/useAuth.ts calls useAppUsers() with no import. Nuxt scans
composables/ and utils/ by default; `queries/` is not a scanned directory. So
useAuth() throws ReferenceError in a real browser — login and the app shell are
both broken on the committed branch (since 433e81d).
This slipped past the Task 6, 7 and 8 reviews because lint and the unit suite
never execute the composable; only the pure deriveMembership function is tested.
e2e was the first thing to run the real code path, which is precisely its job.
It is load-bearing beyond Task 10: all six query modules are consumed the same
way, so every one of the ten wave-1/2/3 slices would hit this.
Decision: add `imports: { dirs: ['queries'] }` to nuxt.config.ts. This matches
CLAUDE.md's standing "auto-imports are on, don't write imports" convention and
fixes it once for every future slice, rather than forcing explicit imports into
every consumer. Also add a CLAUDE.md line, per that file's own failure-log rule.
Cost if wrong: if dirs resolution misbehaves, the fallback is explicit imports
in consumers — more churn, same outcome. Proven either way by the e2e run.
Task 10: auto-import fix committed as e7a07cc; useAppUsers now resolves in
  .nuxt/imports.d.ts (controller-verified). Task 10 e2e work written but
  uncommitted — agent stalled waiting on a nonexistent notification.
Task 10: agent resumed with a tight four-step finish instruction.
Task 10: implementer BLOCKED again — pnpm test fails 3/3 in setupNuxt() at the
  10s hook timeout. It correctly refused to commit on a red loop.

## Ruling: raise vitest hookTimeout — real config gap, not a workaround
Verified myself: load is 20+ on 8 cores, driven by php8.5 and postgres processes
belonging to the user's other work — nothing from this session (no stray
vitest/playwright/nuxt processes, port 3000 free). All 4 test files fail in the
setup hook with 17 tests SKIPPED, not failed: the hook never completes.
The underlying gap is real and pre-existing. vitest.config.ts sets
testTimeout: 30_000 with the comment "mounting the full Nuxt app (PWA +
PocketBase plugins) is slow in happy-dom" — but setupNuxt() runs under
hookTimeout, which was left at Vitest's 10s default. The author raised the wrong
timeout. A suite that passes only on an idle machine is not a suite you can gate
on, and CI runners are routinely loaded.
Decision: set hookTimeout: 30_000 to match testTimeout, same rationale, same
comment. This is not masking a defect — the tests pass given time to boot.
Cost if wrong: a genuinely hung setup hook now takes 30s to report instead of
10s. Acceptable.

## Ruling: preserve the interface surface outside the SDD workspace
The workspace is deleted when this plan finishes, but the wave 1 slice plans are
written against this document. Copied to docs/superpowers/wave-0-interface-
surface.md and committed so it outlives the workspace.
Cost if wrong: one extra doc file in the repo.

## Ruling: slice A owns app/utils/qrId.ts, not slice C
The spec put qr_id generation in slice C (QR). But /box/new must generate a
qr_id to create a box at all, and that page is slice A's. C only needs to
*render* a QR image from an existing box's qr_id. Generation belongs with
creation. Moving it to A removes a hard A->C dependency and keeps both slices
independent.
Cost if wrong: C would have to import a util from A's file set. It already
imports wave 0 query modules, so this is no new coupling.

## Ruling: slice A owns app/composables/useCanEdit.ts, not slice F
The spec assigned useCanEdit to wave 2 slice F (sharing). But slice A's box
detail page must show or hide edit controls immediately, and it cannot wait a
wave. A owns the composable; F owns only /box/:qr_id/share and the permission
mutations.
Cost if wrong: F extends a composable it did not author — normal, and its
review will catch a bad extension.

## Ruling: slice A adds every navigation link to sibling slices' routes
Box detail and the box index belong to A. Links to /box/:qr_id/print (C),
/box/:qr_id/share (F) and /print-sheet (C) all originate from those two pages.
If each slice added its own link, three slices would edit A's two files.
Instead A adds all of them up front, pointing at the stubs wave 0 created.
Cost if wrong: A ships links to two pages that are still stubs for part of the
wave. They resolve and render placeholder text — no broken route.

## Ruling: each slice owns mutations only in its own collection's query module
Wave 0 shipped reads only. A adds mutations to boxes.ts and items.ts, B to
tags.ts, F to permissions.ts, E to comments.ts. No two slices ever edit the
same query module. reports.ts is J's alone.

## Ruling: run ONE fix wave before wave 1 dispatches. Contract defects only.
Rationale: every finding below is an omission in the SHARED contract, which is
the failure mode that multiplies by ten. Fixing after slices start means ten
worktrees built on it.

## Ruling: F3 changes slice A's plan — A no longer owns useCanEdit
I had ruled A owns app/composables/useCanEdit.ts. The reviewer is right that a
predicate four slices need belongs in the shared contract, not in one slice.
Wave 0's fix wave ships both the pure predicate and the composable; slice A
consumes them and Task 3 of its plan is removed.
Cost if wrong: one more file in wave 0's surface. Far cheaper than four
divergent implementations of an asymmetric permission matrix.

## Ruling: move tests/unit -> tests/nuxt so tests are typechecked. Do it NOW.
Verified: a planted type error inside tests/unit/pbError.spec.ts passes
typecheck. Nuxt's generated tsconfig includes ../tests/nuxt/** but not
../tests/unit/**, so no test file is typechecked at all.
This matters more than it looks. Wave 1 is ten slices, and tests will be a large
share of all new code. CLAUDE.md bans `any` and `as` outright; leaving the
majority of new code outside the only gate that enforces that is a hole.
Chose the rename over a tsconfig override because it uses Nuxt's own convention
instead of fighting it, and because every unit suite here already runs with
environment: 'nuxt'.
Timing is the whole argument: doing this before wave 1 costs one rename plus a
vitest include line plus a path update in five plan documents. Doing it after
ten slices have written their tests costs ten conflicting renames.
Cost if wrong: a directory name. Trivially reversible.


## Deferred minors (not fixed, triaged as safe to defer)

  Task 2+3+5: minor (deferred): StorageBoxPermission.role typed 'editor' but the
    migration marks the select not-required, so an unset value is "" at runtime.
    Real type is '' | 'editor'. Equality checks (role === 'editor') stay correct
    either way; only `satisfies`-style narrowing would be wrong. Relevant to
    slice F (sharing page). Flag to the final whole-branch review.
  Note: the reviewer ran `pnpm approve-builds` and transiently rewrote
    pnpm-workspace.yaml, then reverted it. Controller verified the tree afterwards.
  --
  Tasks 4+7: minor (deferred): useTags() uses getFullList rather than perPage
    pagination. Justified in the brief (small curated picklist, all of it needed
    for autocomplete) and not the client-side-join anti-pattern the rule targets.
    Flag to the final whole-branch review.
  Tasks 4+7: fix round 1/5 — commit 7449b82. Controller-verified: all 6 filter
    sites now use $pb.filter parameter binding; zero backtick-interpolated filter
    strings remain; quote-strip hack gone. 13 tests passing.
  --
  Tasks 4+7: minor (deferred): no direct unit test for useBoxByQrId's filter
    construction — the historically exploited call site. Needs a Nuxt/$pb test
    harness that does not exist yet. The raw-placeholders-only test is the proxy.
    Flag to the final whole-branch review.
  
  Task 6: dispatched (sonnet), BASE 7449b82.
  Task 6: implementer DONE — 433e81d. 17/17 tests, lint clean, RED confirmed.
  --
  Task 8: minor (deferred): a hand-crafted ?redirect=https://evil.com cannot
    exfiltrate — navigateTo refuses it — but login has already succeeded by then,
    so the thrown error renders in the login alert and leaves the user
    authenticated yet stranded on /login, which has no nav. Confusing dead end,
    not a vulnerability. Two-line fix (accept only paths starting with a single
    "/"). Flag to the final whole-branch review.
  
  --
  Task 9: minor (deferred): scheme-less "localhost:8090" is now rejected because
    urlparse treats it as a scheme. Fail-closed, and every documented usage
    includes http://. Not worth a round.
  Task 10: dispatched (sonnet), BASE 529d5bf.
  
  ## Ruling: Task 10 plan defect — projects snippet would drop the mobile device
  The plan's step-3 snippet adds `{ name: 'chromium', use: devices['Desktop Chrome'] }`.
  --
  Task 10: minor (deferred): the new CLAUDE.md line is phrased declaratively where
    the file's convention is imperative, and it says only composables/ and utils/
    are scanned by default when Nuxt 4 also scans shared/utils and shared/types
    (immaterial — no shared/ dir here). Fold into the next CLAUDE.md edit.
  Task 10: NOTE for wave 1 slice A: there is no app/pages/box/[qr_id]/index.vue
    yet (by design — slice A owns it), so the deep-link e2e test proves the URL is
    preserved through login but not that a working box screen renders. Slice A
