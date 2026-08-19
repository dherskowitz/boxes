import type { StorageBoxPermission } from '~/types/pocketbase'
import { keys } from '~/queries/keys'

export function useBoxPermissions(boxId: Ref<string>) {
  const { $pb } = useNuxtApp()
  return useQuery({
    queryKey: computed(() => keys.permissions.byBox(boxId.value)),
    queryFn: () =>
      $pb.collection('storage_box_permissions').getList<StorageBoxPermission>(1, 200, {
        filter: `box = "${boxId.value}"`
      }),
    enabled: computed(() => boxId.value !== '')
  })
}
