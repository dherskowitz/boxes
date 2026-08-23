<script setup lang="ts">
/**
 * The sun/moon segmented pill from the v2 design. Two explicit choices rather
 * than one toggle button, because the design shows the current mode as a
 * filled segment — you can see which one you are in without decoding an icon.
 *
 * Lives on /more, on a plain surface, so its colours come from the tokens
 * rather than the white-on-accent treatment the design draws in the header —
 * and on its own full-width row, where there is space to name each segment.
 * Three icons alone made you tap one to find out what it did.
 */
const colorMode = useColorMode()

// Three, not the design's two. `colorMode.preference` starts at 'system', so a
// two-way control renders with neither half selected on a first visit — and
// once you have picked one there is no way back to following the phone, which
// on a phone is the setting most people actually want.
const modes = [
  { value: 'light', icon: 'i-lucide-sun', label: 'Light' },
  { value: 'dark', icon: 'i-lucide-moon', label: 'Dark' },
  { value: 'system', icon: 'i-lucide-smartphone', label: 'Auto' }
] as const
</script>

<template>
  <div
    class="flex rounded-full p-[3px]"
    :style="{ background: 'color-mix(in oklch, var(--sb-text) 8%, transparent)' }"
    role="group"
    aria-label="Theme"
  >
    <button
      v-for="mode in modes"
      :key="mode.value"
      type="button"
      class="flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full text-xs font-extrabold transition-colors"
      :style="colorMode.preference === mode.value
        ? { background: 'var(--sb-accent)', color: '#fff' }
        : { color: 'var(--sb-muted)' }"
      :aria-pressed="colorMode.preference === mode.value"
      @click="colorMode.preference = mode.value"
    >
      <UIcon :name="mode.icon" class="size-[17px]" aria-hidden="true" />
      {{ mode.label }}
    </button>
  </div>
</template>
