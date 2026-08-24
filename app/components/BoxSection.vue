<script setup lang="ts">
import type { BoxStatus } from '~/types/pocketbase'
import type { BoxListFilters } from '~/queries/keys'

// One status per section. PRD §7.2 wants archived boxes *included* alongside
// the active ones, and BoxListFilters.status only ever selects one status —
// so the index mounts this twice rather than merging two paginated lists into
// one page counter that could not be honest about either.
const props = defineProps<{
  status: BoxStatus
  heading: string
  emptyMessage: string
  /** Tag ids; a box shows only if it carries all of them. */
  tagIds?: string[]
}>()

const tagIds = computed(() => props.tagIds ?? [])

// No page ref: narrowing the filter changes the query key, so the accumulated
// pages are dropped and the list starts again from the first — which is what
// you want, and what a page counter had to be reset by hand to achieve.
const filters = computed<BoxListFilters>(() => ({
  status: props.status,
  tagIds: tagIds.value
}))

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
// From the first page's envelope: every page carries the same total.
const totalItems = computed(() => data.value?.pages[0]?.totalItems ?? 0)
const errorMessage = computed(() => (error.value ? pbError(error.value) : ''))
</script>

<template>
  <section :data-testid="`box-section-${status}`" class="flex flex-col gap-3">
    <!-- A heading over an empty section labels nothing. Kept while loading so
         it does not appear, vanish and come back as the query settles. -->
    <h2
      v-if="isPending || boxes.length > 0"
      class="sb-mono"
      :style="{ color: 'var(--sb-muted)' }"
    >{{ heading }}</h2>

    <div
      v-if="isPending"
      :data-testid="`box-list-loading-${status}`"
      class="flex flex-col gap-[11px]"
    >
      <USkeleton v-for="n in 6" :key="n" class="h-[108px] w-full rounded-[1.25rem]" />
    </div>

    <UAlert v-else-if="isError" color="error" :description="errorMessage" />

    <!-- A filter that matches nothing is not the same as owning no boxes:
         "create your first box" is wrong advice when the list is merely too
         narrow, so the two states carry different testids and different copy. -->
    <div
      v-else-if="boxes.length === 0 && tagIds.length > 0"
      :data-testid="`box-list-no-matches-${status}`"
    >
      <p>No {{ status }} boxes carry all of the selected tags.</p>
    </div>

    <div
      v-else-if="boxes.length === 0"
      :data-testid="`box-list-empty-${status}`"
      class="flex min-h-[58vh] flex-col items-center justify-center gap-5 px-2 py-10 text-center"
    >
      <div
        class="flex size-30 items-center justify-center rounded-[2.25rem] text-white"
        :style="{ background: 'var(--sb-accent)', boxShadow: '0 18px 36px oklch(0.55 0.21 292 / .35)' }"
      >
        <UIcon name="i-lucide-package-open" class="size-14" aria-hidden="true" />
      </div>
      <div class="flex flex-col gap-2">
        <p class="sb-display text-[22px]">
          {{ status === 'active' ? 'Start with one box' : 'Nothing archived' }}
        </p>
        <p class="text-sm" :style="{ color: 'var(--sb-muted)' }">{{ emptyMessage }}</p>
      </div>
      <div v-if="status === 'active'" class="flex w-full flex-col gap-2.5">
        <UButton to="/box/new" size="xl" block icon="i-lucide-plus">Create your first box</UButton>
        <UButton to="/scan" size="xl" block color="neutral" variant="outline" icon="i-lucide-qr-code">
          I have a QR label to scan
        </UButton>
      </div>
    </div>

    <div v-else class="flex flex-col gap-[11px]">
      <BoxCard v-for="box in boxes" :key="box.id" :box="box" />
    </div>

    <InfiniteList
      v-if="boxes.length > 0"
      :has-more="hasNextPage"
      :loading="isFetchingNextPage"
      :total="totalItems"
      noun="boxes"
      @more="fetchNextPage()"
    />
  </section>
</template>
