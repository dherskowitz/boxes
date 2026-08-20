<script setup lang="ts">
import { ClientResponseError } from 'pocketbase'
import { PER_PAGE } from '~/queries/keys'

const route = useRoute()
const qrId = computed(() => String(route.params.qr_id))

const {
  data: box,
  isPending: boxPending,
  isError: boxIsError,
  error: boxError
} = useBoxByQrId(qrId)

const isNotFound = computed(
  () => boxError.value instanceof ClientResponseError && boxError.value.status === 404
)
const boxErrorMessage = computed(() => (boxError.value ? pbError(boxError.value) : ''))

const { canEdit, canDelete } = useCanEdit(computed(() => box.value))

const { $pb } = useNuxtApp()

const galleryUrls = computed(() => {
  const b = box.value
  if (!b) return []
  return b.images.map(name => $pb.files.getURL(b, name, { thumb: '400x400' }))
})

// Items in this box
const itemPage = ref(1)
const itemFilters = computed(() => ({ boxId: box.value?.id ?? '', page: itemPage.value }))
const {
  data: itemsResult,
  isPending: itemsPending,
  isError: itemsIsError,
  error: itemsError
} = useItemList(itemFilters)
const items = computed(() => itemsResult.value?.items ?? [])
const itemsTotal = computed(() => itemsResult.value?.totalItems ?? 0)
const itemsTotalPages = computed(() => itemsResult.value?.totalPages ?? 1)
const itemsErrorMessage = computed(() => (itemsError.value ? pbError(itemsError.value) : ''))

// Edit box
const editOpen = ref(false)
const { mutateAsync: updateBox, isPending: updatePending } = useUpdateBox()
const updateError = ref('')
async function onUpdateBox(payload: { title: string, description: string, location: string, tags: string[] }) {
  const current = box.value
  if (!current) return
  updateError.value = ''
  try {
    await updateBox({ existing: current, edit: payload })
    editOpen.value = false
  } catch (e) {
    updateError.value = pbError(e)
  }
}

// Archive / unarchive
const { mutateAsync: setStatus, isPending: statusPending } = useSetBoxStatus()
const archiveError = ref('')
async function toggleArchive() {
  const current = box.value
  if (!current) return
  archiveError.value = ''
  try {
    await setStatus({ id: current.id, status: current.status === 'archived' ? 'active' : 'archived' })
  } catch (e) {
    archiveError.value = pbError(e)
  }
}

// Delete. `storage_items.box` is required with cascadeDelete false, so the
// API answers 400 for a box that still holds items — disable the control and
// say why rather than surfacing that as database jargon.
const deleteOpen = ref(false)
const { mutateAsync: deleteBox, isPending: deletePending } = useDeleteBox()
const deleteError = ref('')
const hasItems = computed(() => !itemsPending.value && itemsTotal.value > 0)
async function onDelete() {
  const current = box.value
  if (!current) return
  deleteError.value = ''
  try {
    await deleteBox(current.id)
    deleteOpen.value = false
    await navigateTo('/')
  } catch (e) {
    deleteError.value = pbError(e)
    deleteOpen.value = false
  }
}

// Add item
const addItemOpen = ref(false)
const { mutateAsync: createItem, isPending: createItemPending } = useCreateItem()
const createItemError = ref('')
async function onCreateItem(payload: { title: string, description: string, notes: string, tags: string[], images: File[] }) {
  const current = box.value
  if (!current) return
  createItemError.value = ''
  try {
    await createItem({ boxId: current.id, ...payload })
    addItemOpen.value = false
  } catch (e) {
    createItemError.value = pbError(e)
  }
}

// Bulk move
const selectMode = ref(false)
const selectedIds = ref<string[]>([])
function toggleSelected(id: string, value: boolean) {
  selectedIds.value = value
    ? [...selectedIds.value, id]
    : selectedIds.value.filter(existingId => existingId !== id)
}
function exitSelectMode() {
  selectMode.value = false
  selectedIds.value = []
}
// A selection that survives a page change is invisible, and lets someone move
// items they can no longer see.
watch(itemPage, () => {
  selectedIds.value = []
})

const moveOpen = ref(false)
const moveTargetId = ref('')
const otherBoxesFilters = computed(() => ({ status: 'active' as const }))
const { data: otherBoxesResult } = useBoxList(otherBoxesFilters)
const moveTargets = computed(() =>
  (otherBoxesResult.value?.items ?? [])
    .filter(b => b.id !== box.value?.id)
    .map(b => ({ label: b.title || b.qr_id, value: b.id }))
)
const { mutateAsync: moveItems, isPending: movePending } = useMoveItems()
const moveError = ref('')
async function onMove() {
  if (!moveTargetId.value) return
  moveError.value = ''
  try {
    await moveItems({ ids: selectedIds.value, toBoxId: moveTargetId.value })
    moveOpen.value = false
    moveTargetId.value = ''
    exitSelectMode()
  } catch (e) {
    moveError.value = pbError(e)
  }
}
</script>

<template>
  <div>
    <div v-if="boxPending" data-testid="box-loading" class="flex flex-col gap-4">
      <USkeleton class="h-8 w-64" />
      <USkeleton class="h-40 w-full" />
    </div>

    <div v-else-if="isNotFound" data-testid="box-not-found" class="flex flex-col gap-3">
      <p>Box not found.</p>
      <UButton to="/">Back to boxes</UButton>
    </div>

    <UAlert v-else-if="boxIsError" color="error" :description="boxErrorMessage" />

    <div v-else-if="box" class="flex flex-col gap-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex flex-col gap-1">
          <h1 class="text-lg font-medium">{{ box.title || box.qr_id }}</h1>
          <p v-if="box.location">{{ box.location }}</p>
          <UBadge v-if="box.status === 'archived'" variant="subtle">Archived</UBadge>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton v-if="canEdit" data-testid="edit-box" @click="editOpen = true">Edit</UButton>
          <UButton
            v-if="canEdit"
            data-testid="archive-box"
            :loading="statusPending"
            @click="toggleArchive"
          >
            {{ box.status === 'archived' ? 'Unarchive' : 'Archive' }}
          </UButton>
          <UButton
            v-if="canDelete"
            data-testid="delete-box"
            :loading="deletePending"
            :disabled="itemsPending || hasItems"
            @click="deleteOpen = true"
          >
            Delete
          </UButton>
          <UButton :to="`/box/${qrId}/print`">Print label</UButton>
          <UButton :to="`/box/${qrId}/share`">Share</UButton>
        </div>
      </div>

      <p v-if="canDelete && hasItems">Empty this box before deleting it.</p>

      <UAlert v-if="archiveError" color="error" :description="archiveError" />
      <UAlert v-if="deleteError" color="error" :description="deleteError" />

      <p v-if="box.description">{{ box.description }}</p>

      <div v-if="galleryUrls.length > 0" class="flex flex-wrap gap-2">
        <img
          v-for="(url, index) in galleryUrls"
          :key="url"
          data-testid="box-gallery-image"
          :src="url"
          :alt="`${box.title || box.qr_id}, photo ${index + 1}`"
          class="h-24 w-24 object-cover"
        >
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-medium">Items</h2>
        <div class="flex flex-wrap gap-2">
          <UButton v-if="canEdit" data-testid="add-item" @click="addItemOpen = true">+ Add item</UButton>
          <UButton
            v-if="canEdit && items.length > 0"
            data-testid="toggle-select"
            variant="ghost"
            @click="selectMode ? exitSelectMode() : (selectMode = true)"
          >
            {{ selectMode ? 'Cancel' : 'Select' }}
          </UButton>
          <UButton
            v-if="canEdit && selectMode && selectedIds.length > 0"
            data-testid="move-items"
            @click="moveOpen = true"
          >
            Move to…
          </UButton>
        </div>
      </div>

      <div v-if="itemsPending" data-testid="item-list-loading" class="flex flex-col gap-2">
        <USkeleton v-for="n in 3" :key="n" class="h-16 w-full" />
      </div>

      <UAlert v-else-if="itemsIsError" color="error" :description="itemsErrorMessage" />

      <div v-else-if="items.length === 0" data-testid="item-list-empty">
        <p>No items in this box yet.</p>
      </div>

      <div v-else class="flex flex-col gap-2">
        <ItemCard
          v-for="item in items"
          :key="item.id"
          :item="item"
          :selectable="selectMode"
          :selected="selectedIds.includes(item.id)"
          @update:selected="(value) => toggleSelected(item.id, value)"
        />
      </div>

      <UPagination
        v-if="itemsTotalPages > 1"
        v-model:page="itemPage"
        :total="itemsTotal"
        :items-per-page="PER_PAGE"
      />

      <UModal v-model:open="editOpen" title="Edit box">
        <template #body>
          <BoxForm :existing="box" :pending="updatePending" :error="updateError" @submit="onUpdateBox" />
        </template>
      </UModal>

      <UModal v-model:open="addItemOpen" title="Add item">
        <template #body>
          <ItemForm :pending="createItemPending" :error="createItemError" @submit="onCreateItem" />
        </template>
      </UModal>

      <UModal v-model:open="deleteOpen" title="Delete box">
        <template #body>
          <div data-testid="delete-box-confirm" class="flex flex-col gap-4">
            <p>Delete "{{ box.title || box.qr_id }}"? This cannot be undone.</p>
            <div class="flex gap-2">
              <UButton data-testid="cancel-delete-box" variant="ghost" @click="deleteOpen = false">
                Cancel
              </UButton>
              <UButton data-testid="confirm-delete-box" :loading="deletePending" @click="onDelete">
                Delete box
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <UModal v-model:open="moveOpen" title="Move items">
        <template #body>
          <div class="flex flex-col gap-4">
            <USelect
              v-model="moveTargetId"
              data-testid="move-target"
              :items="moveTargets"
              placeholder="Choose a box"
            />
            <UAlert v-if="moveError" color="error" :description="moveError" />
            <UButton
              data-testid="confirm-move"
              :loading="movePending"
              :disabled="!moveTargetId"
              @click="onMove"
            >
              Move
            </UButton>
          </div>
        </template>
      </UModal>
    </div>
  </div>
</template>
