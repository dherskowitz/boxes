<script setup lang="ts">
import type { ReportBoxFill } from '~/types/pocketbase'
import { topBoxesByItems } from '~/queries/reports'

const props = defineProps<{ boxFill: ReportBoxFill[] }>()

// Long titles (the seeded "Kitchen overflow: ..." box is 96 chars) break a
// bar chart's axis — truncate the label, keep the full title for the tooltip.
const MAX_LABEL_LENGTH = 28

function truncateLabel(title: string): string {
  return title.length > MAX_LABEL_LENGTH ? `${title.slice(0, MAX_LABEL_LENGTH - 1)}…` : title
}

interface Row {
  id: string
  label: string
  title: string
  item_count: number
}

const rows = computed<Row[]>(() =>
  topBoxesByItems(props.boxFill, 10).map(box => ({
    id: box.id,
    label: truncateLabel(box.title),
    title: box.title,
    item_count: box.item_count
  }))
)

const categories = { item_count: { name: 'Items' } }

function tooltipTitle(row: Row) {
  return row.title
}

// The category axis is index-based (Unovis positions bars by row index, not
// by the string field named in `x-axis`) — `x-formatter` maps each tick's
// index back to that row's truncated label, and `x-explicit-ticks` forces one
// tick per row rather than the library's default sparse numeric ticks.
function xFormatter(tick: number) {
  return rows.value[tick]?.label ?? ''
}

const xTicks = computed(() => rows.value.map((_, i) => i))
</script>

<template>
  <section>
    <h2 class="font-medium">Items per box</h2>
    <p v-if="rows.length === 0" data-testid="items-per-box-empty">
      No boxes yet.
    </p>
    <BarChart
      v-else
      data-testid="items-per-box-chart"
      :data="rows"
      :height="rows.length * 40 + 40"
      :categories="categories"
      :y-axis="['item_count']"
      x-axis="label"
      :orientation="Orientation.Horizontal"
      :tooltip-title-formatter="tooltipTitle"
      :x-formatter="xFormatter"
      :x-explicit-ticks="xTicks"
    />
  </section>
</template>
