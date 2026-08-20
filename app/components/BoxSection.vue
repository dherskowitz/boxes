<script setup lang="ts">
import type { BoxStatus } from '~/types/pocketbase'
import type { BoxListFilters } from '~/queries/keys'
import { PER_PAGE } from '~/queries/keys'

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

const page = ref(1)
const tagIds = computed(() => props.tagIds ?? [])
// Narrowing the filter while on page 3 would otherwise land on a page the
// filtered list no longer has, which reads as "no matches" when there are.
watch(tagIds, () => { page.value = 1 })

const filters = computed<BoxListFilters>(() => ({
  status: props.status,
  tagIds: tagIds.value,
  page: page.value
}))

const { data, isPending, isError, error } = useBoxList(filters)

const boxes = computed(() => data.value?.items ?? [])
const totalItems = computed(() => data.value?.totalItems ?? 0)
const totalPages = computed(() => data.value?.totalPages ?? 1)
const errorMessage = computed(() => (error.value ? pbError(error.value) : ''))
</script>

<template>
  <section :data-testid="`box-section-${status}`" class="flex flex-col gap-3">
    <h2 class="font-medium">{{ heading }}</h2>

    <div
      v-if="isPending"
      :data-testid="`box-list-loading-${status}`"
      class="grid grid-cols-2 gap-3 sm:grid-cols-3"
    >
      <USkeleton v-for="n in 6" :key="n" class="h-40 w-full" />
    </div>

    <UAlert v-else-if="isError" :description="errorMessage" />

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
      class="flex flex-col items-start gap-3"
    >
      <p>{{ emptyMessage }}</p>
      <UButton v-if="status === 'active'" to="/box/new">Create your first box</UButton>
    </div>

    <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <BoxCard v-for="box in boxes" :key="box.id" :box="box" />
    </div>

    <UPagination
      v-if="totalPages > 1"
      v-model:page="page"
      :total="totalItems"
      :items-per-page="PER_PAGE"
    />
  </section>
</template>
