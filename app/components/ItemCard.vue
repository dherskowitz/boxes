<script setup lang="ts">
import type { StorageItem } from '~/types/pocketbase'

const props = defineProps<{
  item: StorageItem
  selectable?: boolean
  selected?: boolean
  /**
   * Show the parent box under the title. Off by default: box detail already
   * knows which box it is showing. /items lists across boxes, where a row
   * without its box says nothing, and passes it on.
   *
   * Needs the record to have been fetched with `expand: 'box'`; without it
   * nothing is rendered rather than an "In" with nothing after it.
   */
  showBox?: boolean
}>()

const emit = defineEmits<{ 'update:selected': [value: boolean] }>()

const { $pb } = useNuxtApp()

const thumbnailUrl = computed(() => {
  const [first] = props.item.images
  if (!first) return null
  return $pb.files.getURL(props.item, first, { thumb: '100x100' })
})

const boxLabel = computed(() => {
  if (!props.showBox) return ''
  const box = props.item.expand?.box
  return box ? box.title || box.qr_id : ''
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
      <div class="flex flex-col gap-1">
        <span>{{ item.title }}</span>
        <span v-if="boxLabel" data-testid="item-card-box" class="text-sm">In {{ boxLabel }}</span>
      </div>
    </NuxtLink>
  </div>
</template>
