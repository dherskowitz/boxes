import type { StorageBox } from '~/types/pocketbase'
import type { BoxListFilters, PbFilter } from '~/queries/keys'
import { keys, PER_PAGE, tagClauses } from '~/queries/keys'

/**
 * Build a PocketBase filter template from list filters, for use with
 * `$pb.filter(raw, params)`. Exported for testing.
 *
 * Values are never interpolated directly into the filter string — that would
 * let a search term or tag id break out of its quotes and rewrite the query
 * (see the qr_id deep-link path in boxes.ts history). `$pb.filter` binds
 * `params` by placeholder and escapes them itself.
 */
export function boxFilter(filters: BoxListFilters): PbFilter {
  const tags = tagClauses(filters.tagIds)
  const params: Record<string, unknown> = { status: filters.status ?? 'active', ...tags.params }
  const clauses = ['status = {:status}', ...tags.clauses]
  if (filters.search) {
    params.search = filters.search
    clauses.push('(title ~ {:search} || description ~ {:search} || location ~ {:search})')
  }
  return { raw: clauses.join(' && '), params }
}

export function useBoxList(filters: Ref<BoxListFilters>) {
  const { $pb } = useNuxtApp()
  return useQuery({
    queryKey: computed(() => keys.boxes.list(filters.value)),
    queryFn: () => {
      const { raw, params } = boxFilter(filters.value)
      return $pb.collection('storage_boxes').getList<StorageBox>(filters.value.page ?? 1, PER_PAGE, {
        filter: $pb.filter(raw, params),
        expand: 'tags',
        sort: '-created'
      })
    }
  })
}

export function useBoxByQrId(qrId: Ref<string>) {
  const { $pb } = useNuxtApp()
  return useQuery({
    queryKey: computed(() => keys.boxes.byQrId(qrId.value)),
    queryFn: () =>
      $pb
        .collection('storage_boxes')
        .getFirstListItem<StorageBox>($pb.filter('qr_id = {:qrId}', { qrId: qrId.value }), {
          expand: 'tags'
        }),
    enabled: computed(() => qrId.value !== ''),
    retry: false
  })
}
