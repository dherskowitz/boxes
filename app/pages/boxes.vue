<script setup lang="ts">
// PRD §7.2: archived boxes are hidden unless explicitly *included* — the
// toggle adds a second section rather than swapping the list, so a user with
// 10 active and 2 archived boxes sees all 12.
const showArchived = ref(false)

// PRD §7.7: narrow the index by one or more tags. Multiple tags AND-match —
// a box must carry all of them (`tagClauses()`).
const tagIds = ref<string[]>([])

const searchTerm = ref('')
function onSearchSubmit() {
  const term = searchTerm.value.trim()
  if (!term) return
  navigateTo({ path: '/search', query: { q: term } })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-lg font-medium">Boxes</h1>
      <div class="flex items-center gap-3">
        <NuxtLink to="/print-sheet">Print sheet</NuxtLink>
        <UButton to="/box/new">New box</UButton>
      </div>
    </div>

    <SearchBar v-model="searchTerm" @submit="onSearchSubmit" />

    <TagFilter v-model="tagIds" />

    <UCheckbox v-model="showArchived" data-testid="show-archived" label="Show archived boxes" />

    <BoxSection status="active" heading="Active" empty-message="No boxes yet." :tag-ids="tagIds" />

    <BoxSection
      v-if="showArchived"
      status="archived"
      heading="Archived"
      empty-message="No archived boxes."
      :tag-ids="tagIds"
    />
  </div>
</template>
