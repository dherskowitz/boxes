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

const { member } = useAuth()

// Nothing at all, as opposed to nothing matching a filter. Gated on the query
// having answered: `reportTotals(undefined, …)` is also zero, and flashing
// "No boxes yet" at someone with forty of them while the view loads is worse
// than showing nothing for a beat.
const isEmpty = computed(() => boxFill.value !== undefined && totals.value.boxes === 0)

</script>

<template>
  <div>
    <AppHeader :eyebrow="isEmpty ? undefined : 'Your storage'">
      <template #title>
        <!-- A count of zero is not a headline figure, it is a state. -->
        <p v-if="isEmpty" class="sb-display text-[30px]">No boxes yet</p>
        <p v-else class="sb-display text-[34px]">
          {{ totals.boxes }} {{ totals.boxes === 1 ? 'box' : 'boxes' }} <br>
          {{ totals.items }} {{ totals.items === 1 ? 'thing' : 'things' }}
        </p>
      </template>

      <template #actions>
        <!-- Desktop only. The floating button below is the phone affordance,
             and there is no thumb zone here to put it in. `hidden` is
             display:none, so `getByRole` never sees both at once. -->
        <UButton
          v-if="!isEmpty"
          to="/box/new"
          data-testid="new-box"
          icon="i-lucide-plus"
          color="neutral"
          class="hidden shrink-0 rounded-full bg-white/20 font-extrabold text-current hover:bg-white/30 lg:flex"
        >
          New box
        </UButton>
        <NuxtLink v-if="isEmpty" to="/more" aria-label="Your account">
          <UserAvatar :name="member?.name" />
        </NuxtLink>
      </template>

      <!-- No search pill with nothing to search: it would be the largest
           control on the screen and every query it ran would come back empty. -->
      <SearchBar
        v-if="!isEmpty"
        v-model="searchTerm"
        v-model:tags="tagIds"
        filterable
        @submit="onSearchSubmit"
      >
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
        empty-message="Name it, say where it lives, then stick its QR label on the real thing."
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
    <!-- Hidden while the list is empty: the empty state already leads with
         "Create your first box", and two buttons for one action makes the
         reader work out whether they differ. -->
    <UButton
      v-if="!isEmpty"
      to="/box/new"
      data-testid="new-box-fab"
      aria-label="New box"
      icon="i-lucide-plus"
      class="fixed right-[1.375rem] z-40 flex size-15 items-center justify-center rounded-full text-white lg:hidden"
      :style="{
        bottom: 'calc(6.25rem + env(safe-area-inset-bottom))',
        background: 'var(--sb-accent)',
        boxShadow: '0 16px 32px oklch(0.55 0.21 292 / .45)'
      }"
      :ui="{ leadingIcon: 'size-7' }"
    />
  </div>
</template>
