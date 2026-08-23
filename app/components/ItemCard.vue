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
  /**
   * 'row' stacks full-width rows and gives the title room; 'grid' packs two
   * per line and leads with the photo. Which is better depends on the box —
   * "twelve near-identical cables" reads as a list, "the good crockery" reads
   * as pictures — so box detail lets the reader choose.
   */
  layout?: 'row' | 'grid'
}>()

const emit = defineEmits<{ 'update:selected': [value: boolean] }>()

const { $pb } = useNuxtApp()

const isGrid = computed(() => props.layout === 'grid')

// A grid tile is roughly twice the width of a row thumbnail, so it asks for a
// bigger crop; a row asking for the larger one would waste bytes on a phone.
const thumbnailUrl = computed(() => {
  const [first] = props.item.images
  if (!first) return null
  return $pb.files.getURL(props.item, first, { thumb: isGrid.value ? '400x400' : '100x100' })
})

const boxLabel = computed(() => {
  if (!props.showBox) return ''
  const box = props.item.expand?.box
  return box ? box.title || box.qr_id : ''
})

// `--c` is inherited from whatever set it up the tree — box detail scopes its
// list to that box's colour. On /items nothing sets it, so a row falls back to
// the item's own box where it was expanded, and to ink where it was not.
const vars = computed(() => {
  const box = props.item.expand?.box
  return box ? boxColorVars(box.qr_id) : {}
})

const { data: tags } = useTags()
const tagNames = computed(() =>
  props.item.tags
    .map(id => (tags.value ?? []).find(t => t.id === id)?.name)
    .filter((name): name is string => Boolean(name))
)

function onToggle(value: boolean | 'indeterminate') {
  emit('update:selected', value === true)
}
</script>

<template>
  <!-- Grid: photo first, title under it, the checkbox floated over the corner
       because there is no room for a column of its own. -->
  <div
    v-if="isGrid"
    data-testid="item-row"
    class="relative h-full"
    :style="vars"
  >
    <!-- `h-full` on both: the grid stretches this wrapper to the tallest card
         in the row, but the card itself is the link inside it, and without
         the second one that link stays the height of its own text — which is
         what left one card in a pair short whenever its neighbour ran to two
         title lines or a second row of tags. -->
    <NuxtLink
      :to="`/item/${item.id}`"
      data-testid="item-card"
      class="flex h-full flex-col overflow-hidden"
      :class="selected ? 'sb-card-tinted' : 'sb-card'"
      :style="selected ? { borderColor: 'var(--c)' } : {}"
    >
      <img
        v-if="thumbnailUrl"
        :src="thumbnailUrl"
        :alt="item.title"
        class="aspect-square w-full object-cover"
      >
      <div
        v-else
        class="flex aspect-square w-full items-center justify-center"
        :style="
          selected
            ? { background: 'var(--c)', color: 'var(--c-on)' }
            : { background: 'var(--sb-fill)', color: 'var(--sb-on-fill)' }
        "
      >
        <UIcon name="i-lucide-package" class="size-10" aria-hidden="true" />
      </div>

      <div class="flex min-w-0 flex-col gap-1 p-2.5">
        <span class="line-clamp-2 text-[13px] leading-tight font-extrabold">{{ item.title }}</span>
        <span
          v-if="boxLabel"
          data-testid="item-card-box"
          class="truncate text-[11px] font-bold"
          :style="{ color: 'var(--sb-muted)' }"
        >In {{ boxLabel }}</span>
        <div v-if="tagNames.length" class="flex flex-wrap gap-1">
          <span v-for="name in tagNames" :key="name" class="sb-chip sb-chip-outline">{{ name }}</span>
        </div>
      </div>
    </NuxtLink>

    <!-- Outside the link, over it: a checkbox nested in an anchor toggles the
         navigation instead of the selection. -->
    <UCheckbox
      v-if="selectable"
      :model-value="selected"
      data-testid="item-select"
      size="lg"
      class="absolute top-2 left-2 z-10 rounded-md p-1"
      :style="{ background: 'var(--sb-surface)' }"
      @update:model-value="onToggle"
    />
  </div>

  <div
    v-else
    data-testid="item-row"
    class="flex items-center gap-[11px] p-[10px]"
    :class="selected ? 'sb-card-tinted' : 'sb-card'"
    :style="[vars, selected ? { borderColor: 'var(--c)' } : {}]"
  >
    <UCheckbox
      v-if="selectable"
      :model-value="selected"
      data-testid="item-select"
      size="lg"
      @update:model-value="onToggle"
    />

    <NuxtLink :to="`/item/${item.id}`" data-testid="item-card" class="flex min-w-0 flex-1 items-center gap-[11px]">
      <img
        v-if="thumbnailUrl"
        :src="thumbnailUrl"
        :alt="item.title"
        class="size-13 shrink-0 rounded-[14px] object-cover"
      >
      <div
        v-else
        class="flex size-13 shrink-0 items-center justify-center rounded-[14px]"
        :style="
          selected
            ? { background: 'var(--c)', color: 'var(--c-on)' }
            : { background: 'var(--sb-fill)', color: 'var(--sb-on-fill)' }
        "
      >
        <UIcon name="i-lucide-package" class="size-6" aria-hidden="true" />
      </div>

      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="text-base font-extrabold">{{ item.title }}</span>
        <span
          v-if="boxLabel"
          data-testid="item-card-box"
          class="text-[11px] font-bold"
          :style="{ color: 'var(--sb-muted)' }"
        >In {{ boxLabel }}</span>
        <div v-if="tagNames.length" class="flex flex-wrap gap-1.5">
          <span v-for="name in tagNames" :key="name" class="sb-chip sb-chip-outline">{{ name }}</span>
        </div>
      </div>
    </NuxtLink>
  </div>
</template>
