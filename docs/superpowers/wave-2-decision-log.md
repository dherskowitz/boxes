# Wave 2 decision log

Decisions made on the user's behalf during wave 2 (sharing, comments, search),
preserved from the SDD ledger before its scratch workspace was deleted.

## Ruling: stop a stalled agent immediately, do not resume
All three wave-2 implementers stalled the same way wave 1's did — finishing the
real work, then waiting forever on a background-task notification that never
arrives, each leaving an orphaned dev server behind. That is now 7 of 9
implementer agents across the project.
Resuming slice B once in wave 1 produced no progress and a second stall, and
briefly left two agents live in one worktree — a corruption hazard. So: TaskStop
on the first stall, verify the worktree and fixture, then dispatch a fresh agent
scoped to the small remainder with an explicit "run everything in the foreground"
instruction.

## Ruling: G/1 no pagination on search results — DEFER, but it is real
Both queries hard-code page 1 at PER_PAGE=30 with no page control, unlike
BoxSection which exposes totalPages. A term matching more than 30 boxes or 30
items silently hides the rest with no "showing N of M". It satisfies the
never-fetch-unbounded rule, and the 5-box fixture cannot exercise it, so no test
would catch it either way.
Deferring rather than fixing: it is a Minor, PRD §7.6 does not ask for paged
search results, and the honest minimum (a "showing the first 30" indicator) is
cleaner as its own change than bolted onto a merge. Flagging to the final review.
Cost if wrong: on a large collection a user believes they have seen everything
when they have not — visible and fixable, not silent corruption.

## Ruling: G/2 no-op submit handler on /search — DEFER, cosmetic
Pressing Enter while already on /search does nothing, because the debounced
watch already drives the query. A keyboard user forcing an immediate search
waits out the 400ms debounce instead. Cosmetic.

## Ruling: F-1 the criterion is STILL only half-proven — FIX (my instruction was wrong)
I told slice F that asserting a permission row exists proves the form, not the
feature, and demanded a second-browser-context test showing the granted user can
edit. It wrote that. The reviewer showed my demand was still insufficient:
`edit-box` is rendered by v-if="canEdit", i.e. by canEditBox() — a CLIENT
predicate that CLAUDE.md says is not access control. So the test proves the row
exists, is correctly scoped, and the client predicate flips. It does NOT prove
storage_boxes.updateRule accepts rae's PATCH. And it never touches items at all,
though criterion 5 says "the box AND ITS ITEMS".
Pre-existing coverage does not compose either — boxDetail.spec.ts's granted-editor
test is also pure button visibility. Across the whole suite an editor grant has
never once produced a successful server-side write.
Failure it would miss: if the migration's updateRule lost its
storage_box_permissions_via_user clause, every test stays green and the granted
user gets a 404 on save — the exact inverse of the failure the
"hiding a button is not access control" rule exists to prevent.
Fix: after granting, have a rae-authenticated SDK client actually update the box
and create an item, against a throwaway box rather than a seeded one.

## Ruling: F-4 a role:'' row is invisible AND re-grantable — FIX
Both the editors list and the grantable filter test role === 'editor', but the
select is required:false so an unset grant returns ''. Such a row shows nowhere
and does not exclude the user, so granting again creates a duplicate — the exact
duplicate the plan's fifth unit test was written to prevent, through another door.
Filter `granted` on the user field regardless of role; keep the display filter.

## Ruling: E-1 the unread badge degrades the WRONG WAY — FIX, and the docs lie
With localStorage blocked, readLastViewed returns null, countUnread treats null
as "never viewed", and markItemRead cannot clear it because the write also
throws. So the badge is permanently ON showing every other person's comment —
not "no badge". The plan, the file's own docstring, and SLICE-REPORT.md all
claim it degrades to no badge. Three sources, all wrong about the read path.
Reachable in Safari private browsing or a managed browser.

## Ruling: E-3 stale badge across items — FIX NOW, not later
lastViewed is captured once at setup and markItemRead fires once in onMounted;
navigating item->item reuses the route record so neither re-runs. The reviewer
notes it is unreachable today because nothing links item to item — but slice G
ships search results that link straight to items, and G merges in THIS wave. So
it becomes reachable the moment these three land together. That timing is why it
is worth fixing now rather than deferring.

## Ruling: E-5 the duplicate-submit test can poison the fixture — FIX
It asserts toHaveLength(1) BEFORE registering anything for cleanup. If the
guard ever regresses and two comments post, the assertion throws, cleanup never
registers, and both extras stay on the peacoat — breaking the "exactly 2
comments" invariant for every later run and slice A's counts. Push matches
first, then assert.


## Findings recorded but not fixed

## FINDING OUTSIDE BOTH SLICES: the server is MORE permissive than the client
pb_migrations/…schema.js:337 gates box update with two independent `?=` clauses
over the same back-reference set:
  storage_box_permissions_via_user.box ?= id
  storage_box_permissions_via_user.role ?= "editor"
They are evaluated independently, so a user holding an editor grant on box A and
ANY row on box B satisfies both clauses for box B. canEditBox() correctly
requires ONE row to match both, so the client is STRICTER than the server —
the opposite of what the code comments assume.
Exploitability is low: only a box creator can create rows, and our UI always
writes role:'editor'. The reachable case needs a role:'' row (the select is
required:false), which is the same root as F-4.
NOT fixing here: it is a schema/API-rule change, nobody owns pb_migrations/, and
CLAUDE.md requires asking before changing an API rule. Surfacing to the user.

