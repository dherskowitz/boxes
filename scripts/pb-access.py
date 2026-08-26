#!/usr/bin/env python3
"""Why can this user not sign in?

Every `storage_*` API rule, and the `storage_app_users` view that `login()`
checks, gate on the same three things: an **enabled** `app_memberships` row,
whose `app` includes the row in `apps` with `key = "storage"`. This reports
which of those is missing rather than leaving you to read the join by hand.

    python3 scripts/pb-access.py <url> [email]

    python3 scripts/pb-access.py https://pb.example.com someone@example.com

Needs superuser credentials: `apps` and `app_memberships` have every API rule
set to null, so no client token can read them — which is exactly why the view
exists. Set PB_ADMIN_EMAIL, and either set PB_ADMIN_PASSWORD or let it prompt.
Nothing is written; this only reads.
"""
import getpass
import json
import os
import sys
import urllib.error
import urllib.request

# The collections the app cannot start without. `apps` / `app_memberships` are
# shared with every other app on the instance; the rest are this app's own.
VIEWS = ("storage_app_users", "storage_report_box_fill", "storage_report_tag_usage", "storage_report_growth")

# Cloudflare in front of a deployed instance bans urllib's default user agent
# outright — `403` with a body of `error code: 1010`, which reads exactly like
# a rejected password and is not one. Any explicit agent is accepted.
USER_AGENT = "storage-app-pb-access/1.0"


def get(base, path, token):
    request = urllib.request.Request(base + path, headers={"Authorization": token, "User-Agent": USER_AGENT})
    return json.load(urllib.request.urlopen(request))


def superuser_token(base):
    email = os.environ.get("PB_ADMIN_EMAIL")
    if not email:
        # Only assume the dev credentials for a local instance — reaching for
        # them against a deployed one is a failed login that looks like a
        # broken script.
        local = "localhost" in base or "127.0.0.1" in base
        email = "dev@local.test" if local else input("superuser email: ").strip()
    password = os.environ.get("PB_ADMIN_PASSWORD")
    if not password:
        password = "devpassword123" if email == "dev@local.test" else getpass.getpass("superuser password: ")

    request = urllib.request.Request(
        f"{base}/api/collections/_superusers/auth-with-password",
        data=json.dumps({"identity": email, "password": password}).encode(),
        headers={"Content-Type": "application/json", "User-Agent": USER_AGENT},
    )
    try:
        return json.load(urllib.request.urlopen(request))["token"]
    except urllib.error.HTTPError as e:
        # The body, not just the status. 400 is a wrong password; 403 means the
        # account was found and refused, and only the message says why.
        try:
            detail = e.read().decode()[:400]
        except Exception:
            detail = "<no body>"
        sys.exit(f"superuser login failed for {email} — HTTP {e.code}\n{detail}")
    except urllib.error.URLError as e:
        sys.exit(f"cannot reach {base}: {e.reason}")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    base = sys.argv[1].rstrip("/")
    wanted = sys.argv[2].strip().lower() if len(sys.argv) > 2 else None
    token = superuser_token(base)

    names = {c["name"] for c in get(base, "/api/collections?perPage=200", token)["items"]}
    missing = [v for v in VIEWS if v not in names]
    if "storage_app_users" in missing:
        # login() reads this view directly, so its absence rejects every
        # account no matter how good the membership row is.
        print("!! `storage_app_users` does not exist on this instance.")
        print("   login() reads it directly, so NOBODY can sign in until it does.")
        print("   Fix: python3 scripts/pb-verify.py <url> --emit-fix\n")
    elif missing:
        print(f"!! missing views: {', '.join(missing)} — run scripts/pb-verify.py <url> --emit-fix\n")

    apps = get(base, "/api/collections/apps/records?perPage=200", token)["items"]
    storage = next((a for a in apps if a.get("key") == "storage"), None)
    if storage is None:
        keys = [a.get("key") for a in apps] or ["none at all"]
        sys.exit(f"!! no row in `apps` with key = 'storage' (found: {keys}). Nobody can sign in.")
    print(f"apps: storage = {storage['id']} ({storage.get('name')}), active={storage.get('active')}")

    users = get(base, "/api/collections/users/records?perPage=500", token)["items"]
    memberships = get(base, "/api/collections/app_memberships/records?perPage=500", token)["items"]
    directory = set()
    if "storage_app_users" in names:
        directory = {r["id"] for r in get(base, "/api/collections/storage_app_users/records?perPage=500", token)["items"]}

    if wanted:
        users = [u for u in users if (u.get("email") or "").lower() == wanted]
        if not users:
            sys.exit(f"!! no user with email {wanted} — check the address, or they never signed up")

    print(f"\n{len(users)} user(s), {len(memberships)} membership rows, {len(directory)} in the directory\n")
    for user in sorted(users, key=lambda u: u.get("email") or ""):
        rows = [m for m in memberships if m.get("user") == user["id"]]
        label = f"{user.get('email')} ({user.get('name') or 'no name'})"
        if not user.get("verified", True):
            print(f"  note    {label} is unverified")
        if not rows:
            print(f"  DENIED  {label}")
            print("          no app_memberships row at all — add one, app = storage, enabled = true")
            continue
        for row in rows:
            linked = row.get("app") or []
            if isinstance(linked, str):
                linked = [linked]
            problems = []
            if not row.get("enabled"):
                problems.append("`enabled` is false — it is a non-required bool, so it saves false unless ticked")
            if storage["id"] not in linked:
                problems.append(f"`app` does not include the storage app (has: {linked or 'nothing'})")
            if problems:
                print(f"  DENIED  {label}  role={row.get('role')}  membership={row['id']}")
                for problem in problems:
                    print(f"          {problem}")
            elif user["id"] not in directory:
                print(f"  DENIED  {label}  role={row.get('role')}")
                print("          membership is good but the user is absent from `storage_app_users`")
                print("          the view is stale or wrong — re-run scripts/pb-verify.py <url> --emit-fix")
            else:
                print(f"  OK      {label}  role={row.get('role')}  in the directory")


if __name__ == "__main__":
    main()
