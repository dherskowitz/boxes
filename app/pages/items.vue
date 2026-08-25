<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import type { ItemListFilters } from '~/queries/keys'

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

// No page ref: narrowing changes the query key, so the accumulated pages are
// dropped and the list starts again at the first — which is what a page
// counter had to be reset by hand to do.
//
// No box id: `itemFilter` then spans every box and excludes archived ones.
const filters = computed<ItemListFilters>(() => ({
  term: activeTerm.value,
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
} = useInfiniteItemList(filters)

const items = computed(() => (data.value?.pages ?? []).flatMap(page => page.items))
const totalItems = computed(() => data.value?.pages[0]?.totalItems ?? 0)
const errorMessage = computed(() => (error.value ? pbError(error.value) : ''))
const isFiltered = computed(() => activeTerm.value !== '' || tagIds.value.length > 0)
</script>

<template>
  <div>
    <AppHeader title="Items" eyebrow="Everything, across every box">
      <!-- The same pill the box index uses, filter control and all. It reads
           as one thing across the app rather than two ways of narrowing a
           list that happen to look different. -->
      <SearchBar v-model="term" v-model:tags="tagIds" filterable @submit="() => {}" />
    </AppHeader>

    <div class="sb-body flex flex-col gap-4">
      <div v-if="isPending" data-testid="items-loading" class="grid gap-2 md:grid-cols-2">
        <USkeleton v-for="n in 5" :key="n" class="h-[72px] w-full rounded-[1.25rem]" />
      </div>

      <div v-else-if="isError" data-testid="items-error">
        <UAlert color="error" title="Could not load items" :description="errorMessage" />
      </div>

      <!-- Filtered-to-nothing and owning nothing are different problems with
           different fixes: one is solved by clearing a filter, the other by
           adding an item. Telling someone with 400 items that they have none is
           the failure this split exists to prevent. -->
      <div
        v-else-if="items.length === 0"
        :data-testid="isFiltered ? 'items-no-matches' : 'items-empty'"
        class="flex flex-col items-center gap-4 px-2 py-12 text-center"
      >
        <div
          class="flex size-24 items-center justify-center rounded-[2rem]"
          :style="{ background: 'var(--sb-fill)', color: 'var(--sb-on-fill)' }"
        >
          <UIcon :name="isFiltered ? 'i-lucide-filter-x' : 'i-lucide-list-plus'" class="size-11" aria-hidden="true" />
        </div>
        <!-- No call-to-action here on purpose: items are created inside a box,
             so a button would have to guess which one. -->
        <p class="text-sm" :style="{ color: 'var(--sb-muted)' }">
          <template v-if="isFiltered">Nothing matches these filters.</template>
          <template v-else>No items yet. Add one to a box and it shows up here.</template>
        </p>
      </div>

      <div v-else class="grid gap-[9px] md:grid-cols-2">
        <ItemCard v-for="item in items" :key="item.id" :item="item" show-box />
      </div>

      <InfiniteList
        v-if="items.length > 0"
        :has-more="hasNextPage"
        :loading="isFetchingNextPage"
        :total="totalItems"
        noun="items"
        @more="fetchNextPage()"
      />
    </div>
  </div>
</template>
