# PocketBase Schema — Storage Boxes App

This app runs on an existing multi-app PocketBase instance. It reuses the shared `apps` and `app_memberships` collections for auth/access gating and adds five new collections, all prefixed `storage_`.

## Existing Shared Collections (do not create — already exist)

### `apps`
| Field | Type |
|---|---|
| `key` | Text |
| `name` | Text |
| `subdomain` | Text |
| `active` | Bool |
| `description` | Editor |

### `app_memberships`
| Field | Type |
|---|---|
| `user` | Relation → users (Single) |
| `app` | Relation → apps (Multiple) |
| `role` | Select: owner / admin / member / reader (Single) |
| `enabled` | Bool |

**Setup step:** add a row to `apps` with `key = "storage"` and `active = true` before building anything else.

---

## New Collections

### 1. `storage_boxes`

| Field | Type | Options |
|---|---|---|
| `title` | Text | not required |
| `description` | Text or Editor | not required |
| `location` | Text | not required — e.g. "Garage shelf A3" |
| `images` | File | Multiple, image mime types only, max ~10 files |
| `qr_id` | Text | **Required, Unique** — short code embedded in the printed QR |
| `status` | Select | Single: `active`, `archived` — default `active` |
| `tags` | Relation → storage_tags | Multiple, not required |
| `created_by` | Relation → users | Single, required |

`created` / `updated` are automatic PocketBase fields — no need to add manually.

**API Rules:**

List/View:
```
@request.auth.id != "" &&
@request.auth.app_memberships_via_user.app.key ?= "storage" &&
@request.auth.app_memberships_via_user.enabled ?= true
```

Create: same as List/View rule.

Update/Delete:
```
@request.auth.id != "" &&
@request.auth.app_memberships_via_user.app.key ?= "storage" &&
@request.auth.app_memberships_via_user.enabled ?= true &&
(
  created_by = @request.auth.id ||
  (@request.auth.storage_box_permissions_via_user.box ?= id &&
   @request.auth.storage_box_permissions_via_user.role ?= "editor")
)
```

---

### 2. `storage_items`

| Field | Type | Options |
|---|---|---|
| `box` | Relation → storage_boxes | Single, required |
| `title` | Text | required |
| `description` | Text | not required |
| `notes` | Text or Editor | not required |
| `images` | File | Multiple, image mime types only |
| `tags` | Relation → storage_tags | Multiple, not required |
| `created_by` | Relation → users | Single, required |

**API Rules:**

List/View, Create: same base membership check as `storage_boxes`.

Update/Delete:
```
@request.auth.id != "" &&
@request.auth.app_memberships_via_user.app.key ?= "storage" &&
@request.auth.app_memberships_via_user.enabled ?= true &&
(
  box.created_by = @request.auth.id ||
  (@request.auth.storage_box_permissions_via_user.box ?= box.id &&
   @request.auth.storage_box_permissions_via_user.role ?= "editor")
)
```

---

### 3. `storage_comments`

| Field | Type | Options |
|---|---|---|
| `item` | Relation → storage_items | Single, required |
| `user` | Relation → users | Single, required |
| `text` | Text | required |

**API Rules:**

List/View, Create: base membership check (same pattern as above).

Update/Delete: base membership check **and** `user = @request.auth.id` (only the comment's author can edit/delete it).

---

### 4. `storage_tags`

Shared, curated tag list used by both `storage_boxes` and `storage_items`. Any tag can be applied to a box, an item, or both — it's a single flat namespace, not separate lists per entity type.

| Field | Type | Options |
|---|---|---|
| `name` | Text | **Required, Unique** |
| `color` | Text | not required — optional hex code for UI chip color |
| `created_by` | Relation → users | Single, required |

**API Rules:**

List/View: base membership check (needed so create/edit forms can autocomplete existing tags).

Create: base membership check (any enabled member can add a new tag — this is a small trusted shared group, so tag creation isn't gated further).

Update/Delete: base membership check. Any enabled member can rename or remove a tag (per "curated shared list" requirement — renaming updates the tag for every box/item using it). **Open question:** consider restricting delete/rename to `app_memberships.role` of `admin`/`owner` if tag-list drift becomes a problem in practice; not required for v1.

---

### 5. `storage_item_voice_notes` (v2 — not built in v1, schema included for forward planning)

Multiple voice recordings per item, like a running audio log (not a single note per item).

| Field | Type | Options |
|---|---|---|
| `item` | Relation → storage_items | Single, required |
| `audio` | File | Single, audio mime types only (e.g. `audio/webm`, `audio/mp4`) |
| `label` | Text | not required — optional short caption |
| `created_by` | Relation → users | Single, required |

**API Rules (planned):**

List/View, Create: base membership check.

Update/Delete: base membership check **and** `created_by = @request.auth.id` (same pattern as comments — only the recorder can remove their own note).

---

### 6. `storage_box_permissions`

Sparse override table — an entry only needs to exist for a user granted **editor** rights on a specific box. Any enabled app member can view any box by default; this table only grants edit access beyond the box's creator.

| Field | Type | Options |
|---|---|---|
| `box` | Relation → storage_boxes | Single, required |
| `user` | Relation → users | Single, required |
| `role` | Select | Single: `editor` (room to extend later) |

**API Rules:**

List/View: base membership check (needed so a "manage sharing" UI can display current editors).

Create/Update/Delete:
```
@request.auth.id != "" &&
@request.auth.app_memberships_via_user.app.key ?= "storage" &&
@request.auth.app_memberships_via_user.enabled ?= true &&
box.created_by = @request.auth.id
```
Only the box's creator can grant or revoke editor access.

---

## Build/Verify Order

1. Add `storage` row to `apps`.
2. Create `storage_tags` (no dependencies on other new collections).
3. Create `storage_boxes`, `storage_items`, `storage_comments`, referencing `storage_tags` for the `tags` fields (rules referencing `storage_box_permissions` will fail validation until step 4 exists — that's expected).
4. Create `storage_box_permissions`.
5. Go back to `storage_boxes` and `storage_items` and confirm the `storage_box_permissions_via_user` back-relation resolves in the PocketBase admin UI's rule tester.
6. Test every rule (List/View, Create, Update, Delete) in the rule tester with a real user ID before writing any frontend code against it.
7. `storage_item_voice_notes` is v2 — create it when that feature is actually built, not as part of v1 setup.

## Known Uncertainty

Back-relation field names (e.g. `app_memberships_via_user`, `storage_box_permissions_via_user`) are auto-generated by PocketBase based on the exact name given to the relation field. Verify the generated name in your instance — if it differs from what's written above, update the rules to match.
