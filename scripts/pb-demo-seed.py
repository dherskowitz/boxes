#!/usr/bin/env python3
"""Seed a realistic demo dataset: ~40 boxes, ~400 items, with photos.

This is NOT the test fixture. `scripts/pb-seed.py` produces the small, exact
dataset the e2e suite asserts against (5 boxes / 9 items / 5 tags / 2 comments /
1 permission row); running this instead will fail roughly 93 e2e tests until you
re-run that one. Use this to actually *look* at the app — pagination past 30 per
page, the reports charts with enough data to mean something, tag filters with
real overlap, search that returns more than one hit.

Best used against its own instance so it cannot disturb the test fixture:

    PB_PORT=8099 docker compose -p storage-demo up -d
    python3 scripts/pb-demo-seed.py http://localhost:8099

Local only, and idempotent — it wipes what it owns, then rebuilds.

Usage: python3 scripts/pb-demo-seed.py <url> [--no-photos] [--backdate]
"""
import io
import json
import os
import random
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

PASSWORD = "storagedev123"
SEED = 1337

# Same four accounts as the test fixture, so the credentials in CLAUDE.md and
# docs/testing-offline.md stay correct, plus two more so comment threads have
# more than two voices.
USERS = [
    ("dana@local.test", "Dana Herskowitz", "owner"),
    ("sam@local.test", "Sam Okafor", "member"),
    ("rae@local.test", "Rae Lindqvist", "member"),
    ("priya@local.test", "Priya Raghunathan", "member"),
    ("marcus@local.test", "Marcus Boateng", "admin"),
    ("nobody@local.test", "Jo Nakamura", None),  # no membership: access-denied case
]

TAGS = [
    ("fragile", "#dc2626"), ("winter", "#2563eb"), ("summer", "#0ea5e9"),
    ("kitchen", "#16a34a"), ("paperwork", "#ca8a04"), ("sentimental", "#9333ea"),
    ("tools", "#78716c"), ("kids", "#ec4899"), ("outgrown", "#f97316"),
    ("electronics", "#0891b2"), ("books", "#7c3aed"), ("camping", "#65a30d"),
    ("donate", "#e11d48"), ("archive", "#475569"),
]

# (box title, location, tags, item pool). Titles and contents are the kind of
# thing that actually ends up in a storage box — long ones included, because a
# 90-character title is what breaks a chart axis or a card layout.
CATEGORIES = [
    ("Winter coats and boots", "Garage shelf A3", ["winter"], [
        "Navy wool peacoat", "Sorel snow boots", "Box of wool scarves",
        "Down jacket, packed", "Thermal base layers", "Sheepskin mittens",
        "Waterproof overtrousers", "Fur-lined ushanka", "Quilted gilet",
        "Ski socks, six pairs", "Balaclava and neck gaiter", "Snow chains, boxed",
        "Hot water bottles", "Wellington boots, green", "Tweed overcoat"]),
    ("Kitchen overflow: the bread machine, the stand mixer bowl we never use, and assorted baking tins",
     "Basement under the stairs", ["kitchen", "fragile"], [
        "Panasonic bread machine", "Springform tins, set of 3", "Stand mixer bowl",
        "Copper jelly moulds", "Pasta roller, boxed", "Fondue set, unopened",
        "Cast iron griddle", "Mandoline slicer", "Preserving jars, dozen",
        "Cake stand, glass", "Ramekins, set of eight", "Pressure cooker",
        "Ice cream maker", "Roasting tins, nested", "Pudding basins"]),
    ("Tax records", "Office closet, top shelf", ["paperwork", "archive"], [
        "Returns and receipts", "Bank statements, bound", "Mortgage paperwork",
        "P60s and payslips", "Insurance schedules", "Vehicle logbooks",
        "Utility bills, filed", "Pension statements", "Solicitor correspondence",
        "Warranty booklets", "Council tax notices", "Share certificates",
        "Old passports", "Medical letters"]),
    ("Camping gear", "Garage shelf B2", ["camping", "summer"], [
        "Two-person tent", "Sleeping bags, pair", "Trangia stove",
        "Inflatable roll mats", "Head torches and spares", "Folding camp chairs",
        "Cool box, 25L", "Guy lines and pegs", "Camping kettle",
        "Windbreak, striped", "Water carrier, 10L", "Mess tins",
        "Groundsheet, folded", "Gas canisters, spare", "Compass and whistle"]),
    ("Holiday decorations", "Attic, by the water tank", ["seasonal", "fragile"], [
        "Glass baubles, boxed", "String lights, warm white", "Ceramic nativity set",
        "Wreath, artificial", "Tinsel and garlands", "Advent candle holder",
        "Tree stand, cast iron", "Stockings, embroidered", "Table crackers",
        "Wooden nutcracker", "Fairy lights, spare bulbs", "Paper chains",
        "Star for the tree top", "Snow globe"]),
    ("Hand tools and fixings", "Garage workbench", ["tools"], [
        "Socket set, metric", "Cordless drill and bits", "Spirit level, 1200mm",
        "Assorted screws, jars", "Hacksaw and blades", "Wallpaper stripper",
        "Tile cutter", "Clamps, four", "Chisels, boxed set",
        "Plumb line", "Wire strippers", "Junior hacksaw",
        "Sanding blocks", "Masonry bits", "Torque wrench"]),
    ("Paperbacks", "Basement, back wall", ["books"], [
        "Le Carré, boxed set", "Cookbooks, Italian", "Ordnance Survey maps",
        "Childhood annuals", "Reference dictionaries", "Poetry anthologies",
        "Travel guides, Europe", "Gardening manuals", "Atlases, two",
        "Crossword compendiums", "Art monographs", "Sheet music, bound",
        "Field guides, birds", "Language phrasebooks"]),
    ("College photo albums", "Attic", ["sentimental", "fragile"], [
        "Graduation album 2011", "Interrail negatives", "Polaroids, loose",
        "Yearbooks", "Letters, bundled", "Concert ticket stubs",
        "Disposable camera films", "Rowing club photos", "Postcards, shoebox",
        "Sketchbooks", "Diaries, three years", "Wedding invitations",
        "Baby photographs", "School reports"]),
    ("Baby gear", "Loft hatch", ["kids", "outgrown"], [
        "Moses basket", "Bottle steriliser", "Baby monitor, boxed",
        "Sling and wrap", "Bouncer chair", "Muslins, bagged",
        "Changing mat", "Breast pump, boxed", "Play gym arch",
        "Stair gate", "Highchair cushion", "Bottle warmer",
        "Pram rain cover", "Teething toys"]),
    ("Kids clothes, age 2-4", "Loft hatch", ["kids", "outgrown", "donate"], [
        "Snowsuit, 3T", "Wellies, size 8", "Party dresses",
        "Dungarees, bundle", "Swim nappies", "Sun hats",
        "School jumpers", "Pyjamas, winter", "Fleece jackets",
        "Sandals, size 7", "Vests, multipack", "Woollen tights",
        "Dressing gown", "Costume, dinosaur"]),
    ("Sports equipment", "Garage, hooks", ["summer"], [
        "Tennis rackets, pair", "Football boots", "Yoga mats",
        "Swimming goggles", "Cricket bat", "Badminton set",
        "Bike helmets, two", "Shin pads", "Skipping ropes",
        "Rounders set", "Hand weights, 3kg", "Snorkel and fins",
        "Table tennis bats", "Frisbees"]),
    ("Spare linens", "Airing cupboard", [], [
        "Double duvet, 10.5 tog", "Guest towels, unopened", "Fitted sheets, king",
        "Wool blankets", "Pillow protectors", "Tablecloths, linen",
        "Napkins, set of twelve", "Beach towels", "Mattress topper",
        "Cot bedding", "Throws, knitted", "Tea towels, bundle",
        "Curtain liners", "Cushion covers"]),
    ("Cables and adapters", "Office closet", ["electronics"], [
        "HDMI cables, assorted", "Laptop chargers, old", "USB hubs",
        "Ethernet, 5m", "Travel adapters", "Phone cases, boxed",
        "External hard drives", "Router, previous", "Extension leads",
        "Card readers", "Headphones, wired", "Webcam, boxed",
        "Battery chargers", "Cassette adapter"]),
    ("Craft supplies", "Spare room wardrobe", [], [
        "Wool, mixed weights", "Fabric offcuts", "Knitting needles",
        "Embroidery hoops", "Fat quarters, bundled", "Sewing patterns",
        "Buttons, tin of", "Zips, assorted", "Quilting rulers",
        "Bias binding", "Crochet hooks", "Pinking shears",
        "Interfacing, roll", "Bobbins and thread"]),
    ("Bathroom spares", "Under the stairs", [], [
        "Tiles, spare box", "Shower hose", "Toilet seat, boxed",
        "Grout and sealant", "Towel rail, unfitted", "Extractor fan cover",
        "Bath panel, spare", "Taps, chrome pair", "Shower curtain, unopened",
        "Radiator valves", "Silicone gun", "Mirror clips",
        "Waste trap", "Sink plug chains"]),
]

NOTE_POOL = [
    "Dry clean before wearing", "Replacement paddle is about £12 online",
    "One warped in the oven", "Shred after April 2027", "Still within audit window",
    "Left toe is scuffed", "Missing the manual", "Needs new batteries",
    "Handle is cracked — wrap it", "Loaned to the neighbours once, got it back",
    "Bought for the Cornwall trip", "Check it still fits before keeping",
    "", "", "",  # plenty of items have no notes
]

COMMENT_POOL = [
    "Is this the one with the missing button?",
    "No, I had that one repaired last spring.",
    "Can we move this to the loft? Shelf is sagging.",
    "Photographed before we packed it.",
    "Pretty sure there's a second one of these somewhere.",
    "Donate pile if it doesn't fit next winter.",
    "Fragile — do not stack anything on this box.",
    "Found the receipt, it's still under warranty.",
]


def call(base, path, token=None, data=None, method=None, body=None, headers=None):
    payload = body if body is not None else (json.dumps(data).encode() if data is not None else None)
    req = urllib.request.Request(base + path, data=payload,
                                 method=method or ("POST" if payload else "GET"))
    if body is None and data is not None:
        req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    if token:
        req.add_header("Authorization", token)
    try:
        raw = urllib.request.urlopen(req).read()
        return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"{method or 'POST'} {path} failed with {exc.code}: "
                         f"{exc.read().decode(errors='replace')[:400]}") from exc


def wipe(base, token, collection, filter_expr=None):
    """Delete every record, or those matching a filter, a page at a time."""
    while True:
        q = f"/collections/{collection}/records?perPage=200"
        if filter_expr:
            q += "&filter=" + urllib.parse.quote(filter_expr)
        page = call(base, q, token)
        if not page.get("items"):
            return
        for record in page["items"]:
            call(base, f"/collections/{collection}/records/{record['id']}", token, method="DELETE")


def make_photo(label: str, tint: tuple[int, int, int]) -> bytes:
    """A small labelled JPEG standing in for a real photo.

    Generated rather than downloaded so the seeder needs no network and raises
    no licensing questions. Deliberately small — the app compresses uploads
    client-side and this path bypasses that, so keeping them modest here keeps
    the seed fast and the offline image cache realistic.
    """
    from PIL import Image, ImageDraw
    w, h = 800, 600
    img = Image.new("RGB", (w, h), tint)
    d = ImageDraw.Draw(img)
    # A lighter panel so the label stays readable against any tint.
    d.rectangle([40, h // 2 - 70, w - 40, h // 2 + 70], fill=(247, 245, 240))
    text = label if len(label) <= 42 else label[:39] + "..."
    d.text((60, h // 2 - 10), text, fill=(23, 28, 32))
    d.text((60, h // 2 + 20), "demo photo", fill=(120, 120, 120))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=70)
    return buf.getvalue()


def multipart(fields: dict, files: list[tuple[str, str, bytes]]) -> tuple[bytes, str]:
    """Minimal multipart/form-data encoder — PocketBase file uploads cannot be JSON."""
    boundary = "----pbdemo" + os.urandom(8).hex()
    out = io.BytesIO()
    for key, value in fields.items():
        for v in (value if isinstance(value, list) else [value]):
            out.write(f"--{boundary}\r\n".encode())
            out.write(f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode())
            out.write(f"{v}\r\n".encode())
    for key, filename, blob in files:
        out.write(f"--{boundary}\r\n".encode())
        out.write(f'Content-Disposition: form-data; name="{key}"; filename="{filename}"\r\n'.encode())
        out.write(b"Content-Type: image/jpeg\r\n\r\n")
        out.write(blob)
        out.write(b"\r\n")
    out.write(f"--{boundary}--\r\n".encode())
    return out.getvalue(), f"multipart/form-data; boundary={boundary}"


def backdate(project: str, months: int) -> None:
    """Spread `created` over the past N months by editing SQLite directly.

    PocketBase's `created` is an autodate: the API silently ignores any value
    you send (verified — it overwrites with its own timestamp). Without this,
    every record shares one creation date and the reports growth chart shows
    "not enough history yet" forever, which is exactly the case a demo dataset
    exists to exercise.

    So this stops the container, edits data.db on a copy, and puts it back.
    Only ever run against a local throwaway instance. Opt-in for that reason.
    """
    import sqlite3
    import tempfile
    tmp = tempfile.mkdtemp()
    local = os.path.join(tmp, "data.db")
    container = subprocess.run(
        ["docker", "compose", "-p", project, "ps", "-q", "pocketbase"],
        capture_output=True, text=True, check=True).stdout.strip()
    if not container:
        raise SystemExit(f"--backdate: no running container for compose project '{project}'")

    subprocess.run(["docker", "compose", "-p", project, "stop"], check=True,
                   capture_output=True)
    subprocess.run(["docker", "cp", f"{container}:/pb_data/data.db", local], check=True,
                   capture_output=True)

    con = sqlite3.connect(local)
    now = datetime.now(timezone.utc)
    rng = random.Random(SEED)
    for table in ("storage_boxes", "storage_items", "storage_comments"):
        rows = [r[0] for r in con.execute(f"SELECT id FROM {table}")]
        for rid in rows:
            when = now - timedelta(days=rng.randint(0, months * 30), hours=rng.randint(0, 23))
            stamp = when.strftime("%Y-%m-%d %H:%M:%S.") + f"{when.microsecond // 1000:03d}Z"
            con.execute(f"UPDATE {table} SET created = ? WHERE id = ?", (stamp, rid))
    con.commit()
    con.close()

    subprocess.run(["docker", "cp", local, f"{container}:/pb_data/data.db"], check=True,
                   capture_output=True)
    subprocess.run(["docker", "compose", "-p", project, "start"], check=True,
                   capture_output=True)
    print(f"  back-dated boxes, items and comments across the last {months} months")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    if len(args) != 1:
        raise SystemExit(__doc__)
    root = args[0].rstrip("/")
    if urllib.parse.urlparse(root).hostname not in ("localhost", "127.0.0.1"):
        raise SystemExit(f"refusing to seed a non-local instance: {root}")

    photos = "--no-photos" not in flags
    base = root + "/api"
    rng = random.Random(SEED)

    token = call(base, "/collections/_superusers/auth-with-password", data={
        "identity": os.environ.get("PB_ADMIN_EMAIL", "dev@local.test"),
        "password": os.environ.get("PB_ADMIN_PASSWORD", "devpassword123"),
    })["token"]

    # Resolve the accounts we own before deleting anything, so the memberships
    # wipe stays scoped to them and never touches another app's rows on a
    # shared instance (see CLAUDE.md).
    local_users = [u for u in call(base, "/collections/users/records?perPage=200", token)["items"]
                   if u["email"].endswith("@local.test")]
    for collection in ("storage_comments", "storage_box_permissions",
                       "storage_items", "storage_boxes", "storage_tags"):
        wipe(base, token, collection)
    if local_users:
        wipe(base, token, "app_memberships",
             " || ".join(f'user = "{u["id"]}"' for u in local_users))
    for u in local_users:
        call(base, f"/collections/users/records/{u['id']}", token, method="DELETE")

    app_id = call(base, "/collections/apps/records", token)["items"][0]["id"]

    users = {}
    for email, name, role in USERS:
        rec = call(base, "/collections/users/records", token, {
            "email": email, "password": PASSWORD, "passwordConfirm": PASSWORD,
            "name": name, "verified": True})
        users[email] = rec["id"]
        if role:
            call(base, "/collections/app_memberships/records", token,
                 {"user": rec["id"], "app": [app_id], "role": role, "enabled": True})
    members = [users[e] for e, _, r in USERS if r]
    print(f"  {len(USERS)} users")

    tags = {}
    for name, colour in TAGS:
        tags[name] = call(base, "/collections/storage_tags/records", token,
                          {"name": name, "color": colour,
                           "created_by": users["dana@local.test"]})["id"]
    print(f"  {len(TAGS)} tags")

    boxes, items_made, photos_made, comments_made = [], 0, 0, 0
    qr_seen = set()
    # Roughly three boxes per category, so titles repeat with a distinguishing
    # suffix the way a real collection does ("Kids clothes, age 2-4", box 2 of 3).
    plan = [(c, n) for c in CATEGORIES for n in range(1, 4)][:40]

    for index, (cat, part) in enumerate(plan):
        title, location, tag_names, pool = cat
        label = title if part == 1 else f"{title} ({part} of 3)"
        while True:
            qr = "".join(rng.choice("abcdefghijklmnopqrstuvwxyz0123456789") for _ in range(8))
            if qr not in qr_seen:
                qr_seen.add(qr)
                break
        # A tenth archived, and one box left deliberately empty so the empty
        # state is reachable without contriving it.
        status = "archived" if index % 10 == 9 else "active"
        creator = rng.choice(members)
        fields = {
            "title": label, "location": location, "status": status,
            "qr_id": qr, "created_by": creator,
            "description": "",
            "tags": [tags[t] for t in tag_names if t in tags],
        }
        files = []
        if photos and index % 3 != 2:
            tint = (rng.randint(30, 90), rng.randint(40, 100), rng.randint(50, 110))
            files.append(("images", f"{qr}-cover.jpg", make_photo(label, tint)))
            photos_made += 1
        body, ctype = multipart(fields, files)
        box = call(base, "/collections/storage_boxes/records", token,
                   body=body, headers={"Content-Type": ctype})
        boxes.append(box)

        empty = index == 7  # one box with nothing in it
        # Six to fourteen per box, which is what a real storage box holds and
        # gets the collection to a scale where pagination and the charts mean
        # something. Sampled without replacement, so no box lists the same
        # thing twice.
        for item_name in ([] if empty else rng.sample(pool, min(len(pool), rng.randint(6, 14)))):
            item_fields = {
                "box": box["id"], "title": item_name,
                "description": "", "notes": rng.choice(NOTE_POOL),
                "created_by": creator,
                "tags": [tags[t] for t in rng.sample(tag_names, len(tag_names))
                         if t in tags] if tag_names else [],
            }
            item_files = []
            if photos and rng.random() < 0.4:
                tint = (rng.randint(40, 120), rng.randint(40, 120), rng.randint(40, 120))
                item_files.append(("images", "item.jpg", make_photo(item_name, tint)))
                photos_made += 1
            ibody, ictype = multipart(item_fields, item_files)
            item = call(base, "/collections/storage_items/records", token,
                        body=ibody, headers={"Content-Type": ictype})
            items_made += 1

            if rng.random() < 0.12:
                for text in rng.sample(COMMENT_POOL, rng.randint(1, 3)):
                    call(base, "/collections/storage_comments/records", token,
                         {"item": item["id"], "user": rng.choice(members), "text": text})
                    comments_made += 1

        if index % 10 == 0:
            print(f"  ... {index + 1}/{len(plan)} boxes")

    # A handful of editor grants so the sharing screen has something to show and
    # the permission matrix is explorable without setting it up by hand.
    grants = 0
    for box in rng.sample(boxes, 8):
        candidate = rng.choice([m for m in members if m != box["created_by"]])
        call(base, "/collections/storage_box_permissions/records", token,
             {"box": box["id"], "user": candidate, "role": "editor"})
        grants += 1

    print(f"  {len(boxes)} boxes, {items_made} items, {comments_made} comments, "
          f"{grants} editor grants, {photos_made} photos")

    if "--backdate" in flags:
        project = os.environ.get("COMPOSE_PROJECT", "storage-app")
        backdate(project, months=18)

    print(f"\nseeded. all passwords: {PASSWORD}")
    print("note: this is NOT the e2e fixture — run scripts/pb-seed.py before `pnpm test:e2e`.")


if __name__ == "__main__":
    main()
