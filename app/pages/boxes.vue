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

// The header's headline figure. Same two queries the dashboard and /reports
// read, so the number here can never disagree with the number there — and
// `useBoxFill()` is already in flight for the per-card item counts.
const { data: boxFill } = useBoxFill()
const { data: tagUsage } = useTagUsage()
const totals = computed(() => reportTotals(boxFill.value, tagUsage.value))

</script>

<template>
  <div>
    <AppHeader eyebrow="Your storage">
      <template #title>
        <p class="sb-display text-[34px]">
          {{ totals.boxes }} {{ totals.boxes === 1 ? 'box' : 'boxes' }} <br>
          {{ totals.items }} {{ totals.items === 1 ? 'thing' : 'things' }}
        </p>
      </template>

      <SearchBar v-model="searchTerm" v-model:tags="tagIds" filterable @submit="onSearchSubmit">
        <template #filters>
          <UCheckbox
            v-model="showArchived"
            data-testid="show-archived"
            size="lg"
            label="Show archived boxes"
            description="Archived boxes stay searchable and keep their labels."
          />
        </template>
      </SearchBar>
    </AppHeader>

    <div class="sb-body flex flex-col gap-4">
      <BoxSection
        status="active"
        heading="Active"
        empty-message="Name it, drop in a couple of photos, then stick its QR label on the real thing."
        :tag-ids="tagIds"
      />

      <BoxSection
        v-if="showArchived"
        status="archived"
        heading="Archived"
        empty-message="Boxes you archive stay searchable here."
        :tag-ids="tagIds"
      />
    </div>

    <!-- Sits above the nav pill, on the same right edge, as the design draws
         it: the pill is where you go, this is what you make. -->
    <UButton
      to="/box/new"
      aria-label="New box"
      icon="i-lucide-plus"
      class="fixed right-[1.375rem] z-40 flex size-15 items-center justify-center rounded-full text-white"
      :style="{
        bottom: 'calc(6.25rem + env(safe-area-inset-bottom))',
        background: 'var(--sb-accent)',
        boxShadow: '0 16px 32px oklch(0.55 0.21 292 / .45)'
      }"
      :ui="{ leadingIcon: 'size-7' }"
    />
  </div>
</template>
