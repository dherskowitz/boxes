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

/** Fields a user may edit on an existing item. `box` moves it — see `useMoveItems`. */
export interface ItemEdit {
  title?: string
  description?: string
  notes?: string
  tags?: string[]
  box?: string
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * Build a minimal update payload. Mirrors `boxUpdatePayload` in shape — a
 * reader who has seen one should recognise the other.
 *
 * The update rule is `@request.body.created_by:isset = false` — the request
 * is rejected if `created_by` is present at all, even set correctly. Never
 * spread a fetched record into `.update()`.
 */
export function itemUpdatePayload(existing: StorageItem, edit: ItemEdit): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if (edit.title !== undefined && edit.title !== existing.title) payload.title = edit.title
  if (edit.description !== undefined && edit.description !== existing.description) payload.description = edit.description
  if (edit.notes !== undefined && edit.notes !== existing.notes) payload.notes = edit.notes
  if (edit.tags !== undefined && !sameList(edit.tags, existing.tags)) payload.tags = edit.tags
  if (edit.box !== undefined && edit.box !== existing.box) payload.box = edit.box
  return payload
}

export interface NewItem {
  boxId: string
  title: string
  description?: string
  notes?: string
  tags?: string[]
  images?: File[]
}

export function useCreateItem() {
  const { $pb } = useNuxtApp()
  const { userId } = useAuthUser()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: NewItem): Promise<StorageItem> => {
      const body = new FormData()
      body.set('box', input.boxId)
      body.set('title', input.title)
      body.set('description', input.description ?? '')
      body.set('notes', input.notes ?? '')
      // The create rule requires created_by to equal the authed user id.
      body.set('created_by', userId.value)
      for (const tag of input.tags ?? []) body.append('tags', tag)
      for (const image of await compressImages(input.images ?? [])) {
        body.append('images', image)
      }
      return $pb.collection('storage_items').create<StorageItem>(body)
    },
    onSuccess: () => {
      // A box's item count is visible on the index, so both caches need invalidating.
      queryClient.invalidateQueries({ queryKey: keys.items.all })
      queryClient.invalidateQueries({ queryKey: keys.boxes.all })
    }
  })
}

export function useUpdateItem() {
  const { $pb } = useNuxtApp()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ existing, edit }: { existing: StorageItem, edit: ItemEdit }) =>
      $pb.collection('storage_items').update<StorageItem>(existing.id, itemUpdatePayload(existing, edit)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.items.all })
  })
}

export function useDeleteItem() {
  const { $pb } = useNuxtApp()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => $pb.collection('storage_items').delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.items.all })
      queryClient.invalidateQueries({ queryKey: keys.boxes.all })
    }
  })
}

/**
 * Bulk-move several items to another box (PRD §7.4). PocketBase has no batch
 * update endpoint, so this issues one update per item and reports partial
 * failure honestly rather than claiming a clean move.
 */
export function useMoveItems() {
  const { $pb } = useNuxtApp()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ ids, toBoxId }: { ids: string[], toBoxId: string }) => {
      const failures: string[] = []
      for (const id of ids) {
        try {
          await $pb.collection('storage_items').update(id, { box: toBoxId })
        } catch (e) {
          failures.push(pbError(e))
        }
      }
      if (failures.length > 0) {
        throw new Error(`Moved ${ids.length - failures.length} of ${ids.length}. ${failures[0]}`)
      }
    },
    // onSettled, not onSuccess: a partial move still moved something, and
    // leaving the stale list on screen invites the user to re-move items that
    // already moved.
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.items.all })
  })
}
