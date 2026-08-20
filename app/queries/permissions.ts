import type { AppUser, StorageBox, StorageBoxPermission } from '~/types/pocketbase'
import { keys } from '~/queries/keys'

export function useBoxPermissions(boxId: Ref<string>) {
  const { $pb } = useNuxtApp()
  return useQuery({
    queryKey: computed(() => keys.permissions.byBox(boxId.value)),
    queryFn: () =>
      $pb.collection('storage_box_permissions').getList<StorageBoxPermission>(1, 200, {
        filter: $pb.filter('box = {:boxId}', { boxId: boxId.value })
      }),
    enabled: computed(() => boxId.value !== '')
  })
}

/**
 * Directory members who could still be granted editor rights on a box: not
 * the creator (who already has full rights and cannot be granted) and not
 * anyone who already holds a grant. Pure so it tests without `$pb`.
 *
 * `directory`/`permissions` still loading (`undefined`) yields an empty
 * list rather than the full directory — offering a grant before the
 * existing grants are known could offer someone already granted, which
 * would create a duplicate row.
 */
export function grantableUsers(
  directory: AppUser[] | undefined,
  permissions: StorageBoxPermission[] | undefined,
  creatorId: string
): AppUser[] {
  if (!directory || !permissions) return []
  // Any existing row counts as granted, whatever its `role` says. `role` is
  // not required, so a row can come back with `''` — invisible in the editors
  // list, and filtering on `role === 'editor'` here would offer that user
  // again and write a second row for the same user and box.
  const granted = new Set(permissions.map(p => p.user))
  return directory.filter(u => u.id !== creatorId && !granted.has(u.id))
}

/** Wires `grantableUsers` to the live directory and this box's permissions. */
export function useGrantableUsers(box: Ref<StorageBox | undefined>) {
  const boxId = computed(() => box.value?.id ?? '')
  const { data: directory } = useAppUsers()
  const { data: permissionsResult } = useBoxPermissions(boxId)
  return computed(() =>
    grantableUsers(directory.value, permissionsResult.value?.items, box.value?.created_by ?? '')
  )
}

/**
 * `storage_box_permissions` create rule gates on `box.created_by` (the box's
 * own owner field), not on any field of the permission record itself — so,
 * unlike boxes/items/comments, there is no ownership field to set here.
 */
export function useGrantEditor() {
  const { $pb } = useNuxtApp()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ boxId, userId }: { boxId: string, userId: string }) => {
      assertOnline()
      return $pb.collection('storage_box_permissions').create<StorageBoxPermission>({
        box: boxId,
        user: userId,
        role: 'editor'
      })
    },
    onSettled: (_data, _error, variables) =>
      queryClient.invalidateQueries({ queryKey: keys.permissions.byBox(variables.boxId) })
  })
}

export function useRevokeEditor() {
  const { $pb } = useNuxtApp()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: { id: string, boxId: string }) => {
      assertOnline()
      return $pb.collection('storage_box_permissions').delete(id)
    },
    onSettled: (_data, _error, variables) =>
      queryClient.invalidateQueries({ queryKey: keys.permissions.byBox(variables.boxId) })
  })
}
