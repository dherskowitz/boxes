<script setup lang="ts">
import type { ReportTotalsResult } from '~/queries/reports'

const props = defineProps<{
  totals: ReportTotalsResult
  /**
   * Link each tile to the screen that lists what it counts. Off by default:
   * on /reports the tiles sit among four charts that are not navigation, and
   * a row where only the first block is clickable is worse than one where
   * none of it is.
   */
  linked?: boolean
}>()

// `to: null` for photos on purpose — there is no screen that lists photos, and
// a tile that links somewhere unrelated is worse than one that does not link.
const tiles = computed(() => [
  { key: 'boxes', label: 'Boxes', value: props.totals.boxes, to: '/boxes', icon: 'i-lucide-boxes' },
  { key: 'items', label: 'Items', value: props.totals.items, to: '/items', icon: 'i-lucide-list' },
  { key: 'tags', label: 'Tags', value: props.totals.tags, to: '/tags', icon: 'i-lucide-tag' },
  { key: 'photos', label: 'Photos', value: props.totals.photos, to: null, icon: 'i-lucide-image' }
])
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <!-- Value first and biggest: the design's rule is that the number is the
         content and the label is the caption, never the other way round. -->
    <template v-for="tile in tiles" :key="tile.key">
      <!-- Two branches rather than a `<component :is>`: a dynamic `is` does
           not resolve `NuxtLink` by name here, and silently renders a literal
           `<nuxtlink>` element that looks right and navigates nowhere. -->
      <NuxtLink
        v-if="linked && tile.to"
        :to="tile.to"
        class="sb-card relative flex flex-col gap-0.5 p-4 transition-colors hover:border-(--sb-accent)"
      >
        <span class="sb-display text-[28px]" :data-testid="`total-${tile.key}`">{{ tile.value }}</span>
        <span class="sb-mono" :style="{ color: 'var(--sb-muted)' }">{{ tile.label }}</span>
        <UIcon
          name="i-lucide-arrow-up-right"
          class="absolute top-3 right-3 size-4"
          :style="{ color: 'var(--sb-muted)' }"
          aria-hidden="true"
        />
      </NuxtLink>

      <div v-else class="sb-card flex flex-col gap-0.5 p-4">
        <span class="sb-display text-[28px]" :data-testid="`total-${tile.key}`">{{ tile.value }}</span>
        <span class="sb-mono" :style="{ color: 'var(--sb-muted)' }">{{ tile.label }}</span>
      </div>
    </template>
  </div>
</template>
