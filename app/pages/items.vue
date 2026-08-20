<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import type { ItemListFilters } from '~/queries/keys'
import { PER_PAGE } from '~/queries/keys'

const route = useRoute()
const router = useRouter()

function termFromRoute(): string {
  return typeof route.query.q === 'string' ? route.query.q : ''
}

// The term typed into the box, kept in sync with the URL both ways so a
// filtered list is linkable and survives a reload. Same pattern as /search.
const term = ref(termFromRoute())

watch(
  () => route.query.q,
  () => {
    const next = termFromRoute()
    if (next !== term.value) term.value = next
  }
)

// Debounced so a query does not fire per keystroke. The URL, not this ref, is
// what the query reads from.
watchDebounced(
  term,
  (value) => {
    router.replace({ query: { ...route.query, q: value || undefined } })
  },
  { debounce: 400 }
)

function tagIdsFromRoute(): string[] {
  const raw = route.query.tags
  return typeof raw === 'string' && raw !== '' ? raw.split(',') : []
}

// Tags live in the URL for the same reason the term does. The URL is the
// source of truth — no second ref to drift out of sync with it.
const tagIds = computed<string[]>({
  get: tagIdsFromRoute,
  set: (value) => {
    router.replace({ query: { ...route.query, tags: value.length > 0 ? value.join(',') : undefined } })
  }
})

const activeTerm = computed(termFromRoute)

// Narrowing while on page 3 would otherwise land on a page the filtered list
// no longer has, which reads as "nothing matches" when plenty does.
const page = ref(1)
watch([activeTerm, tagIds], () => {
  page.value = 1
})

// No box id: `itemFilter` then spans every box and excludes archived ones.
const filters = computed<ItemListFilters>(() => ({
  term: activeTerm.value,
  tagIds: tagIds.value,
  page: page.value
}))

const { data, isPending, isError, error } = useItemList(filters)

const items = computed(() => data.value?.items ?? [])
const totalItems = computed(() => data.value?.totalItems ?? 0)
const totalPages = computed(() => data.value?.totalPages ?? 1)
const errorMessage = computed(() => (error.value ? pbError(error.value) : ''))
const isFiltered = computed(() => activeTerm.value !== '' || tagIds.value.length > 0)
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-lg font-medium">Items</h1>

    <UFormField label="Search">
      <UInput
        v-model="term"
        class="w-full"
        placeholder="Search item titles, descriptions and notes"
        data-testid="items-search"
      />
    </UFormField>

    <!-- Mounted unconditionally, unlike on /search: here a blank term lists
         everything, so a chip on its own genuinely narrows the list. -->
    <TagFilter v-model="tagIds" />

    <div v-if="isPending" data-testid="items-loading" class="flex flex-col gap-2">
      <USkeleton v-for="n in 5" :key="n" class="h-16 w-full" />
    </div>

    <div v-else-if="isError" data-testid="items-error">
      <UAlert color="error" title="Could not load items" :description="errorMessage" />
    </div>

    <!-- Filtered-to-nothing and owning nothing are different problems with
         different fixes: one is solved by clearing a filter, the other by
         adding an item. Telling someone with 400 items that they have none is
         the failure this split exists to prevent. -->
    <div v-else-if="items.length === 0 && isFiltered" data-testid="items-no-matches">
      <p>Nothing matches these filters.</p>
    </div>

    <!-- No call-to-action button here on purpose: items are created inside a
         box, and slice D is moving the box index off `/`. A sentence that
         stays true beats a link that will point at the wrong page. -->
    <div v-else-if="items.length === 0" data-testid="items-empty">
      <p>No items yet. Add one to a box and it shows up here.</p>
    </div>

    <div v-else class="flex flex-col gap-2">
      <ItemCard v-for="item in items" :key="item.id" :item="item" show-box />
    </div>

    <UPagination
      v-if="totalPages > 1"
      v-model:page="page"
      :total="totalItems"
      :items-per-page="PER_PAGE"
    />
  </div>
</template>
