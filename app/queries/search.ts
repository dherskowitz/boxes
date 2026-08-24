import type { StorageBox, StorageItem } from '~/types/pocketbase'
import type { PbFilter, SearchFilters } from '~/queries/keys'
import { keys, PER_PAGE, tagClauses } from '~/queries/keys'

/**
 * Why a box is in the results.
 *
 * A box can surface for something the reader cannot see on its row — a word in
 * its description, or a word on an item sealed inside it — and a row with no
 * visible reason reads as a bug in the search. `title` carries no label: the
 * highlighted title is the explanation.
 */
export type BoxMatchReason =
  | { kind: 'title' }
  | { kind: 'description' }
  | { kind: 'location' }
  | { kind: 'items', count: number }
  /** Matched something in a field we cannot point at — see `reasonFor`. */
  | { kind: 'unknown' }

/** Discriminated so a template can never render an item as a box, or vice versa. */
export type SearchResult =
  | { kind: 'box', box: StorageBox, reason: BoxMatchReason }
  | { kind: 'item', item: StorageItem }

function contains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle)
}

/**
 * Which visible field of a box the term was found in.
 *
 * Ordered by what the reader can actually see: the title is already
 * highlighted on the row, the location is printed under it, and the
 * description is neither — so it is named last of the three.
 *
 * `unknown` is not a fallthrough for tidiness. `description` is an `editor`
 * field holding HTML, so a term can match markup that appears nowhere in the
 * rendered text (searching "div" is the easy example). Saying "matched
 * description" then sends someone hunting for a word that is not there;
 * saying nothing is honest about a match we cannot point at.
 */
function reasonFor(box: StorageBox, needle: string): BoxMatchReason {
  if (contains(box.title, needle)) return { kind: 'title' }
  if (contains(box.location, needle)) return { kind: 'location' }
  if (contains(stripHtml(box.description), needle)) return { kind: 'description' }
  return { kind: 'unknown' }
}

/**
 * Fold the two collection queries into one ordered result list.
 *
 * Boxes whose *items* matched are surfaced here rather than by a third query:
 * the item search already returns each item with its box expanded, so the box
 * and the count are both in hand. A box that matched directly keeps its own
 * reason — that is about the box, not about something inside it — and is never
 * listed twice.
 *
 * Every matching item stays in the list even when its box is also shown. The
 * two rows answer different questions: which box to open, and whether the
 * thing is really in there.
 *
 * Pure so it tests without `$pb`.
 */
export function searchResults(
  boxes: StorageBox[],
  items: StorageItem[],
  term: string
): SearchResult[] {
  const needle = term.trim().toLowerCase()
  const direct = boxes.map(box => ({ kind: 'box' as const, box, reason: reasonFor(box, needle) }))
  const seen = new Set(boxes.map(box => box.id))

  // Insertion-ordered, so the surfaced boxes follow the order their first
  // matching item came back in rather than an arbitrary one.
  const viaItems = new Map<string, { box: StorageBox, count: number }>()
  for (const item of items) {
    const box = item.expand?.box
    // An item whose relation was not expanded gives nothing to link to. It
    // still belongs in the item list; it just cannot surface a box row.
    if (!box || seen.has(box.id)) continue
    const entry = viaItems.get(box.id)
    if (entry) entry.count += 1
    else viaItems.set(box.id, { box, count: 1 })
  }

  return [
    ...direct,
    ...[...viaItems.values()].map(({ box, count }) => ({
      kind: 'box' as const,
      box,
      reason: { kind: 'items' as const, count }
    })),
    ...items.map(item => ({ kind: 'item' as const, item }))
  ]
}

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
 * That default is why `itemFilter` in `app/queries/items.ts` duplicates the
 * item term clause below instead of calling this: /items needs the opposite,
 * where no term shows everything. The two copies must stay in step.
 *
 * `tagIds` AND-matches, via the same `tagClauses()` both list filters use:
 * boxes and items each carry tags, so both kinds narrow by them.
 */
export function searchFilter(
  term: string,
  opts: { kind: 'box' | 'item', tagIds?: string[] }
): PbFilter {
  const trimmed = term.trim()
  if (!trimmed) return { raw: '1 = 2', params: {} }

  const tags = tagClauses(opts.tagIds)
  const params: Record<string, unknown> = { search: trimmed, status: 'active', ...tags.params }
  const clauses
    = opts.kind === 'box'
      // Title, description and location. A box is often findable only by
      // where it is ("garage") or by a note on it, and matching the title
      // alone made those searches come back empty while the answer was
      // sitting in the record. `SearchResult.reason` names which one hit, so
      // a row never surfaces without a visible explanation.
      ? ['status = {:status}', '(title ~ {:search} || description ~ {:search} || location ~ {:search})']
      // Items carry no status of their own — exclusion of an archived box's
      // items travels through the relation field, which PocketBase resolves
      // via a join.
      : ['box.status = {:status}', '(title ~ {:search} || description ~ {:search} || notes ~ {:search})']

  return { raw: [...clauses, ...tags.clauses].join(' && '), params }
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
      const { raw, params } = searchFilter(filters.value.term, {
        kind: 'box',
        tagIds: filters.value.tagIds
      })
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
      const { raw, params } = searchFilter(filters.value.term, {
        kind: 'item',
        tagIds: filters.value.tagIds
      })
      return $pb.collection('storage_items').getList<StorageItem>(1, PER_PAGE, {
        filter: $pb.filter(raw, params),
        expand: 'box',
        sort: '-created'
      })
    },
    enabled: hasTerm
  })

  const results = computed<SearchResult[]>(() =>
    searchResults(
      boxes.data.value?.items ?? [],
      items.data.value?.items ?? [],
      filters.value.term
    )
  )

  // Both queries are disabled together, so isPending only reflects an actual
  // in-flight fetch when there is a term — TanStack reports isPending: true
  // for a disabled query too, which would otherwise read as "loading" forever
  // on an empty search.
  const isPending = computed(() => hasTerm.value && (boxes.isPending.value || items.isPending.value))
  const isError = computed(() => boxes.isError.value || items.isError.value)
  const error = computed(() => boxes.error.value ?? items.error.value)

  return { results, hasTerm, isPending, isError, error }
}
