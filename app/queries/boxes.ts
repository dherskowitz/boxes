import { ClientResponseError } from 'pocketbase'
import type { BoxStatus, StorageBox } from '~/types/pocketbase'
import type { BoxListFilters, PbFilter } from '~/queries/keys'
import { keys, PER_PAGE, tagClauses } from '~/queries/keys'

/**
 * Build a PocketBase filter template from list filters, for use with
 * `$pb.filter(raw, params)`. Exported for testing.
 *
 * Values are never interpolated directly into the filter string — that would
 * let a search term or tag id break out of its quotes and rewrite the query
 * (see the qr_id deep-link path in boxes.ts history). `$pb.filter` binds
 * `params` by placeholder and escapes them itself.
 */
export function boxFilter(filters: BoxListFilters): PbFilter {
  const tags = tagClauses(filters.tagIds)
  const params: Record<string, unknown> = { status: filters.status ?? 'active', ...tags.params }
  const clauses = ['status = {:status}', ...tags.clauses]
  if (filters.search) {
    params.search = filters.search
    clauses.push('(title ~ {:search} || description ~ {:search} || location ~ {:search})')
  }
  return { raw: clauses.join(' && '), params }
}

export function useBoxList(filters: Ref<BoxListFilters>) {
  const { $pb } = useNuxtApp()
  return useQuery({
    queryKey: computed(() => keys.boxes.list(filters.value)),
    queryFn: () => {
      const { raw, params } = boxFilter(filters.value)
      return $pb.collection('storage_boxes').getList<StorageBox>(filters.value.page ?? 1, PER_PAGE, {
        filter: $pb.filter(raw, params),
        expand: 'tags',
        sort: '-created'
      })
    }
  })
}

export function useBoxByQrId(qrId: Ref<string>) {
  const { $pb } = useNuxtApp()
  return useQuery({
    queryKey: computed(() => keys.boxes.byQrId(qrId.value)),
    queryFn: () =>
      $pb
        .collection('storage_boxes')
        .getFirstListItem<StorageBox>($pb.filter('qr_id = {:qrId}', { qrId: qrId.value }), {
          expand: 'tags'
        }),
    enabled: computed(() => qrId.value !== ''),
    retry: false
  })
}

/** Fields a user may edit on an existing box. */
export interface BoxEdit {
  title?: string
  description?: string
  location?: string
  tags?: string[]
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * Build a minimal update payload.
 *
 * The update rule is `@request.body.created_by:isset = false` — the request is
 * rejected if `created_by` is present *at all*, even set to the correct value.
 * So an update must never spread a fetched record. `qr_id` is excluded too:
 * it is printed on a physical label and must not drift.
 */
export function boxUpdatePayload(existing: StorageBox, edit: BoxEdit): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if (edit.title !== undefined && edit.title !== existing.title) payload.title = edit.title
  if (edit.description !== undefined && edit.description !== existing.description) payload.description = edit.description
  if (edit.location !== undefined && edit.location !== existing.location) payload.location = edit.location
  if (edit.tags !== undefined && !sameList(edit.tags, existing.tags)) payload.tags = edit.tags
  return payload
}

export interface NewBox {
  title: string
  description?: string
  location?: string
  tags?: string[]
  images?: File[]
}

export function useCreateBox() {
  const { $pb } = useNuxtApp()
  const { userId } = useAuthUser()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: NewBox): Promise<StorageBox> => {
      const body = new FormData()
      body.set('title', input.title)
      body.set('description', input.description ?? '')
      body.set('location', input.location ?? '')
      // No schema default: an omitted status lands empty and the box then
      // disappears from the index's `status = "active"` filter.
      body.set('status', 'active')
      // The create rule requires created_by to equal the authed user id.
      body.set('created_by', userId.value)
      for (const tag of input.tags ?? []) body.append('tags', tag)
      for (const image of await compressImages(input.images ?? [])) {
        body.append('images', image)
      }

      // qr_id is unique-constrained. A collision is vanishingly unlikely but
      // would be a confusing failure on a create form, so retry once.
      body.set('qr_id', newQrId())
      try {
        return await $pb.collection('storage_boxes').create<StorageBox>(body)
      } catch (e) {
        if (e instanceof ClientResponseError && e.status === 400 && 'qr_id' in (e.response?.data ?? {})) {
          body.set('qr_id', newQrId())
          return await $pb.collection('storage_boxes').create<StorageBox>(body)
        }
        throw e
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.boxes.all })
  })
}

export function useUpdateBox() {
  const { $pb } = useNuxtApp()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ existing, edit }: { existing: StorageBox, edit: BoxEdit }) =>
      $pb.collection('storage_boxes').update<StorageBox>(existing.id, boxUpdatePayload(existing, edit)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.boxes.all })
  })
}

/** Archive or restore. Archiving never deletes data — see PRD §7.2. */
export function useSetBoxStatus() {
  const { $pb } = useNuxtApp()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string, status: BoxStatus }) =>
      $pb.collection('storage_boxes').update<StorageBox>(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.boxes.all })
  })
}

/** Creator-only at the API. A granted editor gets a 403 here by design. */
export function useDeleteBox() {
  const { $pb } = useNuxtApp()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => $pb.collection('storage_boxes').delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.boxes.all })
  })
}
