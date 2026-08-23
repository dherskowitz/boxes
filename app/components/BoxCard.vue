<script setup lang="ts">
import type { StorageBox } from '~/types/pocketbase'

const props = defineProps<{ box: StorageBox }>()

// `title` has no schema default and the seed data leaves some boxes titleless
// — fall back to the printed qr_id so a card is never blank.
const displayTitle = computed(() => props.box.title || props.box.qr_id)

const vars = computed(() => boxColorVars(props.box.qr_id))

const itemCounts = useBoxItemCounts()
const itemCount = computed(() => itemCounts.value.get(props.box.id))

const { data: tags } = useTags()
const tagNames = computed(() =>
  props.box.tags
    .map(id => (tags.value ?? []).find(t => t.id === id)?.name)
    .filter((name): name is string => Boolean(name))
)
</script>

<template>
  <NuxtLink
    :to="`/box/${box.qr_id}`"
    data-testid="box-card"
    class="sb-card-tinted flex gap-3 p-[11px]"
    :style="vars"
  >
    <!-- The box's own colour, never a photo. A picture of a sealed cardboard
         box says nothing; the colour is what makes a card findable at a glance,
         and it matches the band printed on the label stuck to the real thing. -->
    <div
      class="flex size-[84px] shrink-0 items-center justify-center rounded-[18px]"
      :style="{ background: 'var(--c)', color: 'var(--c-on)' }"
    >
      <span class="flex size-13 items-center justify-center rounded-full bg-white/25">
        <UIcon name="i-lucide-package" class="size-6" aria-hidden="true" />
      </span>
    </div>

    <div class="flex min-w-0 flex-1 flex-col gap-[7px]">
      <!-- Two lines, then an ellipsis. A title someone typed a paragraph into
           should not be allowed to push the location and tags off the card. -->
      <span class="sb-display line-clamp-2 text-[19px] tracking-[-0.02em]">{{ displayTitle }}</span>

      <span v-if="box.location" class="sb-on-tint flex items-center gap-1.5 text-xs font-bold">
        <UIcon name="i-lucide-map-pin" class="size-[13px] shrink-0" aria-hidden="true" />
        {{ box.location }}
      </span>

      <div class="flex flex-wrap items-center gap-1.5">
        <span v-if="itemCount !== undefined" class="sb-chip sb-chip-solid">
          {{ itemCount }} {{ itemCount === 1 ? 'item' : 'items' }}
        </span>
        <span v-if="box.status === 'archived'" class="sb-chip sb-chip-outline">Archived</span>
        <span v-for="name in tagNames" :key="name" class="sb-chip sb-chip-outline">{{ name }}</span>
      </div>
    </div>
  </NuxtLink>
</template>
