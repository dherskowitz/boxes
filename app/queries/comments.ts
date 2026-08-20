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
        filter: $pb.filter('item = {:itemId}', { itemId: itemId.value }),
        sort: 'created'
      }),
    enabled: computed(() => itemId.value !== '')
  })
}

/**
 * Build a minimal update payload.
 *
 * The update rule is `@request.body.user:isset = false` — the request is
 * rejected if `user` is present at all, even set to the already-correct
 * value. `item` is excluded too: a comment does not move between items.
 */
export function commentUpdatePayload(existing: StorageComment, text: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if (text !== existing.text) payload.text = text
  return payload
}

export function useCreateComment() {
  const { $pb } = useNuxtApp()
  const { userId } = useAuthUser()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ itemId, text }: { itemId: string, text: string }) => {
      assertOnline()
      const trimmed = text.trim()
      if (trimmed === '') throw new Error('Comment cannot be empty.')
      // The create rule requires user to equal the authed user id.
      return $pb.collection('storage_comments').create<StorageComment>({
        item: itemId,
        user: userId.value,
        text: trimmed
      })
    },
    onSettled: (_data, _error, variables) =>
      queryClient.invalidateQueries({ queryKey: keys.comments.byItem(variables.itemId) })
  })
}

export function useUpdateComment() {
  const { $pb } = useNuxtApp()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ existing, text }: { existing: StorageComment, text: string }) => {
      assertOnline()
      const trimmed = text.trim()
      if (trimmed === '') throw new Error('Comment cannot be empty.')
      return $pb.collection('storage_comments').update<StorageComment>(
        existing.id,
        commentUpdatePayload(existing, trimmed)
      )
    },
    onSettled: (_data, _error, variables) =>
      queryClient.invalidateQueries({ queryKey: keys.comments.byItem(variables.existing.item) })
  })
}

export function useDeleteComment() {
  const { $pb } = useNuxtApp()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: { id: string, itemId: string }) => {
      assertOnline()
      return $pb.collection('storage_comments').delete(id)
    },
    onSettled: (_data, _error, variables) =>
      queryClient.invalidateQueries({ queryKey: keys.comments.byItem(variables.itemId) })
  })
}
