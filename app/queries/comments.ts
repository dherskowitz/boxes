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
 * How many comments the whole box has, across all of its items.
 *
 * Comments hang off items, not boxes, so this counts through the relation:
 * PocketBase resolves `item.box` as a join, the same way the item search
 * filters on `box.status`. `perPage: 1` because only `totalItems` is read —
 * the rows themselves are never rendered here.
 *
 * Used by the scan confirmation, which is the one screen that has to be fast
 * on a bad connection, so it is a count and not a fetch.
 */
export function useBoxCommentCount(boxId: Ref<string>) {
  const { $pb } = useNuxtApp()
  return useQuery({
    queryKey: computed(() => keys.comments.countByBox(boxId.value)),
    queryFn: () =>
      $pb.collection('storage_comments').getList(1, 1, {
        filter: $pb.filter('item.box = {:boxId}', { boxId: boxId.value })
      }),
    enabled: computed(() => boxId.value !== '')
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
    // Cancel before invalidating. A thread whose first read is still in flight
    // when the comment is posted otherwise never refetches at all: the
    // invalidation is answered by that already-running request, which was
    // issued before the comment existed, and its empty result is what the
    // query keeps. The comment stays invisible until a reload — no error, no
    // second request, nothing to see. Cancelling first forces a fresh read.
    onSettled: async (_data, _error, variables) => {
      const queryKey = keys.comments.byItem(variables.itemId)
      await queryClient.cancelQueries({ queryKey })
      await queryClient.invalidateQueries({ queryKey })
    }
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
    // Cancel before invalidating. A thread whose first read is still in flight
    // when the comment is posted otherwise never refetches at all: the
    // invalidation is answered by that already-running request, which was
    // issued before the comment existed, and its empty result is what the
    // query keeps. The comment stays invisible until a reload — no error, no
    // second request, nothing to see. Cancelling first forces a fresh read.
    onSettled: async (_data, _error, variables) => {
      const queryKey = keys.comments.byItem(variables.itemId)
      await queryClient.cancelQueries({ queryKey })
      await queryClient.invalidateQueries({ queryKey })
    }
  })
}
