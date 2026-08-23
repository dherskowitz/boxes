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
  <div>
    <AppHeader>
      <template #title>
        <!-- `filterable` only once there is a term: `searchFilter` short-circuits
             a blank term to `1 = 2` before the tag clauses, so a tag chosen on
             the idle screen would be a control that visibly does nothing. -->
        <SearchBar
          v-model="term"
          v-model:tags="tagIds"
          :filterable="hasTerm"
          @submit="() => {}"
        />
      </template>
    </AppHeader>

    <div class="sb-body flex flex-col gap-4">
      <div v-if="!hasTerm" data-testid="search-idle" class="flex flex-col items-center gap-4 px-2 py-12 text-center">
        <div
          class="flex size-24 items-center justify-center rounded-[2rem]"
          :style="{ background: 'var(--sb-fill)', color: 'var(--sb-on-fill)' }"
        >
          <UIcon name="i-lucide-search" class="size-11" aria-hidden="true" />
        </div>
        <p class="text-sm" :style="{ color: 'var(--sb-muted)' }">
          Search box titles, item titles, item descriptions and item notes.
        </p>
      </div>

      <div v-else-if="isPending" data-testid="search-loading" class="flex flex-col gap-3">
        <USkeleton v-for="n in 4" :key="n" class="h-[76px] w-full rounded-[1.25rem]" />
      </div>

      <UAlert v-else-if="isError" color="error" :description="errorMessage" />

      <!-- A term that matches nothing and a term narrowed away by the tag
           filter need different advice: the second is fixed by clearing a tag,
           not by retyping. -->
      <div
        v-else-if="results.length === 0"
        :data-testid="tagIds.length > 0 ? 'search-no-results-filtered' : 'search-no-results'"
        class="flex flex-col items-center gap-5 px-2 py-10 text-center"
      >
        <div
          class="flex size-28 items-center justify-center rounded-[2.125rem]"
          :style="{ background: 'var(--sb-fill)', color: 'var(--sb-on-fill)' }"
        >
          <UIcon name="i-lucide-search-x" class="size-13" aria-hidden="true" />
        </div>
        <div class="flex flex-col gap-2">
          <p class="sb-display text-[22px]">Nothing matched</p>
          <p class="text-sm" :style="{ color: 'var(--sb-muted)' }">
            <template v-if="tagIds.length > 0">
              No results for "{{ activeTerm }}" with the selected tags.
            </template>
            <template v-else>
              No results for "{{ activeTerm }}".
            </template>
          </p>
        </div>
        <UButton v-if="tagIds.length > 0" size="xl" block color="neutral" variant="outline" @click="tagIds = []">
          Search all tags instead
        </UButton>
      </div>

      <SearchResultList v-else :results="results" :term="activeTerm" />
    </div>
  </div>
</template>
