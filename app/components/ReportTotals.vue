<script setup lang="ts">
import type { ReportTotalsResult } from '~/queries/reports'

const props = defineProps<{ totals: ReportTotalsResult }>()

const tiles = computed(() => [
  { key: 'boxes', label: 'Boxes', value: props.totals.boxes },
  { key: 'items', label: 'Items', value: props.totals.items },
  { key: 'tags', label: 'Tags', value: props.totals.tags },
  { key: 'photos', label: 'Photos', value: props.totals.photos }
])
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <UCard v-for="tile in tiles" :key="tile.key">
      <div class="text-sm">{{ tile.label }}</div>
      <div class="text-2xl font-semibold" :data-testid="`total-${tile.key}`">{{ tile.value }}</div>
    </UCard>
  </div>
</template>
