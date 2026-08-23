<script setup lang="ts">
import type { StorageTag } from '~/types/pocketbase'

/**
 * Tag filter chips. `v-model` is `string[]` of tag ids, the same shape
 * `BoxListFilters.tagIds` / `SearchFilters.tagIds` take, so a consumer binds
 * it straight to its filter object with no mapping.
 *
 * Selecting more than one narrows: `tagClauses()` AND-matches, so a record
 * must carry every selected tag.
 *
 * A chip is drawn in the tag's stored `color` via an inline style — that is
 * data, not styling, and is how `/tags` already draws it.
 */
const model = defineModel<string[]>({ default: () => [] })

const { data: tags, isPending, isError, error } = useTags()
const errorMessage = computed(() => (error.value ? pbError(error.value) : ''))

function isSelected(id: string): boolean {
  return model.value.includes(id)
}

function toggle(id: string) {
  model.value = isSelected(id) ? model.value.filter(t => t !== id) : [...model.value, id]
}

function chipStyle(tag: StorageTag): Record<string, string> {
  const color = tag.color || 'var(--sb-accent)'
  return isSelected(tag.id)
    // Not a hardcoded '#fff': the same green that needs dark ink in the picker
    // needs it here too.
    ? { background: color, color: readableInk(color), border: `2px solid ${color}` }
    : {
        background: 'var(--sb-surface)',
        border: `2px solid color-mix(in oklch, ${color} 55%, var(--sb-surface))`,
        color: `color-mix(in oklch, ${color} 80%, var(--sb-text))`
      }
}
</script>

<template>
  <div v-if="isPending" data-testid="tag-filter-loading" class="flex flex-wrap gap-2">
    <USkeleton v-for="n in 4" :key="n" class="h-8 w-24" />
  </div>

  <!-- Without this, a failed fetch leaves `tags` undefined and falls through
       to the empty branch — telling the user there is no tag vocabulary. -->
  <UAlert v-else-if="isError" color="error" title="Could not load tags" :description="errorMessage" />

  <!-- Nothing to filter by until the shared vocabulary has a tag in it, and an
       empty row of chips is only dead space on a phone. -->
  <div v-else-if="(tags ?? []).length > 0" class="flex flex-wrap items-center gap-2">
    <!-- Outlined in the tag's own stored colour rather than one shared
         accent, so a chip is recognisable before it is read. A tag with no
         stored colour falls back to the app accent. -->
    <button
      v-for="tag in tags ?? []"
      :key="tag.id"
      type="button"
      class="sb-chip cursor-pointer px-3.5 py-2 text-xs"
      :style="chipStyle(tag)"
      :aria-pressed="isSelected(tag.id)"
      :data-testid="`tag-filter-${tag.name}`"
      @click="toggle(tag.id)"
    >
      {{ tag.name }}
    </button>

    <button
      v-if="model.length > 0"
      type="button"
      class="cursor-pointer px-2 text-xs font-extrabold"
      :style="{ color: 'var(--sb-muted)' }"
      data-testid="clear-tag-filter"
      @click="model = []"
    >
      Clear tags
    </button>
  </div>
</template>
