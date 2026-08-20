<script setup lang="ts">
import type { SearchResult } from '~/queries/search'

defineProps<{ results: SearchResult[] }>()

function resultKey(result: SearchResult): string {
  return result.kind === 'box' ? `box-${result.box.id}` : `item-${result.item.id}`
}
</script>

<template>
  <ul class="flex flex-col gap-3">
    <li v-for="result in results" :key="resultKey(result)">
      <NuxtLink
        v-if="result.kind === 'box'"
        :to="`/box/${result.box.qr_id}`"
        data-testid="search-result-box"
        class="flex flex-col gap-1 border p-3"
      >
        <UBadge variant="subtle">Box</UBadge>
        <span class="font-medium">{{ result.box.title || result.box.qr_id }}</span>
      </NuxtLink>

      <NuxtLink
        v-else
        :to="`/item/${result.item.id}`"
        data-testid="search-result-item"
        class="flex flex-col gap-1 border p-3"
      >
        <UBadge variant="subtle">Item</UBadge>
        <span class="font-medium">{{ result.item.title }}</span>
        <span v-if="result.item.expand?.box" class="text-sm">
          In {{ result.item.expand.box.title || result.item.expand.box.qr_id }}
        </span>
      </NuxtLink>
    </li>
  </ul>
</template>
