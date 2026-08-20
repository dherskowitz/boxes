# Demo data

`scripts/pb-demo-seed.py` builds a collection big enough to actually look at:
**40 boxes, 388 items, 14 tags, ~90 comments, 8 editor grants, ~180 photos**,
across six accounts.

It exists because the test fixture is deliberately tiny and exact. With 5 boxes
and 9 items you cannot see pagination, the reports charts have nothing to plot,
tag filters have no overlap, and every search returns one hit.

## It is not the test fixture

`scripts/pb-seed.py` produces the dataset the e2e suite asserts against — 5
boxes, 9 items, 5 tags, 2 comments, 1 permission row. Around 93 tests check
those counts.

**Running the demo seeder against the same instance will fail the suite** until
you re-run `pb-seed.py`. The script says so when it finishes.

## Recommended: give it its own instance

The cleanest way to keep both is a second PocketBase, using the same port and
compose-project mechanism the parallel worktrees use:

```bash
pnpm demo:up      # PB_PORT=8099 docker compose -p storage-demo up -d
pnpm seed:demo    # seeds http://localhost:8099
```

Then point the app at it for a browsing session by setting `.env`:

```
NUXT_PUBLIC_POCKETBASE_URL=http://localhost:8099
```

Change it back to `http://localhost:8090` before running the e2e suite. Tear the
demo instance down with `pnpm demo:down` (this removes its volume).

If you would rather use the main instance, that works too — just run `pnpm seed`
(the fixture, on 8090) before `pnpm test:e2e`.

## Options

```bash
pnpm seed                     # the e2e fixture, on 8090
pnpm demo:up                  # start the demo instance on 8099
pnpm seed:demo                # everything, with photos
pnpm seed:demo --no-photos    # faster, no images
pnpm demo:down                # stop it and drop its volume

# --backdate needs the compose project name, so call the script directly:
COMPOSE_PROJECT=storage-demo \
  python3 scripts/pb-demo-seed.py http://localhost:8099 --backdate
```

Flags after `pnpm seed:demo` are passed straight through to the script.

Local URLs only — it refuses anything that is not `localhost` or `127.0.0.1`.
It is idempotent: it wipes the `storage_*` records and its own `@local.test`
accounts, then rebuilds. The `app_memberships` wipe is scoped to those accounts,
so it never disturbs another app's rows on a shared instance.

Output is deterministic — a fixed random seed means the same boxes, items and
photos every run, and `--no-photos` produces the same 388 items as a full run
rather than a different set.

### `--backdate`, and why it is opt-in

PocketBase's `created` is an autodate field: **the API silently ignores any
value you send** and stamps its own. Verified, not assumed. So a freshly seeded
collection has every record created today, and the reports growth chart shows
"not enough history yet" — the one widget a demo dataset most needs to
demonstrate.

`--backdate` works around it by stopping the container, editing `data.db`
directly with `sqlite3`, and starting it again. That is real database surgery
behind PocketBase's back, which is why it is a flag rather than the default. It
is safe here because the data is local and disposable, but do not point it at
anything you care about.

It needs the compose project name, since it has to find the container:
`COMPOSE_PROJECT=storage-demo` for the demo instance, or the default
`storage-app` for the main one.

## Accounts

Password for all: `storagedev123`.

| email | name | role |
|---|---|---|
| `dana@local.test` | Dana Herskowitz | owner |
| `sam@local.test` | Sam Okafor | member |
| `rae@local.test` | Rae Lindqvist | member |
| `priya@local.test` | Priya Raghunathan | member |
| `marcus@local.test` | Marcus Boateng | admin |
| `nobody@local.test` | Jo Nakamura | **no membership** — the access-denied case |

The first four match the test fixture, so the credentials elsewhere in the docs
stay correct. `marcus` is an admin so tag deletion — which requires `owner` or
`admin` — is explorable without editing the database.

## What it deliberately includes

- **One empty box**, so the empty-item state is reachable without contriving it.
- **Four archived boxes**, so the archived toggle and the reports status split have something to show.
- **A 90-character box title**, because that is what breaks a chart axis or a card layout.
- **Boxes created by different users**, so the permission matrix is real rather than everything belonging to one account.
- **Items with and without notes**, and only some with photos — searching notes and the reports photo count both stay meaningful.

## Photos

Generated, not downloaded: a tinted background with the box or item name drawn
on it. No network, no licensing questions, and they are visually distinct enough
to tell apart in a gallery.

They are uploaded directly, which bypasses the client-side compression the app
applies to real uploads — so they are kept small (800×600, quality 70) to keep
the seed fast and the offline image cache realistic.
