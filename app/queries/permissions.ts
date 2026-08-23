import type { StorageBoxPermission } from '~/types/pocketbase'
import { keys } from '~/queries/keys'

/**
 * Editor grants on one box.
 *
 * The app no longer has a screen for handing these out — per-box sharing was
 * removed, because every member of the app can already read every box and the
 * only thing a grant bought was edit rights inside one household.
 *
 * The read stays. `storage_box_permissions` is still in the schema and its API
 * rules still honour a grant, so a row created before the share screen went
 * (or by an admin in the PocketBase UI) still lets that user edit the box.
 * `useCanEdit()` has to agree with the server about that, or it hides an Edit
 * button from someone the API would happily let through.
 */
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
