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

/**
 * Canonical form for a tag name.
 *
 * `storage_tags.name` is unique-constrained, and this is a *curated shared*
 * vocabulary — without normalisation "Winter", "winter " and "winter" become
 * three tags and the list stops being useful. Returns '' for whitespace-only
 * input; callers must reject that rather than creating an unnamed tag.
 */
export function normalizeTagName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function useCreateTag() {
  const { $pb } = useNuxtApp()
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ name, color }: { name: string, color?: string }) =>
      // The create rule requires created_by to equal the authed user id.
      $pb.collection('storage_tags').create<StorageTag>({
        name: normalizeTagName(name),
        color: color ?? '',
        created_by: userId.value
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.tags.all })
  })
}

export function useRenameTag() {
  const { $pb } = useNuxtApp()
  const queryClient = useQueryClient()

  return useMutation({
    // Only `name` is sent. Including created_by would trip the update rule's
    // `:isset = false` check and 403 even when set to the correct value.
    mutationFn: ({ id, name }: { id: string, name: string }) =>
      $pb.collection('storage_tags').update<StorageTag>(id, { name: normalizeTagName(name) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.tags.all })
      // A tag is a relation on boxes and items, and both expand it — their
      // cached copies still carry the old label until refetched.
      queryClient.invalidateQueries({ queryKey: keys.boxes.all })
      queryClient.invalidateQueries({ queryKey: keys.items.all })
    }
  })
}

/** Requires an owner/admin membership role — the API delete rule enforces it. */
export function useDeleteTag() {
  const { $pb } = useNuxtApp()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => $pb.collection('storage_tags').delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.tags.all })
      queryClient.invalidateQueries({ queryKey: keys.boxes.all })
      queryClient.invalidateQueries({ queryKey: keys.items.all })
    }
  })
}
