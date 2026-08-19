import type { StorageItem } from '~/types/pocketbase'
import type { ItemListFilters } from '~/queries/keys'
import { keys, PER_PAGE } from '~/queries/keys'

export function useItemList(filters: Ref<ItemListFilters>) {
  const { $pb } = useNuxtApp()
  return useQuery({
    queryKey: computed(() => keys.items.list(filters.value)),
    queryFn: () =>
      $pb.collection('storage_items').getList<StorageItem>(filters.value.page ?? 1, PER_PAGE, {
        filter: $pb.filter('box = {:boxId}', { boxId: filters.value.boxId }),
        expand: 'tags',
        sort: '-created'
      }),
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
