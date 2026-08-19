#!/usr/bin/env python3
"""Provision the storage_* view collections against a running PocketBase.

Views are read-only SQL projections. Run this, verify in the admin UI, then
capture the result with pb-snapshot.py. Never hand-edit the migration.

Usage: python3 scripts/pb-views.py http://localhost:8090
"""
import json
import os
import sys
import urllib.error
import urllib.request

GATE = (
    '@request.auth.id != "" &&\n'
    '@request.auth.app_memberships_via_user.app.key ?= "storage" &&\n'
    '@request.auth.app_memberships_via_user.enabled ?= true'
)

VIEWS = {
    # The member directory. users.listRule is `id = @request.auth.id`, so a user
    # can only ever see themselves and relation expansion onto users returns {}.
    # This view is how the app learns display names, roles, and who exists.
    # `app` is a multi-relation, stored as a JSON array, hence json_each.
    "storage_app_users": """
        SELECT
          u.id   AS id,
          u.name AS name,
          m.role AS role
        FROM users u
        JOIN app_memberships m ON m.user = u.id
        JOIN apps a ON a.id IN (SELECT value FROM json_each(m.app))
        WHERE m.enabled = TRUE AND a.key = 'storage'
    """,
    "storage_report_box_fill": """
        SELECT
          b.id       AS id,
          b.title    AS title,
          b.location AS location,
          b.status   AS status,
          (SELECT COUNT(*) FROM storage_items i WHERE i.box = b.id) AS item_count,
          (SELECT COUNT(*) FROM storage_items i WHERE i.box = b.id
             AND i.images != '' AND i.images != '[]') AS photo_count
        FROM storage_boxes b
    """,
    "storage_report_tag_usage": """
        SELECT
          t.id    AS id,
          t.name  AS name,
          t.color AS color,
          (SELECT COUNT(*) FROM storage_boxes b
             WHERE EXISTS (SELECT 1 FROM json_each(b.tags) WHERE value = t.id)) AS box_count,
          (SELECT COUNT(*) FROM storage_items i
             WHERE EXISTS (SELECT 1 FROM json_each(i.tags) WHERE value = t.id)) AS item_count
        FROM storage_tags t
    """,
    "storage_report_growth": """
        SELECT
          m.month AS id,
          m.month AS month,
          (SELECT COUNT(*) FROM storage_boxes b
             WHERE strftime('%Y-%m', b.created) = m.month) AS boxes_created,
          (SELECT COUNT(*) FROM storage_items i
             WHERE strftime('%Y-%m', i.created) = m.month) AS items_created
        FROM (
          SELECT DISTINCT strftime('%Y-%m', created) AS month FROM storage_boxes
          UNION
          SELECT DISTINCT strftime('%Y-%m', created) AS month FROM storage_items
        ) m
        ORDER BY m.month
    """,
}


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


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    base = sys.argv[1].rstrip("/") + "/api"
    email = os.environ.get("PB_ADMIN_EMAIL", "dev@local.test")
    password = os.environ.get("PB_ADMIN_PASSWORD", "devpassword123")
    token = call(
        base,
        "/collections/_superusers/auth-with-password",
        data={"identity": email, "password": password},
    )["token"]

    existing = {c["name"] for c in call(base, "/collections?perPage=200", token)["items"]}
    for name, sql in VIEWS.items():
        query = " ".join(sql.split())
        if name in existing:
            call(base, f"/collections/{name}", token, method="DELETE")
        call(
            base,
            "/collections",
            token,
            {
                "name": name,
                "type": "view",
                "listRule": GATE,
                "viewRule": GATE,
                "viewQuery": query,
                "options": {"query": query},
            },
        )
        print(f"created view {name}")


if __name__ == "__main__":
    main()
