# v1.2 decision log

Decisions made on the user's behalf building the dashboard and items page.

## Ruling: I1 restore the enabled gate — FIX, and MY fix not the implementer's
The implementer's own proposed fix (drop the `?? ''` so it passes undefined) is
a NO-OP: undefined is falsy at the same branch, so the identical all-boxes
request still fires, while looking fixed. That is worse than the bug.
Correct fix: enabled: computed(() => filters.value.boxId !== ''). '' means
"still loading, do not query"; absent means "/items, browse all". Two falsy
values with opposite meanings three lines apart — the comment is mandatory,
because that ambiguity is exactly what produced this.
Cost of not fixing: a 30-record expand=tags,box request per box page load on
the phone-on-slow-connection target, competing with the request that actually
blocks the render, plus junk in the SW cache and the query cache.

## Ruling: MY SPEC AND MY PLAN ARE BOTH WRONG — correct them
Spec §4.1 and slice-i plan Task 1 Step 3 both state "box detail always passes a
box id and is unaffected". Both false in the same way: it passes '' while the
box loads. The implementer caught it, I confirmed it, the reviewer proved it.
Correcting both so slice D does not inherit the claim, and so the next reader
does not trust it.

## Ruling: M1 items-empty is reachable — FIX, "unavoidable" was not true
The report called emptying the database the only route to the empty state. The
spec file already uses page.route().fulfill() to stub a 500 for the error state;
the same trick with a 200 and an empty page reaches it in six lines and touches
no fixture. Reviewer confirmed no seeded user can reach it naturally, since
storage_items.listRule grants every enabled member every item.

## Ruling: M2 add the executable filter assertion for the term — FIX
The term is asserted only against `raw`. Both searchFilter.spec and
itemFilter.spec already pipe results through a real pb.filter() — but only for
boxId. The code is safe (reviewer verified the escaping by hand); this is a
missing mirror on the one input that is user-typed text.

