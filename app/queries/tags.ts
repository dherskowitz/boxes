import type { ReportTagUsage, StorageTag } from '~/types/pocketbase'
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
    // Only `name` is sent. Tags are a shared, curated vocabulary rather than
    // something a single user owns: `created_by` is optional on
    // storage_tags, and the update rule is just "any enabled member" — no
    // `:isset` check at all (that pattern applies to boxes and items, not
    // tags). Omitting it here is still correct, just for a different reason.
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

/**
 * Indexes the `storage_report_tag_usage` view's rows by tag id, so a caller
 * can look up a single tag's counts in O(1) rather than scanning the report
 * on every render. A tag absent from the report (no usage row) is simply
 * absent from the map — callers fall back to `{ boxCount: 0, itemCount: 0 }`.
 */
export function indexTagUsage(
  rows: ReportTagUsage[] | undefined
): Map<string, { boxCount: number, itemCount: number }> {
  const map = new Map<string, { boxCount: number, itemCount: number }>()
  for (const row of rows ?? []) {
    map.set(row.id, { boxCount: row.box_count, itemCount: row.item_count })
  }
  return map
}

/**
 * Usage counts per tag, from the `storage_report_tag_usage` view — computed
 * in SQL, not by fetching every box and item and counting client-side. The
 * report has one row per tag, so unpaginated is correct here for the same
 * reason `useTags` is.
 */
export function useTagUsage() {
  const { $pb } = useNuxtApp()
  const { data } = useQuery({
    queryKey: keys.reports.tagUsage(),
    queryFn: () => $pb.collection('storage_report_tag_usage').getFullList<ReportTagUsage>(),
    staleTime: 5 * 60 * 1000
  })
  return computed(() => indexTagUsage(data.value))
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
