# Wave 1 decision log

Decisions made on the user's behalf during wave 1 (five parallel slices),
preserved from the SDD ledger before its scratch workspace was deleted.
Each entry records what was decided, why, and what it costs if wrong.

## Ruling: maplibre-gl build approval — canonical value is `false`, resolve at merge
FOUR slices independently hit the same blocker: maplibre-gl (a nuxt-charts
transitive dep) halts `pnpm install` on a build-approval prompt. Each patched
pnpm-workspace.yaml in its own branch, and they DIVERGED:
  slice-a  -> maplibre-gl: true
  slice-b  -> maplibre-gl: false
  slice-c  -> maplibre-gl: false
  slice-j  -> maplibre-gl: false
  slice-d  -> unchanged
This is a semantic conflict (run the build script vs skip it), not textual.
Decision: `false` is canonical. Rationale — maplibre-gl is a map renderer we
never use; nuxt-charts is consumed only by slice J, which set `false` and built
its charts against it. Skipping an unused native build is both correct and
faster. Resolve slice A's `true` down to `false` at merge and re-verify A's
install and loop afterwards.
Not adding it to main pre-emptively: it produces exactly one conflict with
slice A either way, so an extra main commit buys nothing.
Cost if wrong: if Unovis genuinely needs the built artifact, charts break in
slice J — which is precisely where it would be caught, and the fix is one line.

## Ruling: stop, do not resume, an agent that stalls on a phantom notification
Slices B, C and D each finished their implementation work and then hung waiting
for a background-task notification that never arrives. Resuming B once produced
no progress and a second stall, and it kept waking afterwards — at one point two
agents were live in the same worktree, which is a real corruption hazard.
Policy from here: TaskStop on first repeat, then dispatch a fresh agent scoped
to the small remainder, with an explicit "run everything in the foreground"
instruction. Verified each time that the worktree and fixture were undamaged.
Likely cause: load 25-32 on 8 cores makes commands slow enough that agents
background them and then wait forever. Concurrency is the aggravating factor.

## Ruling: navigateFallback deployment defect — REAL, defer to a deploy task
D found that `nuxt build` with ssr:false emits no index.html, so
`navigateFallback: '/'` binds to nothing and offline navigation dies. Deploy
must use `pnpm generate` (or nitro.prerender.routes: ['/']).
Not fixing inside slice D: it is outside D's ownership block, it is a build/
deploy concern rather than a caching one, and PRD §5 names hosting as a separate
decision. Recording it as a release blocker for the offline guarantee (PRD §7.8).
Cost if wrong: v1 ships with offline reads broken in production while passing
every local test — which is why this must not be lost.

## Ruling: offline reads cannot be verified under `pnpm dev`
D reports the service worker never claims the page under the dev server, so the
committed offline e2e needs a real build, not the dev server playwright boots.
Deferring the harness change: it needs its own playwright project or script, and
that is a shared-config change with branches outstanding. The tests stay in
place, unrun, rather than being deleted — they become runnable at merge.

## Ruling: assertOnline() listener leak — FIX before merge
Important, and it scales. `assertOnline()` calls vueuse's useOnline(), which
registers two window listeners via watch(..., {immediate:true}). Vue only
auto-disposes those inside an active component effect scope, i.e. during
setup(). But assertOnline() is documented to be the first statement of a
mutation handler — which runs OUTSIDE setup. So every call leaks two listeners
that are never freed until the tab closes.
Invisible to the suite because useOnline.spec.ts mocks @vueuse/core entirely,
so the real listener machinery is never exercised. Reviewer confirmed against
the installed @vueuse/core 14.4.0 source.
This is the guard every mutation in slices A, B, E and F will call, so the leak
grows with ordinary usage across the whole app.
Fix: use navigator.onLine directly for the one-shot check. That is NOT the
hand-rolled-listener antipattern the code comment warns about — that warning
applies to the *reactive* signal used by OfflineBanner/InstallPrompt, which is
correctly created once inside a long-lived component's setup(). A one-shot
assertion needs an instantaneous read, not a subscription.
Cost if wrong: none material; navigator.onLine is exactly what vueuse reads.

## Ruling: slice C's two minors — DEFER, do not fix
(1) Unscoped <style> blocks on the print routes. The reviewer suggests scoping
them. That suggestion is subtly WRONG: the rules must hide the LAYOUT's header
when printing, and a `scoped` style cannot reach outside the component. They are
unscoped deliberately and necessarily. There is no live collision today
(no other component uses .label/.no-print/.sheet-grid). The right long-term fix
is probably definePageMeta({ layout: false }) on print routes so there is no
chrome to hide at all — a design decision, not a review fix.
(2) QrCode's watchEffect stale guard ignores `size`; both call sites pass a
static size, so it cannot trigger.
Recording both for whoever next adds print styling. Cost if wrong: a print job
started from an unrelated page could pick up these rules — visible and trivially
fixable, not silent.

## Ruling: B/1 rename-restore is not exception-safe — FIX
The rename test renames kitchen -> kitchenware, asserts three things, then
renames back, with no try/finally. If any assertion in between throws, the
SHARED fixture stays renamed permanently for every later run and every other
developer. The implementer's evidence (four clean runs) is empirical, not
structural — it shows it did not happen, not that it cannot.

## Ruling: B/2 rename accepts an empty name — FIX
storage_tags.name is required:false in the migration and the unique index
permits exactly one empty row, so PocketBase returns 200 rather than 400.
normalizeTagName('   ') returns '', TagPicker.onCreate guards against that
(`if (!name) return`) but tags.vue's rename path does not. A member who clears
the field and saves silently blanks a shared tag everywhere it is applied, with
no error shown.

## Ruling: B/3 misleading comment — FIX (one line, but it misleads)
The comment on useRenameTag/useDeleteTag claims omitting created_by avoids the
update rule's `:isset = false` check. Read against the migration that is wrong
for storage_tags specifically: its updateRule is just "any enabled member", with
no created_by or :isset guard at all. The pattern is real for boxes and items,
not tags. Omitting the field is still correct; the stated reason is not, and a
future maintainer would over-trust it.

## Ruling: B/4 "1 boxes and 1 items" pluralisation — DEFER, cosmetic

## Ruling: A/1 maplibre-gl true -> false — FIX, my ruling now has evidence
Reviewer cat'd the published postinstall: it is an EMPTY FILE. So `true` runs a
no-op and `false` skips a no-op; pnpm's ERR_PNPM_IGNORED_BUILDS gate is satisfied
by any explicit entry, not by `true` specifically. Four sibling worktrees run
`false` green on the same pnpm and lockfile. A merges first, so its value becomes
the base the other four rebase onto — fix here, not four times downstream.

## Ruling: A/2 partial bulk-move leaves the cache stale — FIX (one word)
useMoveItems invalidates only in onSuccess. On a partial failure the mutation
throws, onSuccess never fires, and the list still shows all items in the source
box while the alert says "Moved 2 of 3". The user retries and re-moves items that
already moved. onSettled instead of onSuccess.

## Ruling: A/3 cross-file e2e races can permanently corrupt the shared seed — FIX
describe.configure({mode:'serial'}) serialises within a file only; at --workers=2
files run in parallel. itemDetail adds an item to seedbox4 while boxDetail
asserts seedbox4 is empty, and boxDetail's restore-by-filter can grab the WRONG
item and strand the real one. That corruption survives the run and breaks the
empty-box fixture until a re-seed. These tests become the baseline four slices
rebase onto, so it must not ship.

## Ruling: A/4 "Show archived" swaps the view — FIX, PRD wins
PRD §7.2 says archived are excluded "unless explicitly INCLUDED". The toggle
swaps status, so a user with 10 active and 2 archived ticks it expecting 12 and
sees 2. Deciding for two sections (Active / Archived) rendered from two
useBoxList calls rather than relabelling the toggle to "Archived only":
relabelling is honest but ships less than the spec asks, and two sections avoid
the combined-pagination mess a merged list would create. Both queries already
paginate. Stays inside A's ownership; needs no keys.ts change.
Cost if wrong: a slightly longer index page. Trivial to collapse later.

## Ruling: A/5 no write path except create is tested against the API — FIX
The :isset = false trap is covered ONLY by pure unit tests on the payload
builders. No test issues a real PATCH; edit/archive/delete are asserted purely
as button visibility, and one test even archives through the raw SDK rather than
the mutation. Wave 0 paid for this rule with real 403s. The code is right — the
proof is missing. One e2e that opens Edit, saves a title change and asserts the
new title renders is the highest-value test in the slice.

## Ruling: A/6 one-tap destructive delete, and box delete is broken when non-empty — FIX
Reviewer probed the API: deleting a box that still contains items returns 400,
because storage_items.box is required with cascadeDelete false. pbError surfaces
it honestly but as DB jargon, on a control that looks like it should work. And
neither delete has a confirmation — on a phone, Delete sits beside Edit with no
undo. Fix inside A's ownership: confirm on both deletes, and disable box delete
while items remain, with a plain explanation.

## Ruling: alt text on gallery images — FIX (accessibility is never a shortcut)
Card thumbnails have alt; the galleries do not. CLAUDE.md lists accessibility
basics among the things never to simplify away.

## Ruling: merge order corrected to B -> C -> J -> A -> D
Originally A first, on the theory that everything links into it. Revisiting with
the actual diffs: the five slices are almost entirely file-disjoint (the
ownership map did its job), so conflict risk barely depends on order. What DOES
constrain order is keeping main green at every step, and slice D's e2e is
legitimately red until slice A's /box/:qr_id and /box/new exist. So D must land
after A, and the rest can go first.
Merging B, C and J now, while A's fixes are still in flight, rather than idling.
Cost if wrong: A becomes a real merge instead of a fast-forward. The files are
disjoint, so that is cheap.

## Ruling: rename B's to useTagUsageMap and have it CONSUME J's
J keeps useTagUsage() as the raw view query — it matches keys.reports.tagUsage()
and belongs with the other report queries. B's becomes useTagUsageMap(), and
rather than duplicating the query it calls J's and indexes the result. Both were
already hitting the same view with the same query key, so consolidating removes
a duplicate query as well as the collision.
Cost if wrong: a rename in one call site on /tags. Trivial.

## Ruling: accept A's CLAUDE.md edit despite the file being unowned
Three lines, all root causes discovered the hard way, and CLAUDE.md's own closing
rule instructs exactly this ("when you discover something about this repo that
wasn't written down, add one line in the imperative"). Refusing it would discard
the most transferable knowledge the wave produced.

## Ruling: derive the expected totals from the API, do not hardcode seed counts
Fix J's reports test to read the current counts from PocketBase and assert the
UI matches THOSE. That is race-proof, and it tests the thing that actually
matters — that the screen reflects the database — instead of testing the seed
script. Rejected the alternatives: workers=1 for the whole suite papers over it
and slows every slice, and an isolated fixture is impossible for a screen whose
entire purpose is a global aggregate.
Cost if wrong: the assertion no longer pins exact seeded numbers, so a bug that
corrupted BOTH the API counts and the UI identically would pass. Acceptable —
the view collections are the API counts, so that is nearly the same statement.

## Ruling: block service workers in Playwright by default, allow them only offline
playwright.config.ts gets `use: { serviceWorkers: 'block' }`, and
tests/e2e/offline.spec.ts overrides with test.use({ serviceWorkers: 'allow' }),
since those are the only tests that need one.
Rejected disabling devOptions: that would make the offline tests untestable in
dev at all, and the SW is the feature under test there.
Rejected making every mutating test SW-aware: nine tests paying for one.
Now that all five slices are merged, playwright.config.ts is no longer contended,
so changing it is finally safe.
Cost if wrong: if blocking the SW also hides a real caching bug from the other
suites, we lose that coverage — acceptable, because offline.spec.ts is the test
that is actually about caching.

## Ruling: guard every write mutation, and expect TanStack to be in the way
Likely crux: TanStack Query's default mutation networkMode is 'online', which
PAUSES a mutation while offline — so mutationFn never runs and an assertOnline()
placed inside it would never execute. That matches the observed "zero requests,
never settles". The guard therefore probably needs networkMode: 'always' on
mutations so the function runs and can throw a clear error immediately.
Stating this as a hypothesis for the implementer to verify, not a conclusion.

## Deferred, with reasons

  committed offline e2e needs a real build, not the dev server playwright boots.
  Deferring the harness change: it needs its own playwright project or script, and
  that is a shared-config change with branches outstanding. The tests stay in
  place, unrun, rather than being deleted — they become runnable at merge.
  
  ## OPEN QUESTION FOR THE HUMAN: PWA icons
  public/ holds only favicon.ico and the built manifest has no icons key. PRD §7.9
  requires 192px and 512px minimum, and Android will not fire beforeinstallprompt
  --
  
  ## Ruling: slice C's two minors — DEFER, do not fix
  (1) Unscoped <style> blocks on the print routes. The reviewer suggests scoping
  them. That suggestion is subtly WRONG: the rules must hide the LAYOUT's header
  when printing, and a `scoped` style cannot reach outside the component. They are
  unscoped deliberately and necessarily. There is no live collision today
  (no other component uses .label/.no-print/.sheet-grid). The right long-term fix
  is probably definePageMeta({ layout: false }) on print routes so there is no
  --
  
  ## Ruling: B/4 "1 boxes and 1 items" pluralisation — DEFER, cosmetic
  
  ## slice-a review: MERGE AFTER FIXES. 6 Important. Permission model verified CORRECT.
  Reviewer checked the gating against pb_migrations directly, not the docs, and
  confirmed all three asymmetries: box update = creator-or-editor, box delete =
  creator-only, item rights key off the BOX's rights not the item's created_by.
  All eight mutation call sites handle a 403 rather than trusting the UI gate.
  --
  
  ## Deferring: /print-sheet dead link (self-resolves when slice C merges);
  ## title required-vs-PRD-optional (follows the plan; PRD conflict noted);
  ## editor fields rendered with {{ }} (self-consistent); stale comment;
  ## selectedIds not cleared across pages -> folding into the fix, it is one line.
  
  ## slice-b: fixes landed (3 commits, e55f71c tip). MERGE-READY.
  Restore guard PROVEN structurally, not empirically: the agent replaced the
  --
  against `pnpm generate` output on its own port, plus auth.setup.ts re-run per
  baseURL because storageState is origin-scoped. Deferring that as test
  infrastructure. Note the membership-cache alarm never fired — it was never
  reached, so it is untested rather than broken.
  
  ## REAL PRODUCT GAP: slice D's offline work is not wired into the app at all
  assertOnline() is called from NOWHERE. OfflineBanner.vue and InstallPrompt.vue
  are mounted NOWHERE. Confirmed by grep across app/.
  --
  silent failure the PRD forbids.
  This is MY deferred merge step, not slice D's omission: I told D it did not own
  the layout and to state the drop-in lines for the merge step to place. This is
  that step, and it must happen before wave 1 can be called done.
  
  ## Ruling: guard every write mutation, and expect TanStack to be in the way
  Likely crux: TanStack Query's default mutation networkMode is 'online', which
  PAUSES a mutation while offline — so mutationFn never runs and an assertOnline()
