<script setup lang="ts">
import { reportTotals } from '~/queries/reports'

// TODO(slice D): swap for `useOnline()` once it lands — this is the fallback
// named in the slice J plan, not a second online-detection mechanism to keep.
const isOnline = ref(navigator.onLine)
function updateOnlineStatus() {
  isOnline.value = navigator.onLine
}
onMounted(() => {
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
})
onUnmounted(() => {
  window.removeEventListener('online', updateOnlineStatus)
  window.removeEventListener('offline', updateOnlineStatus)
})

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

const isPending = computed(() => isBoxFillPending.value || isTagUsagePending.value)
const isError = computed(() => isBoxFillError.value || isTagUsageError.value)
const errorMessage = computed(() => pbError(boxFillError.value ?? tagUsageError.value))

const totals = computed(() => reportTotals(boxFill.value, tagUsage.value))

function retry() {
  refetchBoxFill()
  refetchTagUsage()
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-xl font-semibold">Reports</h1>

    <UAlert
      v-if="!isOnline"
      data-testid="reports-offline"
      title="You're offline"
      description="Reports need a live connection. Reconnect to see current figures — showing stale numbers here would be misleading."
    />

    <div v-else-if="isPending" data-testid="reports-loading" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <USkeleton v-for="n in 4" :key="n" class="h-20 w-full" />
    </div>

    <div v-else-if="isError" data-testid="reports-error" class="flex flex-col items-start gap-3">
      <UAlert title="Could not load reports" :description="errorMessage" />
      <UButton data-testid="reports-retry" @click="retry">Try again</UButton>
    </div>

    <template v-else>
      <ReportTotals :totals="totals" />
    </template>
  </div>
</template>
