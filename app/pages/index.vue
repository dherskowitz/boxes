<script setup lang="ts">
import type { BoxListFilters } from '~/queries/keys'

const { isOnline } = useOnline()

// The same queries and pure helpers /reports uses. If a figure ever differs
// between the two screens that is a bug, not a design — so there is no second
// reporting data layer here. `useGrowth()` is deliberately not called: the
// dashboard has no growth block, and fetching a view it never renders would
// cost a request on a phone for nothing.
const {
  data: boxFill,
  isPending: isBoxFillPending,
  isError: isBoxFillError,
  error: boxFillError,
  refetch: refetchBoxFill
} = useBoxFill()
const {
  data: tagUsage,
  isPending: isTagUsagePending,
  isError: isTagUsageError,
  error: tagUsageError,
  refetch: refetchTagUsage
} = useTagUsage()

const isFiguresPending = computed(() => isBoxFillPending.value || isTagUsagePending.value)
const isFiguresError = computed(() => isBoxFillError.value || isTagUsageError.value)
const figuresErrorMessage = computed(() => pbError(boxFillError.value ?? tagUsageError.value))

const totals = computed(() => reportTotals(boxFill.value, tagUsage.value))

// Items per box, top 5. Chosen over growth because it is the most actionable
// of the five: it answers "which boxes are crowded". Pre-sliced here rather
// than by a prop on ReportItemsPerBox — the component applies the same helper
// again, which is idempotent, and /reports keeps its top 10 untouched.
const topBoxes = computed(() => topBoxesByItems(boxFill.value, 5))

// PRD §7.10 as amended in v1.2: offline the aggregates come from cache and say
// so, rather than being replaced by a needs-connection wall. Conditional on the
// queries actually holding data — offline with nothing cached there is nothing
// stale to warn about, and the loading or error state stands on its own.
const hasCachedFigures = computed(
  () => boxFill.value !== undefined && tagUsage.value !== undefined
)

function retryFigures() {
  refetchBoxFill()
  refetchTagUsage()
}

// The recent-boxes block. Same filter shape BoxSection uses for its first
// active page, so both screens share one cache entry rather than issuing two
// near-identical requests.
const RECENT_LIMIT = 6
const recentFilters = computed<BoxListFilters>(() => ({ status: 'active', tagIds: [], page: 1 }))
const {
  data: recentData,
  isPending: isBoxesPending,
  isError: isBoxesError,
  error: boxesError
} = useBoxList(recentFilters)

const recentBoxes = computed(() => (recentData.value?.items ?? []).slice(0, RECENT_LIMIT))
const boxesErrorMessage = computed(() => pbError(boxesError.value))

const searchTerm = ref('')
function onSearchSubmit() {
  const term = searchTerm.value.trim()
  if (!term) return
  navigateTo({ path: '/search', query: { q: term } })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-lg font-medium">Dashboard</h1>
      <div class="flex items-center gap-3">
        <NuxtLink to="/print-sheet">Print sheet</NuxtLink>
        <UButton to="/box/new">New box</UButton>
      </div>
    </div>

    <SearchBar v-model="searchTerm" @submit="onSearchSubmit" />

    <section class="flex flex-col gap-3">
      <UAlert
        v-if="!isOnline && hasCachedFigures"
        color="warning"
        data-testid="dashboard-stale"
        title="These figures may be out of date"
        description="You're offline, so these are the numbers this device last loaded. Partial or stale aggregates can mislead — reconnect for the current picture."
      />

      <div
        v-if="isFiguresPending"
        data-testid="dashboard-loading"
        class="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <USkeleton v-for="n in 4" :key="n" class="h-20 w-full" />
      </div>

      <div v-else-if="isFiguresError" data-testid="dashboard-error" class="flex flex-col items-start gap-3">
        <UAlert color="error" title="Could not load your figures" :description="figuresErrorMessage" />
        <UButton data-testid="dashboard-retry" @click="retryFigures">Try again</UButton>
      </div>

      <template v-else>
        <ReportTotals :totals="totals" />
        <ReportItemsPerBox :box-fill="topBoxes" />
      </template>

      <NuxtLink to="/reports" data-testid="dashboard-reports-link">Full reports</NuxtLink>
    </section>

    <!-- Outside the staleness notice on purpose: a cached box list is the
         offline read v1 already promises and needs no apology. -->
    <section data-testid="recent-boxes" class="flex flex-col gap-3">
      <h2 class="font-medium">Recent boxes</h2>

      <div
        v-if="isBoxesPending"
        data-testid="recent-boxes-loading"
        class="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        <USkeleton v-for="n in 4" :key="n" class="h-40 w-full" />
      </div>

      <UAlert v-else-if="isBoxesError" color="error" :description="boxesErrorMessage" />

      <div
        v-else-if="recentBoxes.length === 0"
        data-testid="recent-boxes-empty"
        class="flex flex-col items-start gap-3"
      >
        <p>No boxes yet.</p>
        <UButton to="/box/new">Create your first box</UButton>
      </div>

      <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <BoxCard v-for="box in recentBoxes" :key="box.id" :box="box" />
      </div>

      <NuxtLink to="/boxes" data-testid="dashboard-boxes-link">All boxes</NuxtLink>
    </section>
  </div>
</template>
