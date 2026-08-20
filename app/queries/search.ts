import type { StorageBox, StorageItem } from '~/types/pocketbase'
import type { PbFilter, SearchFilters } from '~/queries/keys'
import { keys, PER_PAGE } from '~/queries/keys'

/** Discriminated so a template can never render an item as a box, or vice versa. */
export type SearchResult = { kind: 'box', box: StorageBox } | { kind: 'item', item: StorageItem }

/**
 * Build a search filter template for one collection, for use with
 * `$pb.filter(raw, params)`. Exported for testing.
 *
 * The term is bound as a placeholder, never interpolated into `raw` — a
 * spliced value can break out of its quotes and rewrite the query (this
 * happened once already on the qr_id deep-link path; see `boxFilter` in
 * `app/queries/boxes.ts`, the model this mirrors).
 *
 * Two quirks, deliberately not fixed for v1:
 * - `~` only wraps the value in `%…%` when the value itself has no `%` — a
 *   term containing `%` silently changes match semantics.
 * - `description`/`notes` are `editor` (HTML) fields, so a term matching
 *   markup (e.g. "div", "href") can match invisibly, outside the rendered text.
 *
 * A blank term returns a filter that matches nothing, never one that matches
 * everything — landing on an empty search must not return the whole database.
 */
export function searchFilter(term: string, opts: { kind: 'box' | 'item' }): PbFilter {
  const trimmed = term.trim()
  if (!trimmed) return { raw: '1 = 2', params: {} }

  const params: Record<string, unknown> = { search: trimmed, status: 'active' }
  if (opts.kind === 'box') {
    return { raw: 'status = {:status} && title ~ {:search}', params }
  }
  // Items carry no status of their own — exclusion of an archived box's items
  // travels through the relation field, which PocketBase resolves via a join.
  return {
    raw: 'box.status = {:status} && (title ~ {:search} || description ~ {:search} || notes ~ {:search})',
    params
  }
}

/**
 * Search spans two collections with no server-side join: one paginated query
 * per collection, combined into one result list. Gated on a non-empty term —
 * landing on /search must not fire a request for the whole database.
 */
export function useSearch(filters: Ref<SearchFilters>) {
  const { $pb } = useNuxtApp()
  const hasTerm = computed(() => filters.value.term.trim() !== '')

  const boxes = useQuery({
    queryKey: computed(() => [...keys.search.query(filters.value), 'boxes'] as const),
    queryFn: () => {
      const { raw, params } = searchFilter(filters.value.term, { kind: 'box' })
      return $pb.collection('storage_boxes').getList<StorageBox>(1, PER_PAGE, {
        filter: $pb.filter(raw, params),
        sort: '-created'
      })
    },
    enabled: hasTerm
  })

  const items = useQuery({
    queryKey: computed(() => [...keys.search.query(filters.value), 'items'] as const),
    queryFn: () => {
      const { raw, params } = searchFilter(filters.value.term, { kind: 'item' })
      return $pb.collection('storage_items').getList<StorageItem>(1, PER_PAGE, {
        filter: $pb.filter(raw, params),
        expand: 'box',
        sort: '-created'
      })
    },
    enabled: hasTerm
  })

  const results = computed<SearchResult[]>(() => [
    ...(boxes.data.value?.items ?? []).map(box => ({ kind: 'box' as const, box })),
    ...(items.data.value?.items ?? []).map(item => ({ kind: 'item' as const, item }))
  ])

  // Both queries are disabled together, so isPending only reflects an actual
  // in-flight fetch when there is a term — TanStack reports isPending: true
  // for a disabled query too, which would otherwise read as "loading" forever
  // on an empty search.
  const isPending = computed(() => hasTerm.value && (boxes.isPending.value || items.isPending.value))
  const isError = computed(() => boxes.isError.value || items.isError.value)
  const error = computed(() => boxes.error.value ?? items.error.value)

  return { results, hasTerm, isPending, isError, error }
}
