#!/usr/bin/env python3
"""Seed the local PocketBase with a realistic fixture for development and e2e.

Idempotent — deletes the records it owns, then recreates them. Local only;
never point this at a hosted instance.

Usage: python3 scripts/pb-seed.py http://localhost:8090
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

PASSWORD = "storagedev123"

USERS = [
    ("dana@local.test", "Dana Herskowitz", "owner"),
    ("sam@local.test", "Sam Okafor", "member"),
    ("rae@local.test", "Rae Lindqvist", "member"),
    ("nobody@local.test", "Jo Nakamura", None),  # no membership: access-denied case
]

TAGS = [
    ("fragile", "#dc2626"),
    ("winter", "#2563eb"),
    ("kitchen", "#16a34a"),
    ("paperwork", "#ca8a04"),
    ("sentimental", "#9333ea"),
]

# (title, location, status, tag names, [(item title, description, notes, tags)])
BOXES = [
    (
        "Winter coats and boots",
        "Garage shelf A3",
        "active",
        ["winter"],
        [
            ("Navy wool peacoat", "Size M, from the Boston winters", "Dry clean before wearing", ["winter"]),
            ("Sorel snow boots", "Size 9, waterproofed last season", "Left toe is scuffed", ["winter"]),
            ("Box of wool scarves", "Six scarves, one cashmere", "", []),
        ],
    ),
    (
        "Kitchen overflow: the bread machine, the stand mixer bowl we never use, and assorted baking tins",
        "Basement under the stairs",
        "active",
        ["kitchen", "fragile"],
        [
            ("Panasonic bread machine", "Works, missing the paddle", "Replacement paddle is about $12 online", ["kitchen"]),
            ("Springform tins, set of 3", "", "One warped in the oven", ["kitchen", "fragile"]),
        ],
    ),
    (
        "Tax records 2019-2023",
        "Office closet, top shelf",
        "active",
        ["paperwork"],
        [
            ("2019 returns and receipts", "Filed, accepted", "Shred after April 2026", ["paperwork"]),
            ("2020 returns and receipts", "Filed, accepted", "", ["paperwork"]),
            ("2021-2023 returns", "Three years, one folder", "Still within audit window", ["paperwork"]),
        ],
    ),
    ("Empty spare box", "Garage shelf B1", "active", [], []),
    (
        "College photo albums",
        "Attic",
        "archived",
        ["sentimental", "fragile"],
        [("Graduation album 2011", "Leather bound, water damage on the back cover", "", ["sentimental"])],
    ),
]


def call(base, path, token=None, data=None, method=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(
        base + path, data=body, method=method or ("POST" if body else "GET")
    )
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", token)
    try:
        raw = urllib.request.urlopen(req).read()
        return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raise SystemExit(
            f"{method or 'POST'} {path} failed with {exc.code}: "
            f"{exc.read().decode(errors='replace')}"
        ) from exc


def wipe(base, token, collection, filter_expr=None):
    qs = "?perPage=200"
    if filter_expr:
        qs += "&filter=" + urllib.parse.quote(filter_expr)
    while True:
        page = call(base, f"/collections/{collection}/records{qs}", token)
        if not page.get("items"):
            return
        for record in page["items"]:
            call(base, f"/collections/{collection}/records/{record['id']}", token, method="DELETE")


def list_all(base, token, path):
    sep = "&" if "?" in path else "?"
    items = []
    page = 1
    while True:
        result = call(base, f"{path}{sep}page={page}", token)
        items.extend(result.get("items", []))
        if page >= result.get("totalPages", 1):
            return items
        page += 1


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    root = sys.argv[1].rstrip("/")
    if urllib.parse.urlparse(root).hostname not in ("localhost", "127.0.0.1"):
        raise SystemExit(f"refusing to seed a non-local instance: {root}")
    base = root + "/api"
    token = call(
        base,
        "/collections/_superusers/auth-with-password",
        data={
            "identity": os.environ.get("PB_ADMIN_EMAIL", "dev@local.test"),
            "password": os.environ.get("PB_ADMIN_PASSWORD", "devpassword123"),
        },
    )["token"]

    # Resolve the seeded accounts' ids up front so the app_memberships wipe
    # below can be scoped to them. This is a shared, multi-app PocketBase
    # instance (PRD §4) — deleting every app_memberships row would silently
    # revoke access for every other app on the instance. Do not "simplify"
    # this back to a blanket wipe() of app_memberships.
    local_user_ids = [
        user["id"]
        for user in list_all(base, token, "/collections/users/records?perPage=200")
        if user["email"].endswith("@local.test")
    ]

    for collection in (
        "storage_comments",
        "storage_box_permissions",
        "storage_items",
        "storage_boxes",
        "storage_tags",
    ):
        wipe(base, token, collection)
    if local_user_ids:
        membership_filter = " || ".join(f'user = "{uid}"' for uid in local_user_ids)
        wipe(base, token, "app_memberships", filter_expr=membership_filter)
    for user_id in local_user_ids:
        call(base, f"/collections/users/records/{user_id}", token, method="DELETE")

    app_id = call(base, "/collections/apps/records", token)["items"][0]["id"]

    users = {}
    for email, name, role in USERS:
        record = call(
            base,
            "/collections/users/records",
            token,
            {
                "email": email,
                "password": PASSWORD,
                "passwordConfirm": PASSWORD,
                "name": name,
                "verified": True,
            },
        )
        users[email] = record["id"]
        if role:
            call(
                base,
                "/collections/app_memberships/records",
                token,
                {"user": record["id"], "app": [app_id], "role": role, "enabled": True},
            )

    dana, sam = users["dana@local.test"], users["sam@local.test"]

    tags = {}
    for name, color in TAGS:
        tags[name] = call(
            base,
            "/collections/storage_tags/records",
            token,
            {"name": name, "color": color, "created_by": dana},
        )["id"]

    first_box_id = None
    for index, (title, location, status, tag_names, items) in enumerate(BOXES):
        box = call(
            base,
            "/collections/storage_boxes/records",
            token,
            {
                "title": title,
                "location": location,
                # No schema default: an omitted status lands empty and the box
                # disappears from the index filter.
                "status": status,
                "qr_id": f"seedbox{index + 1}",
                "tags": [tags[t] for t in tag_names],
                "created_by": dana,
            },
        )
        if first_box_id is None:
            first_box_id = box["id"]
        for item_title, description, notes, item_tags in items:
            item = call(
                base,
                "/collections/storage_items/records",
                token,
                {
                    "box": box["id"],
                    "title": item_title,
                    "description": description,
                    "notes": notes,
                    "tags": [tags[t] for t in item_tags],
                    "created_by": dana,
                },
            )
            if item_title == "Navy wool peacoat":
                call(
                    base,
                    "/collections/storage_comments/records",
                    token,
                    {"item": item["id"], "user": sam, "text": "Is this the one with the missing button?"},
                )
                call(
                    base,
                    "/collections/storage_comments/records",
                    token,
                    {"item": item["id"], "user": dana, "text": "No, I had that one repaired last spring."},
                )

    # Sam is an editor on the first box only, so the permission matrix is testable.
    call(
        base,
        "/collections/storage_box_permissions/records",
        token,
        {"box": first_box_id, "user": sam, "role": "editor"},
    )

    print(f"seeded {len(USERS)} users, {len(TAGS)} tags, {len(BOXES)} boxes")
    print(f"all passwords: {PASSWORD}")


if __name__ == "__main__":
    main()
