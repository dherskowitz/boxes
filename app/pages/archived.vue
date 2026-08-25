<script setup lang="ts">
import type { BoxListFilters } from '~/queries/keys'

// Same as box detail, and for the same reason: the unarchive bar and the nav
// pill both want the bottom of the screen, and the pill wins on z-order — it
// sat over the button and swallowed the click. This screen has its own back
// chevron to More, so the pill is not the only way out.
definePageMeta({ nav: false })

/**
 * Archived boxes, with batch unarchive.
 *
 * `/boxes` can already *show* archived boxes behind a checkbox (PRD §7.2), but
 * only one at a time and only from each box's own screen. Putting a season's
 * worth of boxes back meant opening every one.
 *
 * Selection reuses the shape box detail uses for bulk-moving items — a mode
 * toggle, a checkbox per row and a floating count bar — rather than a swipe:
 * a swipe fights the vertical scroll on a phone, has no keyboard equivalent,
 * and unarchives one row at a time, which is not the batch that was asked for.
 */
const filters = computed<BoxListFilters>(() => ({ status: 'archived' }))
const {
  data,
  isPending,
  isError,
  error,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage
} = useInfiniteBoxList(filters)

const boxes = computed(() => (data.value?.pages ?? []).flatMap(page => page.items))
const totalItems = computed(() => data.value?.pages[0]?.totalItems ?? 0)
const errorMessage = computed(() => (error.value ? pbError(error.value) : ''))

const itemCounts = useBoxItemCounts()
function countFor(boxId: string): number {
  return itemCounts.value.get(boxId) ?? 0
}

const selectMode = ref(false)
const selectedIds = ref<string[]>([])

watch(selectMode, (on) => { if (!on) selectedIds.value = [] })

function toggle(id: string, selected: boolean) {
  selectedIds.value = selected
    ? [...selectedIds.value, id]
    : selectedIds.value.filter(existing => existing !== id)
}

const allSelected = computed(() =>
  boxes.value.length > 0 && selectedIds.value.length === boxes.value.length
)
function toggleAll() {
  selectedIds.value = allSelected.value ? [] : boxes.value.map(box => box.id)
}

const { mutateAsync: setStatuses, isPending: unarchivePending } = useSetBoxStatuses()
const unarchiveError = ref('')

async function onUnarchive() {
  unarchiveError.value = ''
  try {
    await setStatuses({ ids: selectedIds.value, status: 'active' })
    selectedIds.value = []
    selectMode.value = false
  } catch (e) {
    // Partial failures land here too, carrying their own "Updated 2 of 3".
    // A box someone lacks edit rights on is rejected by the API rule, and the
    // list refreshes either way so what did come back is visibly gone.
    unarchiveError.value = pbError(e)
  }
}
</script>

<template>
  <div>
    <AppHeader eyebrow="More" back-to="/more">
      <template #title>
        <h1 class="sb-display text-[30px]">Archived <br>boxes</h1>
        <p v-if="!isPending" class="text-sm opacity-85">
          {{ totalItems }} {{ totalItems === 1 ? 'box' : 'boxes' }} put away
        </p>
      </template>
    </AppHeader>

    <div class="sb-body flex flex-col gap-3 pb-32">
      <UAlert v-if="unarchiveError" color="error" data-testid="unarchive-error" :description="unarchiveError" />

      <div v-if="isPending" data-testid="archived-loading" class="grid gap-2.5 md:grid-cols-2">
        <USkeleton v-for="n in 5" :key="n" class="h-[68px] w-full rounded-[1.25rem]" />
      </div>

      <UAlert v-else-if="isError" color="error" data-testid="archived-error" :description="errorMessage" />

      <div
        v-else-if="boxes.length === 0"
        data-testid="archived-empty"
        class="flex flex-col items-center gap-5 px-2 py-10 text-center"
      >
        <div
          class="flex size-30 items-center justify-center rounded-[2.25rem]"
          :style="{ background: 'var(--sb-fill)', color: 'var(--sb-on-fill)' }"
        >
          <UIcon name="i-lucide-archive" class="size-14" aria-hidden="true" />
        </div>
        <div class="flex flex-col gap-2">
          <p class="sb-display text-[22px]">Nothing archived</p>
          <p class="text-sm" :style="{ color: 'var(--sb-muted)' }">
            Archive a box you have put into long-term storage and it waits here,
            out of the way but still searchable.
          </p>
        </div>
      </div>

      <template v-else>
        <div class="flex items-center justify-between gap-2">
          <UButton
            data-testid="toggle-select"
            size="sm"
            :variant="selectMode ? 'solid' : 'outline'"
            color="neutral"
            icon="i-lucide-check-square"
            @click="selectMode = !selectMode"
          >
            {{ selectMode ? 'Done' : 'Select' }}
          </UButton>
          <UButton
            v-if="selectMode"
            data-testid="select-all"
            size="sm"
            variant="ghost"
            color="neutral"
            @click="toggleAll"
          >
            {{ allSelected ? 'Clear all' : 'Select all' }}
          </UButton>
        </div>

        <ul class="grid gap-2.5 md:grid-cols-2">
          <li
            v-for="box in boxes"
            :key="box.id"
            data-testid="archived-box"
            class="sb-card flex items-center gap-3 p-3.5"
            :style="boxColorVars(box.qr_id)"
          >
            <UCheckbox
              v-if="selectMode"
              :model-value="selectedIds.includes(box.id)"
              :data-testid="`select-box-${box.qr_id}`"
              :aria-label="`Select ${box.title || box.qr_id}`"
              @update:model-value="value => toggle(box.id, value === true)"
            />
            <span
              class="size-11 shrink-0 rounded-[0.875rem]"
              :style="{ background: 'var(--c)' }"
              aria-hidden="true"
            />
            <NuxtLink :to="`/box/${box.qr_id}`" class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-[15px] font-extrabold">{{ box.title || box.qr_id }}</span>
              <span class="text-[11px] font-bold" :style="{ color: 'var(--sb-muted)' }">
                <template v-if="box.location">{{ box.location }} · </template>
                {{ countFor(box.id) }} {{ countFor(box.id) === 1 ? 'item' : 'items' }}
              </span>
            </NuxtLink>
          </li>
        </ul>

        <InfiniteList
          :has-more="hasNextPage"
          :loading="isFetchingNextPage"
          :total="totalItems"
          noun="archived boxes"
          @more="fetchNextPage()"
        />
      </template>
    </div>

    <!-- Sits above the safe area rather than in the page flow: it appears only
         with a selection, and a control that appears mid-list pushes the row
         you were about to tap out from under your thumb. -->
    <div
      v-if="selectMode && selectedIds.length > 0"
      data-testid="unarchive-bar"
      class="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 px-[1.375rem] pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom))]"
      :style="{ background: 'var(--sb-surface)', borderTop: '2px solid var(--sb-line)' }"
    >
      <span class="text-sm font-extrabold">{{ selectedIds.length }} selected</span>
      <UButton
        data-testid="unarchive-selected"
        icon="i-lucide-archive-restore"
        :loading="unarchivePending"
        @click="onUnarchive"
      >
        Unarchive
      </UButton>
    </div>
  </div>
</template>
