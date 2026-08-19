<script setup lang="ts">
import type { BoxListFilters } from '~/queries/keys'
import { PER_PAGE } from '~/queries/keys'

const showArchived = ref(false)
const page = ref(1)

// BoxListFilters.status only ever selects one status, so "show archived"
// swaps the list to archived-only rather than merging the two — there is no
// "both" option in the shared filter contract.
const filters = computed<BoxListFilters>(() => ({
  status: showArchived.value ? 'archived' : 'active',
  page: page.value
}))

const { data, isPending, isError, error } = useBoxList(filters)

const boxes = computed(() => data.value?.items ?? [])
const totalItems = computed(() => data.value?.totalItems ?? 0)
const totalPages = computed(() => data.value?.totalPages ?? 1)
const errorMessage = computed(() => (error.value ? pbError(error.value) : ''))

watch(showArchived, () => {
  page.value = 1
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-lg font-medium">Boxes</h1>
      <div class="flex items-center gap-3">
        <NuxtLink to="/print-sheet">Print sheet</NuxtLink>
        <UButton to="/box/new">New box</UButton>
      </div>
    </div>

    <UCheckbox v-model="showArchived" data-testid="show-archived" label="Show archived boxes" />

    <div v-if="isPending" data-testid="box-list-loading" class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <USkeleton v-for="n in 6" :key="n" class="h-40 w-full" />
    </div>

    <UAlert v-else-if="isError" :description="errorMessage" />

    <div v-else-if="boxes.length === 0" data-testid="box-list-empty" class="flex flex-col items-start gap-3">
      <p>{{ showArchived ? 'No archived boxes.' : 'No boxes yet.' }}</p>
      <UButton v-if="!showArchived" to="/box/new">Create your first box</UButton>
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
  </div>
</template>
