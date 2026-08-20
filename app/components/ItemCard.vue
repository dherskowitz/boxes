<script setup lang="ts">
import type { StorageItem } from '~/types/pocketbase'

const props = defineProps<{
  item: StorageItem
  selectable?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{ 'update:selected': [value: boolean] }>()

const { $pb } = useNuxtApp()

const thumbnailUrl = computed(() => {
  const [first] = props.item.images
  if (!first) return null
  return $pb.files.getURL(props.item, first, { thumb: '100x100' })
})

function onToggle(value: boolean | 'indeterminate') {
  emit('update:selected', value === true)
}
</script>

<template>
  <div data-testid="item-row" class="flex items-center gap-3 border p-3">
    <UCheckbox
      v-if="selectable"
      :model-value="selected"
      data-testid="item-select"
      @update:model-value="onToggle"
    />
    <NuxtLink :to="`/item/${item.id}`" data-testid="item-card" class="flex flex-1 items-center gap-3">
      <img v-if="thumbnailUrl" :src="thumbnailUrl" :alt="item.title" class="h-12 w-12 object-cover">
      <div v-else class="flex h-12 w-12 items-center justify-center border">
        <span class="text-xs">No photo</span>
      </div>
      <span>{{ item.title }}</span>
    </NuxtLink>
  </div>
</template>
