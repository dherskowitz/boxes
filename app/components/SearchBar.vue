<script setup lang="ts">
defineProps<{
  modelValue: string
  /**
   * Mount the tag filter behind the pill's own control. Off by default: the
   * search screen shows it only once there is a term, and /items filters a
   * list rather than a search.
   */
  filterable?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string], submit: [] }>()

// Tag ids, the same shape `BoxListFilters.tagIds` / `SearchFilters.tagIds`
// take. Optional: a bar mounted without `filterable` never reads it.
const tagIds = defineModel<string[]>('tags', { default: () => [] })

const filtersOpen = ref(false)

// Unique per instance: the index and the search screen can both be mounted
// during a client-side navigation, and two inputs sharing an id would make
// the label point at the wrong one.
const inputId = useId()

function onInput(event: Event) {
  const target = event.target
  if (target instanceof HTMLInputElement) emit('update:modelValue', target.value)
}
</script>

<template>
  <!-- The white pill the v2 design floats inside the accent header block. The
       label is visually hidden rather than dropped: the field has to stay
       reachable by name, for screen readers and for the e2e suite.

       The right-hand slot is the filters control the design draws there. The
       chips used to sit under the bar in a row that wrapped to two lines and
       ate a third of the screen above the fold, on a screen whose whole job is
       the list underneath. Behind the button they cost one tap, and the count
       badge keeps the filter from being invisible while it is on.

       Submit is the keyboard's own return key (`enterkeyhint="search"`), not a
       second button crammed into a 44px slot. -->
  <div class="flex flex-col gap-2">
    <form
      class="flex items-center gap-2.5 rounded-2xl p-3.5"
      :style="{
        background: 'var(--sb-surface)',
        color: 'var(--sb-text)',
        boxShadow: '0 8px 20px rgba(24,10,60,.18)'
      }"
      @submit.prevent="emit('submit')"
    >
      <UIcon name="i-lucide-search" class="size-[18px] shrink-0 text-[var(--sb-accent)]" aria-hidden="true" />
      <label class="sr-only" :for="inputId">Search</label>
      <input
        :id="inputId"
        :value="modelValue"
        type="search"
        enterkeyhint="search"
        class="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:text-[var(--sb-muted)]"
        placeholder="Search boxes and items…"
        data-testid="search-input"
        @input="onInput"
      >

      <button
        v-if="filterable"
        type="button"
        data-testid="open-filters"
        class="relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors"
        :style="tagIds.length > 0
          ? { background: 'var(--sb-accent)', color: '#fff' }
          : { color: 'var(--sb-accent)' }"
        @click="filtersOpen = true"
      >
        <UIcon name="i-lucide-sliders-horizontal" class="size-[18px]" aria-hidden="true" />
        <span
          v-if="tagIds.length > 0"
          data-testid="filter-count"
          class="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-extrabold"
          :style="{ background: 'var(--sb-amber)', color: 'var(--sb-amber-ink)' }"
        >{{ tagIds.length }}</span>
        <span class="sr-only">Filter by tag</span>
      </button>

      <!-- Without the filter control there is nothing else in the slot, so the
           submit stays visible: a bar with no affordance at all reads as a
           field someone forgot to finish. -->
      <button
        v-else
        type="submit"
        class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white"
        :style="{ background: 'var(--sb-accent)' }"
      >
        <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" />
        <span class="sr-only">Search</span>
      </button>
    </form>

    <USlideover v-if="filterable" v-model:open="filtersOpen" side="bottom" title="Filters">
      <template #body>
        <div class="flex flex-col gap-4 pb-[env(safe-area-inset-bottom)]">
          <!-- Whatever else narrows this particular list. The box index puts
               its archived toggle here: it is a filter, and it was the last
               control still sitting between the header and the list. -->
          <slot name="filters" />

          <TagFilter v-model="tagIds" />
          <UButton
            block
            size="xl"
            data-testid="apply-filters"
            class="justify-center rounded-[1.25rem] font-extrabold"
            @click="filtersOpen = false"
          >
            Done
          </UButton>
        </div>
      </template>
    </USlideover>
  </div>
</template>
