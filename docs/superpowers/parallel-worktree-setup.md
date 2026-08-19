# Running a worktree's e2e suite in isolation

Five slices, five worktrees, five PocketBase instances. Without this, every
`pnpm test:e2e` fights over port 3000, and every PocketBase fights over port
8090 and the *same* `pb_data` volume — one slice's writes corrupt another
slice's fixtures.

## Pick a slot number

Each worktree/slice gets a number, 1-5. Use the same number everywhere below.

## Commands (slot `<n>`, e.g. 1)

```bash
# 1. Bring up an isolated PocketBase
PB_PORT=809<n> docker compose -p storage-<n> up -d

# 2. Point this worktree's .env at it (create/edit .env, gitignored)
echo "NUXT_PUBLIC_POCKETBASE_URL=http://localhost:809<n>" > .env

# 3. Seed it
python3 scripts/pb-seed.py http://localhost:809<n>

# 4. Run e2e against its own dev server port
E2E_PORT=300<n> pnpm test:e2e

# 5. Tear down when the slice is done
docker compose -p storage-<n> down -v
```

Example for slot 3: `PB_PORT=8093 docker compose -p storage-3 up -d`,
`NUXT_PUBLIC_POCKETBASE_URL=http://localhost:8093`,
`python3 scripts/pb-seed.py http://localhost:8093`, `E2E_PORT=3003 pnpm test:e2e`.

## The gotcha: project name, not just port

`docker compose -p <name>` is what isolates the `pb_data` volume, not the
port mapping. Two stacks with different `PB_PORT` but the same (default)
compose project name still share one named volume and one database — you'd
see two ports pointing at identical data, and slices would clobber each
other's records exactly as if isolation had never been added. Always pass
`-p storage-<n>`.

## Verified

- Default path (no env vars set) still boots on 8090/3000 and passes
  `pnpm test:e2e` unchanged — this is what the main checkout and any
  worktree that skips a slot still get.
- A second stack (`PB_PORT=8092`, `-p storage-2`, `E2E_PORT=3002`) was
  brought up, seeded, and run independently: same seed script, different
  PocketBase record IDs for the same seeded email — proof it's a genuinely
  separate database, not a relabeled connection to the first one. The
  original 8090 instance was unaffected throughout, confirmed by re-checking
  its record IDs after the second stack was live.
