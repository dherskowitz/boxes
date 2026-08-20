<script setup lang="ts">
/**
 * Tag filter chips. `v-model` is `string[]` of tag ids, the same shape
 * `BoxListFilters.tagIds` / `SearchFilters.tagIds` take, so a consumer binds
 * it straight to its filter object with no mapping.
 *
 * Selecting more than one narrows: `tagClauses()` AND-matches, so a record
 * must carry every selected tag.
 *
 * The colour dot is rendered from the tag's stored `color` via an inline
 * style — that is data, not styling, and is how `/tags` already draws it.
 */
const model = defineModel<string[]>({ default: () => [] })

const { data: tags, isPending } = useTags()

function isSelected(id: string): boolean {
  return model.value.includes(id)
}

function toggle(id: string) {
  model.value = isSelected(id) ? model.value.filter(t => t !== id) : [...model.value, id]
}
</script>

<template>
  <div v-if="isPending" data-testid="tag-filter-loading" class="flex flex-wrap gap-2">
    <USkeleton v-for="n in 4" :key="n" class="h-8 w-24" />
  </div>

  <!-- Nothing to filter by until the shared vocabulary has a tag in it, and an
       empty row of chips is only dead space on a phone. -->
  <div v-else-if="(tags ?? []).length > 0" class="flex flex-wrap items-center gap-2">
    <UButton
      v-for="tag in tags ?? []"
      :key="tag.id"
      size="sm"
      :variant="isSelected(tag.id) ? 'solid' : 'outline'"
      :aria-pressed="isSelected(tag.id)"
      :data-testid="`tag-filter-${tag.name}`"
      @click="toggle(tag.id)"
    >
      <span
        class="size-2 shrink-0 rounded-full"
        :style="tag.color ? { backgroundColor: tag.color } : undefined"
      />
      {{ tag.name }}
    </UButton>

    <UButton
      v-if="model.length > 0"
      size="sm"
      variant="ghost"
      data-testid="clear-tag-filter"
      @click="model = []"
    >
      Clear tags
    </UButton>
  </div>
</template>
