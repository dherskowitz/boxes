# Wave 3 decision log

Decisions made on the user's behalf during wave 3 (tag wiring, the final
slice of v1), preserved from the SDD ledger before its workspace was deleted.

## Ruling: W3-1 the silent-clear guard is asymmetric — FIX before merge
The code is correct for BOTH boxes and items (each spread-copies
props.existing?.tags ?? []), but only boxes are TESTED. Reverting
ItemForm.vue:19 to ref([]) leaves the entire suite green:
  - itemDetail.spec.ts:61 is the only test that opens the item edit form, and
    its item is created with tags defaulting to [], so a wipe is unobservable;
  - tagging.spec.ts:91 covers item CREATE only;
  - no unit test mounts either form.
The implementer's mutation test exercised BoxForm alone.
This is the exact failure the plan named as the slice's known risk, and it
destroys user data silently: edit an item's title, lose every tag, no error,
green CI, invisible until someone filters and the item is missing.
Fixing rather than deferring because it is the LAST slice — there is no wave 4
to catch it — and the fix is ~15 lines reusing helpers that already exist.

## Ruling: W3-2 UI-created boxes can leak into the fixture — FIX
tagging.spec.ts:31 and :49 create a box through the UI, so the id is unknown
until the URL assertion resolves, and throwaway.push() comes after it. If that
assertion times out (the config raises the test timeout to 60s precisely because
a cold first compile can be slow), Playwright hard-kills the test and the box
leaks permanently, breaking the 5-box invariant for every later run.
This is the same hole throwawayTags was deliberately written by NAME to close —
the reasoning just was not applied one line up. tagFilter.spec.ts does it right.

## Ruling: W3-3 TagFilter swallows a failed tags fetch — FIX
It destructures only { data, isPending }; on error isPending goes false, tags
stays undefined, and the length>0 branch renders nothing — so a failed request
is presented as "there is no tag vocabulary" on both / and /search. Every other
list surface here renders a UAlert with pbError. CLAUDE.md calls out swallowed
errors specifically. Cheap.

## Ruling: W3-4 interface-surface.md is stale AGAIN — FIX
Missing TagFilter, throwawayTags, tagIdByName. And pre-existing: it documents
tagClauses(tagIds, prefix) with a `prefix` argument the real function has never
had. That doc's own preamble says a stale contract caused a real defect last
wave, so shipping v1 with it wrong is self-refuting.

## Ruling: concern 1 (tag on /search with no term does nothing) — FIX, one line
The reviewer rated it defer-able and it does not block criterion 10, which the
index satisfies twice over. But a chip that toggles solid, writes itself into
the URL, and changes nothing on screen is a control lying to the user.
Taking the reviewer's own suggested one-liner — only offer the filter once there
is a term (v-if="hasTerm") — rather than reversing an earlier slice's deliberate
blank-term contract, which would be changing a decision nobody asked me to
revisit. Hiding a control that cannot work is honest; a conditional idle message
would need product copy that is not mine to invent.

## Ruling: concern 2 (index filter local, search filter in URL) — DEFER
Not the inconsistency it looks like. The index's existing convention IS local
state — showArchived has never been in the URL either, and the page has no other
URL-backed control. search.vue is the outlier, for a documented reason: its term
was already there. Putting the index filter in the URL now means either doing
showArchived too (scope nobody authorised) or shipping a page where one control
persists and the checkbox beside it does not — a worse inconsistency.
Cost if wrong: a filtered index is not linkable. Note for v1.1.
