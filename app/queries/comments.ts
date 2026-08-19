import type { StorageComment } from '~/types/pocketbase'
import { keys } from '~/queries/keys'

/**
 * Comments on one item, oldest first.
 *
 * Deliberately no `expand: 'user'` — the `users` collection is not readable by
 * other members, so it would always come back empty. Resolve author names with
 * `useAppUserMap()` instead.
 */
export function useComments(itemId: Ref<string>) {
  const { $pb } = useNuxtApp()
  return useQuery({
    queryKey: computed(() => keys.comments.byItem(itemId.value)),
    queryFn: () =>
      $pb.collection('storage_comments').getList<StorageComment>(1, 200, {
        filter: `item = "${itemId.value}"`,
        sort: 'created'
      }),
    enabled: computed(() => itemId.value !== '')
  })
}
