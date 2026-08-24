#!/usr/bin/env python3
"""Compare a live PocketBase against pb_migrations/, without changing anything.

Usage: python3 scripts/pb-verify.py [base_url] [--emit-fix] [--apply]

PocketBase records every migration it has applied, so a file that has already
run once will never run again — an instance that ended up missing a collection
(a migration that half-applied, an instance built before the file grew) stays
missing it, silently, and the app only says so when someone opens the screen
that reads it.

Reports missing collections, view queries that have drifted from the file,
fields the file has and the instance does not, and rule mismatches. Writes
nothing unless asked. Exits non-zero when anything differs.

--emit-fix writes a follow-up migration carrying just the collections that
differ, copied from the baseline file rather than retyped: review it, commit
it, and let the instance run it on its next restart.

--apply creates the absent ones over the API instead, for an instance you
cannot easily redeploy or restart. It only ever creates what is missing — a
collection that exists but has drifted is reported and left alone, since
patching one in place is how an instance stops matching the file everyone
else runs. Use the migration for those.

Superuser credentials come from PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD when set,
otherwise it prompts.
"""
import getpass
import glob
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

# Cloudflare's Browser Integrity Check 403s the default Python-urllib agent
# (error 1010), so every request goes out with a browser-shaped UA.
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")

RULES = ("listRule", "viewRule", "createRule", "updateRule", "deleteRule")


def expected():
    """The collections pb_migrations/ says an instance should have."""
    path = sorted(glob.glob("pb_migrations/*_storage_schema.js"))
    if not path:
        sys.exit("no pb_migrations/*_storage_schema.js found - run from the repo root")
    source = open(path[-1], encoding="utf-8").read()
    out = []
    for var in ("SHARED", "STORAGE"):
        match = re.search(rf"^const {var} = (\[.*?^\])$", source, re.S | re.M)
        if not match:
            sys.exit(f"could not read {var} out of {path[-1]}")
        out.extend(json.loads(match.group(1)))
    return out


def post(url, payload, token=None):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), method="POST",
                                 headers={"Content-Type": "application/json",
                                          "User-Agent": UA})
    if token:
        req.add_header("Authorization", token)
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def get(url, token):
    req = urllib.request.Request(url, headers={"Authorization": token, "User-Agent": UA})
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def squash(sql):
    """View queries come back reformatted, so compare them on words alone."""
    return " ".join((sql or "").split())


def differences(want, live):
    """Every way one collection on the instance falls short of the file."""
    if live is None:
        return [f"missing ({want['type']})"]

    out = []
    if want["type"] != live.get("type"):
        out.append(f"is a {live.get('type')}, the file says {want['type']}")

    if want["type"] == "view":
        if squash(want.get("viewQuery")) != squash(live.get("viewQuery")):
            out.append("view query differs from the file")

    missing_fields = ([f["name"] for f in want.get("fields", [])]
                      and [f["name"] for f in want.get("fields", [])
                           if f["name"] not in {g["name"] for g in live.get("fields", [])}])
    if missing_fields:
        out.append("fields missing: " + ", ".join(missing_fields))

    for rule in RULES:
        if want.get(rule) != live.get(rule):
            out.append(f"{rule}: file has {want.get(rule)!r}, instance has {live.get(rule)!r}")
    return out


def emit_fix(stale):
    """A migration that brings just `stale` back in line with the baseline.

    Extend mode again (`importCollections(..., false)`), so it creates what is
    absent, updates what has drifted, and leaves every other collection on the
    instance — including other apps' — untouched. Down is a no-op: the baseline
    already owns dropping these, and a repair that deletes a collection on
    rollback would take the records with it.
    """
    stamp = int(time.time())
    path = f"pb_migrations/{stamp}_repair_storage_collections.js"
    body = json.dumps(stale, indent=2)
    names = ", ".join(c["name"] for c in stale)
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"""/// <reference path="../pb_data/types.d.ts" />

// Repairs an instance that is missing part of the storage schema, or has
// drifted from it: {names}.
//
// PocketBase records every migration it applies and never re-runs one, so an
// instance that ended up short of the baseline stays short of it. Definitions
// are copied from the baseline by scripts/pb-verify.py --emit-fix.

const REPAIR = {body}

migrate((app) => {{
  app.importCollections(REPAIR, false)
}}, (app) => {{
  // Deliberately empty: the baseline migration owns dropping these, and
  // deleting them here on rollback would take their records with them.
}})
""")
    return path


def apply_missing(base, token, absent):
    """Create the absent collections over the API.

    Order follows the baseline, which puts each view after the tables it
    selects from — a view whose sources are not there yet is rejected.
    """
    for want in absent:
        try:
            post(f"{base}/api/collections", want, token)
            print(f"    created {want['name']}")
        except urllib.error.HTTPError as e:
            print(f"    FAILED {want['name']}: {e.code} {e.read().decode()[:300]}")
            return False
    return True


def main():
    argv = [a for a in sys.argv[1:] if not a.startswith("--")]
    wants_apply = "--apply" in sys.argv
    wants_fix = "--emit-fix" in sys.argv
    base = (argv[0] if argv else "http://localhost:8090").rstrip("/")
    if wants_apply:
        print(f"--apply: absent collections will be CREATED on {base}")
    print(f"PocketBase: {base}")

    identity = os.environ.get("PB_ADMIN_EMAIL") or input("Superuser email: ")
    password = os.environ.get("PB_ADMIN_PASSWORD") or getpass.getpass("Superuser password: ")
    try:
        token = post(f"{base}/api/collections/_superusers/auth-with-password",
                     {"identity": identity, "password": password})["token"]
    except urllib.error.HTTPError as e:
        sys.exit(f"auth failed: {e.code} {e.read().decode()[:200]}")

    live = {c["name"]: c for c in get(f"{base}/api/collections?perPage=500", token)["items"]}

    stale, absent = [], []
    for want in expected():
        found = differences(want, live.get(want["name"]))
        if found:
            stale.append(want)
            if want["name"] not in live:
                absent.append(want)
            print(f"\n  {want['name']}")
            for line in found:
                print(f"    - {line}")
        else:
            print(f"  {want['name']}: ok")

    if stale:
        print(f"\n{len(stale)} collection(s) differ from pb_migrations/.")
        print("PocketBase will not re-run an applied migration, so this needs a "
              "follow-up one.")
        if wants_fix:
            print(f"Wrote {emit_fix(stale)} - review it, commit it, restart the instance.")
        if wants_apply and absent:
            print(f"\n  Creating {len(absent)} absent collection(s):")
            if not apply_missing(base, token, absent):
                sys.exit(1)
            drifted = [c["name"] for c in stale if c not in absent]
            if drifted:
                print("  Left alone, still differing: " + ", ".join(drifted))
            print("  Re-run without --apply to confirm.")
        if not wants_fix and not wants_apply:
            print("Re-run with --emit-fix to write that migration, or --apply to "
                  "create the absent ones over the API.")
        sys.exit(1)
    print("\nEverything the migration defines is present and matches.")


if __name__ == "__main__":
    main()
