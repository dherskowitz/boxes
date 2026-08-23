<script setup lang="ts">
/**
 * Initials on the amber chip, as the v2 design draws the signed-in user.
 * Falls back to a person glyph rather than a "?" when there is no name to
 * initialise — a placeholder that looks like an error is worse than none.
 */
const props = withDefaults(defineProps<{ name?: string, size?: 'sm' | 'md' }>(), {
  name: '',
  size: 'md'
})

const initials = computed(() =>
  props.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('')
)
</script>

<template>
  <span
    class="flex shrink-0 items-center justify-center rounded-full font-extrabold"
    :class="size === 'sm' ? 'size-[34px] text-xs' : 'size-10 text-sm'"
    :style="{
      background: 'var(--sb-amber)',
      color: 'var(--sb-amber-ink)',
      border: '2px solid rgba(255,255,255,.5)'
    }"
    :aria-label="name || undefined"
  >
    <template v-if="initials">{{ initials }}</template>
    <UIcon v-else name="i-lucide-user" class="size-5" aria-hidden="true" />
  </span>
</template>
