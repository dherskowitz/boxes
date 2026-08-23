<script setup lang="ts">
/**
 * The saturated block every screen opens with (v2 design). Replaces the old
 * white top bar: the colour is what tells you where you are, so it is the
 * first thing on the page rather than a heading in the content.
 *
 * `qrId` switches the block to that box's signature colour — the same one its
 * card, its item rows and its printed label use. Without it the block is the
 * app accent, which is what every list-level screen wants.
 */
const props = defineProps<{
  title?: string
  eyebrow?: string
  /** Colour the header as this box. Omit for the app accent. */
  qrId?: string
  /** Show a back chevron on the left. */
  backTo?: string
}>()

const vars = computed(() => (props.qrId ? boxColorVars(props.qrId) : {}))
</script>

<template>
  <header class="sb-header" :style="vars">
    <div class="flex items-start gap-3">
      <UButton
        v-if="backTo"
        :to="backTo"
        icon="i-lucide-arrow-left"
        aria-label="Back"
        variant="ghost"
        class="size-10 shrink-0 justify-center rounded-full bg-white/20 text-current hover:bg-white/30"
      />

      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <p v-if="eyebrow" class="sb-mono opacity-75">{{ eyebrow }}</p>
        <h1 v-if="title" class="sb-display text-[30px]">{{ title }}</h1>
        <slot name="title" />
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </div>

    <div v-if="$slots.default" class="mt-4">
      <slot />
    </div>
  </header>
</template>
