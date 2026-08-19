import type { StorageItem } from '~/types/pocketbase'
import type { ItemListFilters, PbFilter } from '~/queries/keys'
import { keys, PER_PAGE, tagClauses } from '~/queries/keys'

/**
 * Build the item list filter template, for use with `$pb.filter(raw, params)`.
 * Exported for testing. Tag ids are bound as placeholders, never interpolated
 * — see the note on `boxFilter`.
 */
export function itemFilter(filters: ItemListFilters): PbFilter {
  const tags = tagClauses(filters.tagIds)
  return {
    raw: ['box = {:boxId}', ...tags.clauses].join(' && '),
    params: { boxId: filters.boxId, ...tags.params }
  }
}

export function useItemList(filters: Ref<ItemListFilters>) {
  const { $pb } = useNuxtApp()
  return useQuery({
    queryKey: computed(() => keys.items.list(filters.value)),
    queryFn: () => {
      const { raw, params } = itemFilter(filters.value)
      return $pb.collection('storage_items').getList<StorageItem>(filters.value.page ?? 1, PER_PAGE, {
        filter: $pb.filter(raw, params),
        expand: 'tags',
        sort: '-created'
      })
    },
    enabled: computed(() => filters.value.boxId !== '')
  })
}

export function useItem(id: Ref<string>) {
  const { $pb } = useNuxtApp()
  return useQuery({
    queryKey: computed(() => keys.items.byId(id.value)),
    queryFn: () =>
      $pb.collection('storage_items').getOne<StorageItem>(id.value, { expand: 'tags,box' }),
    enabled: computed(() => id.value !== ''),
    retry: false
  })
}
