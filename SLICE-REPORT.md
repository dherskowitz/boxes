# Slice B — Tags

Branch `slice-b`. Five commits, all green.

| Commit | Task |
|---|---|
| `dee6558` | Allow maplibre-gl build script so `pnpm install` does not block on a prompt |
| `50d20f1` | Task 1 — tag create / rename / delete mutations |
| `19af700` | Task 2 — tag usage counts from the report view |
| `f1f480c` | Task 3 — `TagPicker` with autocomplete and inline creation |
| `ca5767a` | Task 4 — tag management page (`/tags`) |

## What each task delivered

**Task 1 — mutations (`app/queries/tags.ts`).** `useTags` (full list, sorted by
name, 5 min `staleTime`), `useCreateTag`, `useRenameTag`, `useDeleteTag`, and the
exported `normalizeTagName`. Two API-rule constraints are encoded here and are
easy to reintroduce as bugs:

- Create **must** send `created_by: userId.value`; the create rule compares
  `@request.body.created_by = @request.auth.id` and an omitted field resolves to
  empty and 403s.
- Rename **must** send only `{ name }`. The update rule uses `created_by:isset =
  false`, so including `created_by` 403s *even when set to the correct value*.
  Never spread a fetched record into `update()`.

`normalizeTagName` trims, lowercases and collapses internal whitespace. Tags are
a curated shared vocabulary with a unique constraint on `name`; without this,
`"Winter"`, `"winter "` and `"winter"` become three tags. It returns `''` for
whitespace-only input and callers reject that rather than creating an unnamed tag.

Rename and delete invalidate `keys.boxes.all` and `keys.items.all` as well as
`keys.tags.all` — a tag is a relation that boxes and items `expand`, so their
cached copies still carry the stale label otherwise.

**Task 2 — usage counts.** `useTagUsage()` reads the `storage_report_tag_usage`
view and returns a `computed` `Map<string, { boxCount, itemCount }>` keyed by tag
id, so a caller does an O(1) lookup instead of rescanning the report each render.
Counts are computed in SQL by the view, not by fetching every box and item and
counting client-side. A tag with no usage row is simply absent from the map;
callers fall back to `{ boxCount: 0, itemCount: 0 }`. The pure indexing step is
split out as `indexTagUsage(rows)` so it is unit-testable without a PocketBase.

**Task 3 — `TagPicker`.** Reusable, standalone: no router use, no page-specific
assumptions. Contract documented in full below.

**Task 4 — `/tags` page (`app/pages/tags.vue`).** Lists every tag with its colour
chip and `N boxes, N items`. Inline rename for any enabled member. Delete behind
`useAuth().role === 'owner' || 'admin'`, with a confirmation modal naming the tag
and what deleting it costs. Loading state `data-testid="tags-loading"`, empty
state `data-testid="tags-empty"`, every failure surfaced through `pbError`.
Per-row test ids are `rename-tag-<name>` / `delete-tag-<name>`.

There is deliberately **no create-tag form** on this page. Tags are created
inline from the picker, in context, where the user actually needs one; a second
creation path is scope the PRD does not ask for.

## TagPicker contract — read this before mounting it in Wave 3

```vue
<TagPicker v-model="form.tags" />
```

- **`v-model` is the only binding. There are no other props.** Declared as
  `defineModel<string[]>({ default: () => [] })`.
- **The model value is `string[]` of tag *ids*** — never names, never `StorageTag`
  objects. This is exactly the shape `StorageBox.tags` and `StorageItem.tags`
  store, so bind a form field straight to it with no mapping in either direction.
- It is a **plain `v-model`**, not a named one: `v-model`, not `v-model:tags`.
- **The component replaces the array rather than mutating it** (`model.value =
  [...model.value, id]`), so a `ref([])`, a reactive object property, or a
  `computed` with a setter all work.
- Passing nothing yields `[]` via the model default, but `v-model` on a `ref`
  initialised to `undefined` will not — initialise the field to `[]`.
- The component **creates tags itself** on the create affordance, via
  `useCreateTag`, and pushes the new id into the model immediately. The parent
  form does not need to create anything; it just persists the id array. Typing a
  name that already exists selects the existing tag instead of erroring on the
  unique constraint.
- Create errors render inside the component (`data-testid="tag-picker-error"`);
  they are not emitted, and there are **no emits** beyond the model update.
- Test ids for selected chips: `selected-tag-<id>` and `remove-tag-<id>` — id,
  not name.

The picker does **not** save anything to the parent record. It only manages the
id array; persisting it is the owning form's job.

## Loop output

Run from this worktree with `E2E_PORT=3002` (plain `pnpm test:e2e` grabs 3000 and
collides with the other slices' stacks).

**`pnpm lint`** — exit 0, clean.

```
$ eslint .
```

**`pnpm typecheck`** — exit 0, clean.

```
$ vue-tsc --build --noEmit
```

**`pnpm test`** — exit 0, 58/58.

```
 Test Files  9 passed (9)
      Tests  58 passed (58)
   Duration  63.38s
```

Caveat, stated plainly: the *first* invocation of `pnpm test` failed all six
Nuxt-environment suites with `Error: Hook timed out in 30000ms` inside
`setupNuxt`. The machine was at load ~31 on 8 cores. Re-running as
`pnpm test --hookTimeout=180000 --testTimeout=120000` gave 58/58. No test or
source file was changed between the two runs — this is the shared 30s default
hook timeout being too tight for `setupNuxt` on a heavily oversubscribed box,
not a defect in this slice. On an idle machine the plain command should pass.

**`E2E_PORT=3002 pnpm test:e2e --workers=1`** — exit 0, 18/18.

```
  ✓  17 [mobile] › tests/e2e/tags.spec.ts:81:3 › as a plain member › can see tags but not delete them (12.9s)
  ✓  18 [mobile] › tests/e2e/tags.spec.ts:87:3 › as a plain member › a direct delete attempt is refused by the API, not just hidden in the UI (535ms)

  18 passed (4.0m)
```

`--workers=1` is a load accommodation, not a config change; `playwright.config.ts`
is untouched. At default parallelism (4 workers) on a load-31 box, several tests —
including pre-existing `auth.spec.ts` ones this slice never touched — time out at
the 15s `expect` timeout waiting for the SPA to boot. Serialised, the suite is
stable.

### One real test bug fixed during the loop

The first e2e run failed the delete-confirmation test on a strict-mode violation:
`getByText(/sentimental/i)` matched both the list row behind the modal and the
dialog copy. Fixed by scoping to the dialog, which asserts what the test name
actually claims:

```ts
const dialog = page.getByRole('dialog')
await expect(dialog).toContainText('sentimental')
await expect(dialog).toContainText('1 boxes and 1 items')
```

This is strictly tighter than what it replaced. Nothing was skipped or weakened.

## Fixture restoration — demonstrated, not assumed

The `/tags` rename test mutates shared seed data (`kitchen` → `kitchenware` and
back), so a test that only passes against a fresh seed would break every later
run. Evidence it restores:

- The suite was run **four times end to end** against the same PocketBase on
  8092 with no reseed between runs. The rename test passed in **all four**,
  including consecutive full-green runs of 18/18.
- Queried directly afterwards, the tag set is byte-identical to seed:
  `fragile, kitchen, paperwork, sentimental, winter`.

Two intermediate runs had failures, and both were load timeouts rather than
fixture damage — worth spelling out because one of them, `sees the delete
control`, is exactly what a deleted `sentimental` would look like. It was not:
the tag was still present in the database immediately after that run, and the
plain-member test that asserts the control is *hidden* would have passed
vacuously if the tag were gone. The delete test only opens the confirmation
dialog and never confirms, so nothing is ever actually deleted.

## Notes for whoever integrates this

- `app/pages/tags.vue` renders `"1 boxes and 1 items"` — no pluralisation. Left
  alone deliberately: fixing it is a copy decision, not mine to invent, and the
  e2e assertion pins the current string.
- The e2e run logs `No match found for location with path "/reports"`. That nav
  link belongs to another slice and resolves once the slices merge.
- `tests/e2e/tags.spec.ts` reads `NUXT_PUBLIC_POCKETBASE_URL` from `.env`
  directly, because the Playwright process does not inherit the worktree's `.env`
  the way the `nuxt dev` child does. It does not hardcode a URL.
- Slice A owns `/box/:qr_id`, which does not exist in this worktree, so the
  plan's "renamed label shows on the box" assertion is made at the data layer
  instead: `seedbox2` is refetched with `expand: 'tags'` and asserted to carry
  the new name, proving the tag is a relation and not a copied string. Worth
  re-adding the UI-level assertion after the merge.

## Review fixes

Three findings from review, all fixed before merge.

**1. Rename test restore was not exception-safe.** `tests/e2e/tags.spec.ts`
renamed `kitchen → kitchenware`, asserted, then renamed back inline — with no
`try/finally`. If any assertion in that window threw, the test would abort
before the restore ran, leaving the shared fixture permanently renamed for
every later run, every other slice, and CI. Four clean runs proved this
*didn't* happen; they never proved it *couldn't*.

Fixed with a `test.afterEach` in the `as an owner` describe block that
unconditionally renames `kitchenware` back to `kitchen` via the PocketBase API
directly (not the UI, so it doesn't depend on the page under test still being
usable). It looks up a tag named `kitchenware`; if none exists, the fixture is
already clean and it's a no-op. This runs after every test in the block,
success or failure, so no failure path — including one before the in-test
restore runs — can leave the fixture dirty.

Proved it, not just wrote it: temporarily replaced the `toContain('kitchenware')`
assertion with `toContain('DELIBERATE-FAILURE-TO-PROVE-RESTORE-GUARD')`, which
sits *before* the in-test restore step. Ran the test in isolation
(`-g "can rename a tag"`): it failed exactly as expected, on that assertion,
before ever reaching the restore code. Queried PocketBase directly afterwards —
the tag set was `fragile, kitchen, paperwork, sentimental, winter`, i.e. the
`afterEach` guard renamed `kitchenware` back to `kitchen` even though the test
body itself never got there. Reverted the deliberate failure and reran the
real assertion to confirm the test passes normally again.

**2. Inline rename accepted an empty name.** `saveRename()` in
`app/pages/tags.vue` sent `editName.value` straight to `useRenameTag` with no
guard. `normalizeTagName('   ')` returns `''`, and PocketBase accepts it —
`storage_tags.name` is `"required": false` in the migration and the unique
index permits exactly one empty-string row, so the API returns 200, not 400.
A member clearing the field and hitting Save would silently blank a shared tag
everywhere it's applied.

Fixed by normalising and checking in `saveRename` before calling the mutation,
mirroring the guard `TagPicker.onCreate` already had: if the normalised name
is empty, set `renameError.value = 'Tag name cannot be empty.'` and return
without calling `renameTag.mutateAsync`. Added
`tests/nuxt/tagsPage.spec.ts`, mounting the real page with mocked composables,
covering both the empty-name refusal (asserts the error message renders and
`mutateAsync` is never called) and a normal whitespace/case-normalised rename
that does call through.

**3. Misleading comment on `useRenameTag`/`useDeleteTag`.** The comment
claimed omitting `created_by` avoided the update rule's `:isset = false`
check — true for boxes and items, but checked against the migration,
`storage_tags.updateRule` is just "any enabled member," with no `created_by`
check and no `:isset` guard at all. Reworded to say what's actually true:
tags are a shared, curated vocabulary rather than something a user owns,
`created_by` is optional on the collection, and the update rule doesn't gate
on it — omitting the field is still correct, just for a different reason.

Loop after the fixes: `pnpm lint` clean, `pnpm typecheck` clean, `pnpm test
--hookTimeout=180000` 60/60 (58 prior + 2 new in `tagsPage.spec.ts`),
`E2E_PORT=3002 pnpm test:e2e --workers=2` 18/18 — run twice in a row, both
green. Tag set queried directly from PocketBase after both runs: exactly
`fragile, kitchen, paperwork, sentimental, winter`.
