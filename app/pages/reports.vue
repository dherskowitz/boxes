<script setup lang="ts">
import { reportTotals } from '~/queries/reports'

const { isOnline } = useOnline()

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
const {
  data: growth,
  isPending: isGrowthPending,
  isError: isGrowthError,
  error: growthError,
  refetch: refetchGrowth
} = useGrowth()

const isPending = computed(() => isBoxFillPending.value || isTagUsagePending.value || isGrowthPending.value)
const isError = computed(() => isBoxFillError.value || isTagUsageError.value || isGrowthError.value)
const errorMessage = computed(() => pbError(boxFillError.value ?? tagUsageError.value ?? growthError.value))

const totals = computed(() => reportTotals(boxFill.value, tagUsage.value))

// PRD §7.10 (amended in v1.2): offline the figures are served from cache and
// carry a warning rather than being replaced by a needs-connection wall — the
// service worker already caches the `storage_report_*` views. The notice is
// deliberately conditional on the queries actually holding data: offline with
// nothing cached there is nothing stale to warn about, so the loading or error
// state stands on its own. A notice that is always there is one people stop
// reading.
const hasCachedFigures = computed(
  () => boxFill.value !== undefined && tagUsage.value !== undefined && growth.value !== undefined
)

function retry() {
  refetchBoxFill()
  refetchTagUsage()
  refetchGrowth()
}
</script>

<template>
  <div>
    <AppHeader title="Reports" eyebrow="What is where, and how much of it" back-to="/" />

    <div class="sb-body flex flex-col gap-5">
      <UAlert
        v-if="!isOnline && hasCachedFigures"
        color="warning"
        data-testid="reports-stale"
        title="These figures may be out of date"
        description="You're offline, so these are the numbers this device last loaded. Partial or stale aggregates can mislead — reconnect for the current picture."
      />

      <div v-if="isPending" data-testid="reports-loading" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <USkeleton v-for="n in 4" :key="n" class="h-20 w-full rounded-[1.25rem]" />
      </div>

      <div v-else-if="isError" data-testid="reports-error" class="flex flex-col items-start gap-3">
        <UAlert color="error" title="Could not load reports" :description="errorMessage" />
        <UButton data-testid="reports-retry" @click="retry">Try again</UButton>
      </div>

      <template v-else>
        <div class="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start">
          <ReportTotals :totals="totals" class="lg:col-span-2" />
          <ReportItemsPerBox :box-fill="boxFill ?? []" />
          <ReportLocations :box-fill="boxFill ?? []" />
          <ReportTagUsage :tag-usage="tagUsage ?? []" />
          <ReportGrowth :growth="growth ?? []" />
        </div>
      </template>
    </div>
  </div>
</template>
