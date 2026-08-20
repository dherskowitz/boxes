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

// Tags live in the URL for the same reason the term does: a filtered search
// has to be linkable and survive a reload. The URL is the source of truth —
// there is no second ref to drift out of sync with it.
function tagIdsFromRoute(): string[] {
  const raw = route.query.tags
  return typeof raw === 'string' && raw !== '' ? raw.split(',') : []
}

const tagIds = computed<string[]>({
  get: tagIdsFromRoute,
  set: (value) => {
    router.replace({ query: { ...route.query, tags: value.length > 0 ? value.join(',') : undefined } })
  }
})

const activeTerm = computed(termFromRoute)
const filters = computed<SearchFilters>(() => ({ term: activeTerm.value, tagIds: tagIds.value }))

const { results, hasTerm, isPending, isError, error } = useSearch(filters)
const errorMessage = computed(() => (error.value ? pbError(error.value) : ''))
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-lg font-medium">Search</h1>

    <SearchBar v-model="term" @submit="() => {}" />

    <!-- Only once there is a term: `searchFilter` short-circuits a blank term
         to `1 = 2` before the tag clauses, so a chip selected on the idle
         screen would be a control that visibly does nothing. -->
    <TagFilter v-if="hasTerm" v-model="tagIds" />

    <div v-if="!hasTerm" data-testid="search-idle">
      <p>Search box titles, item titles, item descriptions and item notes.</p>
    </div>

    <div v-else-if="isPending" data-testid="search-loading" class="flex flex-col gap-3">
      <USkeleton v-for="n in 4" :key="n" class="h-16 w-full" />
    </div>

    <UAlert v-else-if="isError" color="error" :description="errorMessage" />

    <!-- A term that matches nothing and a term narrowed away by the tag
         filter need different advice: the second is fixed by clearing a tag,
         not by retyping. The original three states are untouched. -->
    <div v-else-if="results.length === 0 && tagIds.length > 0" data-testid="search-no-results-filtered">
      <p>No results for "{{ activeTerm }}" with the selected tags.</p>
    </div>

    <div v-else-if="results.length === 0" data-testid="search-no-results">
      <p>No results for "{{ activeTerm }}".</p>
    </div>

    <SearchResultList v-else :results="results" />
  </div>
</template>
