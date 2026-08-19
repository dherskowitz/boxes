import type { StorageTag } from '~/types/pocketbase'
import { keys } from '~/queries/keys'

/**
 * The whole curated tag list. Unpaginated on purpose — it is a small shared
 * vocabulary and every picker needs all of it for autocomplete.
 */
export function useTags() {
  const { $pb } = useNuxtApp()
  return useQuery({
    queryKey: keys.tags.list(),
    queryFn: () => $pb.collection('storage_tags').getFullList<StorageTag>({ sort: 'name' }),
    staleTime: 5 * 60 * 1000
  })
}
