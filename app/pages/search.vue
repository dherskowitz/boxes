<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import type { SearchFilters } from '~/queries/keys'

const route = useRoute()
const router = useRouter()

function termFromRoute(): string {
  return typeof route.query.q === 'string' ? route.query.q : ''
}

// The term typed into the box, kept in sync with the URL both ways so a
// search is linkable and survives a reload.
const term = ref(termFromRoute())

watch(
  () => route.query.q,
  () => {
    const next = termFromRoute()
    if (next !== term.value) term.value = next
  }
)

// Debounced so a query does not fire per keystroke. The URL, not this ref, is
// the source of truth the query reads from.
watchDebounced(
  term,
  (value) => {
    router.replace({ query: { ...route.query, q: value || undefined } })
  },
  { debounce: 400 }
)

const activeTerm = computed(termFromRoute)
const filters = computed<SearchFilters>(() => ({ term: activeTerm.value }))

const { results, hasTerm, isPending, isError, error } = useSearch(filters)
const errorMessage = computed(() => (error.value ? pbError(error.value) : ''))
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-lg font-medium">Search</h1>

    <SearchBar v-model="term" @submit="() => {}" />

    <div v-if="!hasTerm" data-testid="search-idle">
      <p>Search box titles, item titles, item descriptions and item notes.</p>
    </div>

    <div v-else-if="isPending" data-testid="search-loading" class="flex flex-col gap-3">
      <USkeleton v-for="n in 4" :key="n" class="h-16 w-full" />
    </div>

    <UAlert v-else-if="isError" :description="errorMessage" />

    <div v-else-if="results.length === 0" data-testid="search-no-results">
      <p>No results for "{{ activeTerm }}".</p>
    </div>

    <SearchResultList v-else :results="results" />
  </div>
</template>
