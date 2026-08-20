<script setup lang="ts">
import type { ReportTagUsage } from '~/types/pocketbase'
import { topTagsByUsage } from '~/queries/reports'

const props = defineProps<{ tagUsage: ReportTagUsage[] }>()

interface Row {
  id: string
  name: string
  usage: number
}

const rows = computed<Row[]>(() =>
  topTagsByUsage(props.tagUsage, 10).map(tag => ({
    id: tag.id,
    name: tag.name,
    usage: tag.box_count + tag.item_count
  }))
)

const categories = { usage: { name: 'Boxes + items' } }

// Same index-based category axis as ReportItemsPerBox — see the comment
// there for why a formatter and explicit ticks are both required.
function xFormatter(tick: number) {
  return rows.value[tick]?.name ?? ''
}

const xTicks = computed(() => rows.value.map((_, i) => i))
</script>

<template>
  <section>
    <h2 class="font-medium">Tag usage</h2>
    <p v-if="rows.length === 0" data-testid="tag-usage-empty">
      No tags yet.
    </p>
    <BarChart
      v-else
      data-testid="tag-usage-chart"
      :data="rows"
      :height="rows.length * 40 + 40"
      :categories="categories"
      :y-axis="['usage']"
      x-axis="name"
      :orientation="Orientation.Horizontal"
      :x-formatter="xFormatter"
      :x-explicit-ticks="xTicks"
    />
  </section>
</template>
