import type { StorageBox } from '~/types/pocketbase'
import type { BoxListFilters } from '~/queries/keys'
import { keys } from '~/queries/keys'

export const PER_PAGE = 30

/** Build a PocketBase filter string from list filters. Exported for testing. */
export function boxFilter(filters: BoxListFilters): string {
  const clauses = [`status = "${filters.status ?? 'active'}"`]
  for (const tagId of filters.tagIds ?? []) {
    clauses.push(`tags ~ "${tagId}"`)
  }
  if (filters.search) {
    const term = filters.search.replace(/"/g, '')
    clauses.push(`(title ~ "${term}" || description ~ "${term}" || location ~ "${term}")`)
  }
  return clauses.join(' && ')
}

export function useBoxList(filters: Ref<BoxListFilters>) {
  const { $pb } = useNuxtApp()
  return useQuery({
    queryKey: computed(() => keys.boxes.list(filters.value)),
    queryFn: () =>
      $pb.collection('storage_boxes').getList<StorageBox>(filters.value.page ?? 1, PER_PAGE, {
        filter: boxFilter(filters.value),
        expand: 'tags',
        sort: '-created'
      })
  })
}

export function useBoxByQrId(qrId: Ref<string>) {
  const { $pb } = useNuxtApp()
  return useQuery({
    queryKey: computed(() => keys.boxes.byQrId(qrId.value)),
    queryFn: () =>
      $pb
        .collection('storage_boxes')
        .getFirstListItem<StorageBox>(`qr_id = "${qrId.value}"`, { expand: 'tags' }),
    enabled: computed(() => qrId.value !== ''),
    retry: false
  })
}
