<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { useLocalStorage } from '@vueuse/core'

definePageMeta({ nav: false })

const route = useRoute()
const qrId = computed(() => String(route.params.qr_id))

const {
  data: box,
  isPending: boxPending,
  isError: boxIsError,
  error: boxError
} = useBoxByQrId(qrId)

// Deleting this box invalidates its own detail query, which then refetches
// and 404s while we are still on the page — an expected 404, not a wrong
// address, so it must not reach the error screen.
const deleting = ref(false)
useNotFound(boxError, deleting)
const boxErrorMessage = computed(() => (boxError.value ? pbError(boxError.value) : ''))

const { canEdit, canDelete } = useCanEdit(computed(() => box.value))

// Stacked rows or a photo grid. Kept in localStorage rather than in component
// state: it is a reading preference, not something about this box, so it
// should still be what you chose the next time you open any box. `useLocalStorage`
// already handles the storage being unavailable — a private window, or a
// browser set to block site data — by falling back to the in-memory default.
const itemLayout = useLocalStorage<'row' | 'grid'>('storage-app-item-layout', 'row')

const LAYOUTS = [
  { value: 'row', icon: 'i-lucide-rows-3', label: 'List' },
  { value: 'grid', icon: 'i-lucide-grid-2x2', label: 'Grid' }
] as const

// The box's signature colour, scoped to the whole screen: the hero, the
// selected item rows, the primary button and the printed label all read `--c`
// off this one binding.
const vars = computed(() => (box.value ? boxColorVars(box.value.qr_id) : {}))

const { data: tags } = useTags()
const tagNames = computed(() =>
  (box.value?.tags ?? [])
    .map(id => (tags.value ?? []).find(t => t.id === id)?.name)
    .filter((name): name is string => Boolean(name))
)

// Items in this box. `''` while the box loads, which `useInfiniteItemList`
// gates on — a box detail page must not fire the browse-every-box query.
const itemFilters = computed(() => ({ boxId: box.value?.id ?? '' }))
const {
  data: itemsResult,
  isPending: itemsPending,
  isError: itemsIsError,
  error: itemsError,
  fetchNextPage: fetchMoreItems,
  hasNextPage: hasMoreItems,
  isFetchingNextPage: isFetchingMoreItems
} = useInfiniteItemList(itemFilters)
const items = computed(() => (itemsResult.value?.pages ?? []).flatMap(page => page.items))
const itemsTotal = computed(() => itemsResult.value?.pages[0]?.totalItems ?? 0)
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

// `storage_items.box` is required with cascadeDelete false, so PocketBase
// answers 400 for a box that still holds items. Say so in the dialog rather
// than letting someone find out by pressing the red button.
const blockedDeleteReason = computed(() => {
  if (itemsPending.value) return 'Still counting what is in this box — try again in a moment.'
  if (!hasItems.value) return ''
  const n = itemsTotal.value
  return `This box still holds ${n} ${n === 1 ? 'item' : 'items'}. Move or delete them first, then the box can go.`
})
// One kebab instead of a three-button row and a separate delete icon. The row
// cost ~64px of the hero on a 412px screen for actions that are taken once per
// box, while the item list underneath is what the screen is actually for.
const boxActions = computed<DropdownMenuItem[]>(() => {
  const current = box.value
  if (!current) return []
  const items: DropdownMenuItem[] = []
  if (canEdit.value) {
    items.push({ label: 'Edit box', icon: 'i-lucide-pencil', onSelect: () => { editOpen.value = true } })
  }
  items.push({ label: 'Print label', icon: 'i-lucide-printer', to: `/box/${qrId.value}/print` })
  if (canEdit.value) {
    items.push({
      label: current.status === 'archived' ? 'Unarchive box' : 'Archive box',
      icon: 'i-lucide-archive',
      loading: statusPending.value,
      onSelect: () => { void toggleArchive() }
    })
  }
  if (canDelete.value) {
    // Enabled even for a box that still holds items — the dialog explains why
    // it cannot go, which beats a greyed-out row with the reason elsewhere.
    items.push({ type: 'separator' })
    items.push({
      label: 'Delete box',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => { deleteOpen.value = true }
    })
  }
  return items
})

async function onDelete() {
  const current = box.value
  if (!current) return
  deleteError.value = ''
  deleting.value = true
  try {
    await deleteBox(current.id)
    deleteOpen.value = false
    await navigateTo('/boxes')
  } catch (e) {
    // Left open on purpose: the dialog is where the error is rendered, and
    // closing it would drop the only explanation of why nothing happened.
    deleting.value = false
    deleteError.value = pbError(e)
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
  <div :style="vars">
    <div v-if="boxPending" data-testid="box-loading" class="sb-body flex flex-col gap-4 pt-6">
      <USkeleton class="h-8 w-64" />
      <USkeleton class="h-40 w-full" />
    </div>

    <UAlert v-else-if="boxIsError" color="error" class="m-[1.375rem]" :description="boxErrorMessage" />

    <div v-else-if="box" class="pb-40">
      <!-- The box's own colour, edge to edge. Everything below it that is
           tinted, outlined or filled reads the same `--c`. -->
      <header class="sb-header">
        <div class="flex items-center justify-between">
          <UButton
            to="/boxes"
            icon="i-lucide-arrow-left"
            aria-label="Back to boxes"
            variant="ghost"
            class="size-10 justify-center rounded-full bg-black/15 text-current hover:bg-black/25"
          />
          <UDropdownMenu
            v-if="boxActions.length"
            :items="boxActions"
            :content="{ align: 'end' }"
          >
            <UButton
              data-testid="box-actions"
              icon="i-lucide-ellipsis-vertical"
              aria-label="Box actions"
              variant="ghost"
              :loading="deletePending || statusPending"
              class="size-10 justify-center rounded-full bg-black/15 text-current hover:bg-black/25"
            />
          </UDropdownMenu>
        </div>

        <!-- No thumbnail. A box carries no photo: a picture of a sealed
             cardboard box says nothing the printed label does not, and the
             tile that stood in for one cost the title a third of the row. -->
        <div class="mt-3.5 flex items-start gap-3.5">
          <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <h1 class="sb-display text-[28px] break-words">{{ box.title || box.qr_id }}</h1>

            <!-- Location and code on one meta line: two facts about where the
                 box is, not two separate blocks. -->
            <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold opacity-90">
              <span v-if="box.location" class="flex items-center gap-1.5">
                <UIcon name="i-lucide-map-pin" class="size-[13px] shrink-0" aria-hidden="true" />
                {{ box.location }}
              </span>
              <span class="sb-mono opacity-80">
                {{ box.qr_id }}<template v-if="!itemsPending"> · {{ itemsTotal }} {{ itemsTotal === 1 ? 'item' : 'items' }}</template>
              </span>
              <span v-if="box.status === 'archived'" class="sb-chip bg-black/25">Archived</span>
            </p>
          </div>
        </div>

      </header>

      <div class="sb-body flex flex-col gap-3">
        <UAlert v-if="archiveError" color="error" :description="archiveError" />

        <div v-if="tagNames.length" class="flex flex-wrap gap-1.5">
          <span v-for="name in tagNames" :key="name" class="sb-chip sb-chip-outline">{{ name }}</span>
        </div>

        <div class="flex items-start justify-between gap-3">
          <p v-if="box.description" class="max-w-[52ch] text-[13px] leading-relaxed" :style="{ color: 'var(--sb-muted)' }">
            {{ box.description }}
          </p>
          <span
            v-if="selectMode && selectedIds.length > 0"
            class="sb-chip sb-on-tint shrink-0 px-3 py-1.5 text-xs"
            :style="{ background: 'color-mix(in oklch, var(--c) 14%, var(--sb-surface))' }"
          >
            <UIcon name="i-lucide-check-square" class="size-3.5" aria-hidden="true" />
            {{ selectedIds.length }} selected
          </span>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="sb-mono" :style="{ color: 'var(--sb-muted)' }">
            Items<template v-if="!itemsPending"> · {{ itemsTotal }}</template>
          </h2>
          <div class="flex items-center gap-1.5">
            <div
              v-if="items.length > 0"
              class="flex rounded-full p-[3px]"
              :style="{ background: 'color-mix(in oklch, var(--sb-text) 8%, transparent)' }"
              role="group"
              aria-label="Item layout"
            >
              <button
                v-for="option in LAYOUTS"
                :key="option.value"
                type="button"
                class="flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors"
                :style="itemLayout === option.value
                  ? { background: 'var(--sb-surface)', color: 'var(--sb-text)' }
                  : { color: 'var(--sb-muted)' }"
                :aria-pressed="itemLayout === option.value"
                :data-testid="`item-layout-${option.value}`"
                @click="itemLayout = option.value"
              >
                <UIcon :name="option.icon" class="size-4" aria-hidden="true" />
                <span class="sr-only">{{ option.label }}</span>
              </button>
            </div>

            <UButton
              v-if="canEdit && items.length > 0"
              data-testid="toggle-select"
              size="xs"
              variant="ghost"
              color="neutral"
              @click="selectMode ? exitSelectMode() : (selectMode = true)"
            >
              {{ selectMode ? 'Cancel' : 'Select' }}
            </UButton>
          </div>
        </div>

        <div
          v-if="itemsPending"
          data-testid="item-list-loading"
          :class="itemLayout === 'grid'
            ? 'grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4'
            : 'grid gap-2 md:grid-cols-2'"
        >
          <USkeleton v-for="n in 3" :key="n" class="h-[72px] w-full rounded-[1.25rem]" />
        </div>

        <UAlert v-else-if="itemsIsError" color="error" :description="itemsErrorMessage" />

        <div
          v-else-if="items.length === 0"
          data-testid="item-list-empty"
          class="flex flex-col items-center gap-4 px-2 py-10 text-center"
        >
          <div
            class="flex size-26 items-center justify-center rounded-[2rem]"
            :style="{
              border: '3px dashed color-mix(in oklch, var(--c) 45%, var(--sb-surface))',
              color: 'color-mix(in oklch, var(--c) 80%, var(--sb-text))'
            }"
          >
            <UIcon name="i-lucide-list-plus" class="size-12" aria-hidden="true" />
          </div>
          <div class="flex flex-col gap-2">
            <p class="sb-display text-[21px]">This box is empty</p>
            <p class="text-sm" :style="{ color: 'var(--sb-muted)' }">
              Add items one at a time, or photograph the whole box and label things later.
            </p>
          </div>
        </div>

        <div
          v-else
          data-testid="item-list"
          :data-layout="itemLayout"
          :class="itemLayout === 'grid'
            ? 'grid grid-cols-2 gap-[9px] md:grid-cols-3 xl:grid-cols-4'
            : 'grid gap-[9px] md:grid-cols-2'"
        >
          <ItemCard
            v-for="item in items"
            :key="item.id"
            :item="item"
            :layout="itemLayout"
            :selectable="selectMode"
            :selected="selectedIds.includes(item.id)"
            @update:selected="(value) => toggleSelected(item.id, value)"
          />
        </div>

        <InfiniteList
          v-if="items.length > 0"
          :has-more="hasMoreItems"
          :loading="isFetchingMoreItems"
          :total="itemsTotal"
          noun="items"
          @more="fetchMoreItems()"
        />
      </div>

      <!-- The thumb-zone bar the design gives this screen instead of the nav
           pill. Fixed, so adding an item never means scrolling to the bottom
           of a full box first. -->
      <div
        v-if="canEdit"
        class="fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-2.5 px-[1.375rem] pt-3.5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        :style="{ background: 'linear-gradient(to top, var(--sb-bg) 72%, transparent)' }"
      >
        <UButton
          v-if="selectMode && selectedIds.length > 0"
          data-testid="move-items"
          icon="i-lucide-folder-input"
          size="xl"
          class="h-14 flex-1 justify-center rounded-[1.25rem] font-extrabold"
          :style="{ background: 'var(--sb-ink)', color: 'var(--sb-on-ink)' }"
          @click="moveOpen = true"
        >
          Move {{ selectedIds.length }}
        </UButton>
        <UButton
          data-testid="add-item"
          icon="i-lucide-plus"
          size="xl"
          class="h-14 flex-[1.3] justify-center rounded-[1.25rem] font-extrabold"
          :style="{
            background: 'var(--c)',
            color: 'var(--c-on)',
            boxShadow: '0 14px 28px color-mix(in oklch, var(--c) 45%, transparent)'
          }"
          :to="`/box/${qrId}/item/new`"
        >
          Add item
        </UButton>
      </div>

      <UModal v-model:open="editOpen" title="Edit box">
        <template #body>
          <BoxForm :existing="box" :pending="updatePending" :error="updateError" @submit="onUpdateBox" />
        </template>
      </UModal>

      <DeleteConfirm
        v-model:open="deleteOpen"
        kind="box"
        :title="box.title || box.qr_id"
        :pending="deletePending"
        :error="deleteError"
        :blocked-reason="blockedDeleteReason"
        @confirm="onDelete"
      />

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
              size="xl"
              block
              class="justify-center rounded-[1.25rem] font-extrabold"
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
