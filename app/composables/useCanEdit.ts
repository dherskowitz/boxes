import type { StorageBox, StorageBoxPermission, StorageComment } from '~/types/pocketbase'

/*
 * Permission predicates, derived from the API rules in
 * `pb_migrations/1787154450_storage_schema.js`:
 *
 * | operation                              | who                                    |
 * |----------------------------------------|----------------------------------------|
 * | box update                             | creator, or an `editor` grant on it    |
 * | box delete                             | creator only                           |
 * | item create / update / delete          | box creator, or an `editor` grant      |
 * | comment update / delete                | its author only                        |
 * | box permission create/update/delete    | box creator only                       |
 *
 * These are UX gates: they decide whether to render a control. The API rules
 * are the real guard — never treat a `true` here as authorisation.
 *
 * Every predicate is pure and fails closed: no user id, no record, or
 * permissions not loaded yet all mean `false`, so controls never flash for
 * someone who cannot use them.
 */

function hasEditorGrant(
  boxId: string,
  userId: string,
  permissions: StorageBoxPermission[] | undefined
): boolean {
  return (permissions ?? []).some(
    p => p.box === boxId && p.user === userId && p.role === 'editor'
  )
}

/** Box update: the creator, or a member holding an `editor` grant on that box. */
export function canEditBox(
  box: StorageBox | undefined,
  userId: string,
  permissions: StorageBoxPermission[] | undefined
): boolean {
  if (!box || !userId) return false
  return box.created_by === userId || hasEditorGrant(box.id, userId, permissions)
}

/** Box delete: the creator only — an `editor` grant does not extend to delete. */
export function canDeleteBox(box: StorageBox | undefined, userId: string): boolean {
  if (!box || !userId) return false
  return box.created_by === userId
}

/**
 * Item create/update/delete rights are exactly its box's edit rights — the
 * item's own `created_by` is not consulted by any rule.
 */
export const canEditItem = canEditBox

/** Comment update/delete: its author only. */
export function canEditComment(comment: StorageComment | undefined, userId: string): boolean {
  if (!comment || !userId) return false
  return comment.user === userId
}

/**
 * Edit/delete gates for one box and its items.
 *
 * Calls `useBoxPermissions()`, so it must run inside a component `setup()`.
 * Both refs are `false` until the box and its permissions have loaded.
 */
export function useCanEdit(box: Ref<StorageBox | undefined>) {
  const { userId } = useAuthUser()
  const boxId = computed(() => box.value?.id ?? '')
  const { data } = useBoxPermissions(boxId)
  // useBoxPermissions wraps getList, so the payload is a paginated result
  const permissions = computed(() => data.value?.items)

  return {
    canEdit: computed(() => canEditBox(box.value, userId.value, permissions.value)),
    canDelete: computed(() => canDeleteBox(box.value, userId.value))
  }
}
