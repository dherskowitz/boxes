<script setup lang="ts">
import type { ReportGrowth } from '~/types/pocketbase'

const props = defineProps<{ growth: ReportGrowth[] }>()

const categories = { boxes_created: { name: 'Boxes' }, items_created: { name: 'Items' } }

// Same index-based category axis quirk as the bar charts (see
// ReportItemsPerBox): the month label has to come from a formatter keyed by
// tick index, with one explicit tick forced per row.
function monthFormatter(tick: number) {
  return props.growth[tick]?.month ?? ''
}

const monthTicks = computed(() => props.growth.map((_, i) => i))
</script>

<template>
  <section class="sb-card flex flex-col gap-3 p-4">
    <h2 class="sb-mono" :style="{ color: 'var(--sb-muted)' }">Growth</h2>
    <p v-if="growth.length === 0" data-testid="growth-empty">
      No history yet.
    </p>
    <!-- An area chart with a single point renders as nothing — the seeded
         fixture has exactly one month, since every record was created on the
         same day. Bar it instead and say so, rather than shipping a chart
         that's blank on the fixture and only looks right with real history. -->
    <template v-else-if="growth.length === 1">
      <p data-testid="growth-single-month">
        Not enough history yet to chart growth over time — showing the one month on record.
      </p>
      <BarChart
        data-testid="growth-chart"
        :data="growth"
        :height="200"
        :categories="categories"
        :y-axis="['boxes_created', 'items_created']"
        x-axis="month"
        :x-formatter="monthFormatter"
        :x-explicit-ticks="monthTicks"
      />
    </template>
    <AreaChart
      v-else
      data-testid="growth-chart"
      :data="growth"
      :height="200"
      :categories="categories"
      :x-formatter="monthFormatter"
      :x-explicit-ticks="monthTicks"
    />
  </section>
</template>
