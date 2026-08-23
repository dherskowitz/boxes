"""Placeholder photos for the seeders, and the multipart encoder they need.

Shared by `pb-seed.py` (the e2e fixture) and `pb-demo-seed.py` (the big demo
set) so the two produce the same kind of image and there is one encoder to fix
when PocketBase changes its upload shape.

`make_photo` generates: the e2e fixture must work with no network and raise no
licensing questions. `real_photo` downloads an actual photograph for the demo
set, where the point is to look at real pictures — it caches to disk, so only
the first seed needs a connection, and returns None rather than failing when
there is none.

Deliberately small either way — the app compresses uploads client-side and this
path bypasses that, so keeping them modest keeps the seed fast and the offline
image cache realistic.
"""
import hashlib
import io
import os
import urllib.error
import urllib.request
from pathlib import Path

# Muted, distinguishable grounds. Indexed, not random: the same fixture record
# gets the same colour on every seed, which makes a screenshot diff meaningful.
TINTS = [
    (86, 122, 104),
    (150, 92, 88),
    (104, 96, 148),
    (156, 122, 74),
    (86, 116, 134),
    (140, 96, 128),
]


def tint_for(index: int) -> tuple[int, int, int]:
    return TINTS[index % len(TINTS)]


CACHE_DIR = Path(__file__).parent / ".photo-cache"

# Lorem Picsum serves Unsplash photography under a stable id per URL and needs
# no API key. Unsplash's own API would be a better subject match — it can search
# by keyword — but it wants a client id and rate-limits a demo app to 50 requests
# an hour, and one demo seed asks for over 200.
PICSUM_MAX_ID = 1084


def real_photo(key: str, w: int = 800, h: int = 600) -> bytes | None:
    """An actual photograph for `key`, or None when it cannot be fetched.

    The id is derived from `key`, so the same box gets the same picture on every
    seed and a screenshot diff stays meaningful. Cached under `.photo-cache/`:
    re-seeding pulls from disk, which is both faster than 200 round trips and
    what lets a second seed work with the network off.

    The pictures are not subject-matched — a box of winter coats may show a
    mountain. They are real photographs at real dimensions, which is what makes
    the thumbnails and the gallery worth looking at.
    """
    digest = int(hashlib.sha256(key.encode()).hexdigest(), 16)
    # Some ids in the range have been withdrawn and 404; try a few neighbours
    # before giving up rather than dropping the photo.
    for attempt in range(3):
        photo_id = (digest + attempt) % PICSUM_MAX_ID
        cached = CACHE_DIR / f"{photo_id}-{w}x{h}.jpg"
        if cached.exists():
            return cached.read_bytes()
        try:
            url = f"https://picsum.photos/id/{photo_id}/{w}/{h}"
            with urllib.request.urlopen(url, timeout=20) as response:
                blob = response.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                continue
            return None
        except (urllib.error.URLError, TimeoutError, OSError):
            return None
        CACHE_DIR.mkdir(exist_ok=True)
        cached.write_bytes(blob)
        return blob
    return None


def photo_for(key: str, label: str, index: int, real: bool = True) -> bytes:
    """The photo for one record: an actual photograph where one can be had, the
    generated placeholder otherwise.

    `key` identifies the record for caching and for picking a stable picture;
    `label` and `index` are only used by the fallback.
    """
    if real:
        blob = real_photo(key)
        if blob is not None:
            return blob
    return make_photo(label, tint_for(index))


def make_photo(label: str, tint: tuple[int, int, int]) -> bytes:
    """A labelled JPEG standing in for a real photo.

    Sized to survive the app's 100–200px thumbnails: the type is large enough
    that a card still tells you which record it belongs to after the image has
    been scaled down to a quarter of an inch. Small text looked fine at full
    size and turned to grey mush on the box index, which is where these are
    actually seen.
    """
    from PIL import Image, ImageDraw, ImageFont
    w, h = 800, 600
    img = Image.new("RGB", (w, h), tint)
    d = ImageDraw.Draw(img)

    # `size=` on the built-in font needs Pillow >= 10.1. Falling back rather
    # than failing: an ugly placeholder still beats a seeder that dies.
    try:
        title_font = ImageFont.load_default(size=64)
        caption_font = ImageFont.load_default(size=34)
    except TypeError:
        title_font = ImageFont.load_default()
        caption_font = title_font

    # A lighter panel so the label stays readable against any tint.
    d.rectangle([40, 186, w - 40, 428], fill=(247, 245, 240))

    words, lines, line = label.split(), [], ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if len(candidate) > 18 and line:
            lines.append(line)
            line = word
        else:
            line = candidate
        if len(lines) == 2:
            break
    if line and len(lines) < 3:
        lines.append(line)

    y = 215
    for text in lines[:2]:
        d.text((70, y), text, fill=(23, 28, 32), font=title_font)
        y += 74
    d.text((70, 370), "placeholder photo", fill=(120, 120, 120), font=caption_font)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=70)
    return buf.getvalue()


def multipart(fields: dict, files: list[tuple[str, str, bytes]]) -> tuple[bytes, str]:
    """Minimal multipart/form-data encoder — PocketBase file uploads cannot be JSON."""
    boundary = "----pbseed" + os.urandom(8).hex()
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
