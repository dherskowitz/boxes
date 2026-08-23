<script setup lang="ts">
import type { ReportBoxFill } from '~/types/pocketbase'
import { groupByLocation } from '~/queries/reports'

const props = defineProps<{ boxFill: ReportBoxFill[] }>()

const groups = computed(() => groupByLocation(props.boxFill))
const data = computed(() => groups.value.map(g => g.count))
const categories = computed(() =>
  Object.fromEntries(groups.value.map(g => [g.location, { name: `${g.location} (${g.count})` }]))
)

// The donut above groups every box (active and archived) by location, per
// spec §7.10 item 3 — but that merges archived boxes into their location's
// count with nothing to set them apart. This second, smaller donut is the
// "visually distinguished... status split" the spec calls for: the same
// `boxFill` rows, split by status instead of location.
const statusCounts = computed(() => {
  let active = 0
  let archived = 0
  for (const box of props.boxFill) {
    if (box.status === 'archived') archived += 1
    else active += 1
  }
  return { active, archived }
})
const statusData = computed(() => [statusCounts.value.active, statusCounts.value.archived])
const statusCategories = computed(() => ({
  active: { name: `Active (${statusCounts.value.active})` },
  archived: { name: `Archived (${statusCounts.value.archived})` }
}))
</script>

<template>
  <section class="sb-card flex flex-col gap-3 p-4">
    <h2 class="sb-mono" :style="{ color: 'var(--sb-muted)' }">Boxes by location</h2>
    <p v-if="groups.length === 0" data-testid="locations-empty">
      No boxes yet.
    </p>
    <template v-else>
      <DonutChart
        data-testid="locations-chart"
        :data="data"
        :categories="categories"
        :radius="80"
        :height="220"
      />
      <DonutChart
        data-testid="locations-status-chart"
        :data="statusData"
        :categories="statusCategories"
        :radius="50"
        :height="140"
      />
    </template>
  </section>
</template>
