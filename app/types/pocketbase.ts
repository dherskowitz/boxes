export type BoxStatus = 'active' | 'archived'
export type MemberRole = 'owner' | 'admin' | 'member' | 'readonly'

interface RecordBase {
  id: string
  created: string
  updated: string
}

export interface StorageTag extends RecordBase {
  name: string
  /** Optional hex code, `''` when unset. */
  color: string
  created_by: string
}

export interface StorageBox extends RecordBase {
  title: string
  /** `editor` field in PocketBase — stores an HTML string. */
  description: string
  location: string
  /** Filenames, max 15. Resolve to URLs with `pb.files.getURL()`. */
  images: string[]
  qr_id: string
  /** No default in the schema — always send `'active'` on create. */
  status: BoxStatus
  tags: string[]
  created_by: string
  expand?: {
    tags?: StorageTag[]
  }
}

export interface StorageItem extends RecordBase {
  box: string
  title: string
  /** `editor` field in PocketBase — stores an HTML string. */
  description: string
  /** `editor` field in PocketBase — stores an HTML string. */
  notes: string
  /** Filenames, max 99. */
  images: string[]
  tags: string[]
  created_by: string
  expand?: {
    tags?: StorageTag[]
    box?: StorageBox
  }
}

export interface StorageComment extends RecordBase {
  item: string
  user: string
  text: string
}

export interface StorageBoxPermission extends RecordBase {
  box: string
  user: string
  role: 'editor'
}

/**
 * A row of the `storage_app_users` view: every enabled member of this app.
 *
 * The `users` collection is only readable by the authed user themselves, so
 * `?expand=created_by` and `?expand=user` always come back empty. This view is
 * the only way to resolve a user id to a display name.
 */
export interface AppUser {
  id: string
  name: string
  role: MemberRole
}

export interface ReportBoxFill {
  id: string
  title: string
  location: string
  status: BoxStatus
  item_count: number
  photo_count: number
}

export interface ReportTagUsage {
  id: string
  name: string
  color: string
  box_count: number
  item_count: number
}

export interface ReportGrowth {
  id: string
  /** `YYYY-MM`. */
  month: string
  boxes_created: number
  items_created: number
}
