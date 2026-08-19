<script setup lang="ts">
import type { StorageBox } from '~/types/pocketbase'

const props = defineProps<{ box: StorageBox }>()

const { $pb } = useNuxtApp()

const thumbnailUrl = computed(() => {
  const [first] = props.box.images
  if (!first) return null
  return $pb.files.getURL(props.box, first, { thumb: '200x200' })
})

// `title` has no schema default and the seed data leaves some boxes titleless
// — fall back to the printed qr_id so a card is never blank.
const displayTitle = computed(() => props.box.title || props.box.qr_id)
</script>

<template>
  <NuxtLink
    :to="`/box/${box.qr_id}`"
    data-testid="box-card"
    class="flex flex-col gap-2 border p-3"
  >
    <img
      v-if="thumbnailUrl"
      :src="thumbnailUrl"
      :alt="displayTitle"
      class="h-32 w-full object-cover"
    >
    <div v-else class="flex h-32 w-full items-center justify-center border">
      <span class="text-sm">No photo</span>
    </div>
    <div class="flex flex-col gap-1">
      <span class="font-medium">{{ displayTitle }}</span>
      <span v-if="box.location">{{ box.location }}</span>
      <UBadge v-if="box.status === 'archived'" variant="subtle">Archived</UBadge>
    </div>
  </NuxtLink>
</template>
