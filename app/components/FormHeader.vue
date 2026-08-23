<script setup lang="ts">
/**
 * The bar a full-screen form opens with: Cancel on the left, the title
 * centred, the primary action on the right.
 *
 * Its ground is `.sb-header`, so it takes `--c` from whatever scopes it — the
 * new-item screen sets the parent box's colour and the new-box screen leaves it
 * to the app accent.
 *
 * `submitFor` is the id of the `<form>` the action submits. A button outside
 * its form submits it through the `form` attribute, which is what lets the
 * action sit up here while the fields live in a `UForm` further down. Without
 * it the header would need its own submit path and the two could disagree
 * about validation.
 */
defineProps<{
  title: string
  /** Second line under the title — the parent box, on the item form. */
  subtitle?: string
  cancelTo: string
  submitLabel: string
  submitFor: string
  pending?: boolean
}>()
</script>

<template>
  <header class="sb-header">
    <div class="flex items-center justify-between gap-3">
      <UButton
        :to="cancelTo"
        variant="ghost"
        class="shrink-0 px-0 text-current opacity-85 hover:opacity-100"
        data-testid="form-cancel"
      >
        Cancel
      </UButton>

      <div class="flex min-w-0 flex-col items-center text-center">
        <h1 class="text-[17px] font-extrabold">{{ title }}</h1>
        <!-- Clamped rather than truncated at one line: a box title runs long,
             and "in Kitchen overflow and baking…" still says which box. -->
        <p v-if="subtitle" class="line-clamp-1 text-[13px] opacity-85">{{ subtitle }}</p>
      </div>

      <!-- Amber on the app accent, but the box's own ink wherever a box colour
           scopes this header: amber on the warmer box stops is barely a colour
           change, and `--c-on` is the value already picked to clear contrast on
           exactly that fill. -->
      <UButton
        type="submit"
        :form="submitFor"
        variant="ghost"
        :loading="pending"
        :disabled="pending"
        class="shrink-0 px-0 font-extrabold"
        :style="{ color: 'var(--c-on, var(--sb-amber))' }"
        data-testid="form-save"
      >
        {{ submitLabel }}
      </UButton>
    </div>
  </header>
</template>
