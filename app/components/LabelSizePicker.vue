<script setup lang="ts">
import { LABEL_SIZES, perSheet } from '~/utils/labelSizes'

/**
 * Which stock is going through the printer.
 *
 * A select rather than a row of chips: five sizes with a line of explanation
 * each do not fit across a phone, and this is set once when you buy a pack of
 * labels, not tweaked while reading.
 */
const model = defineModel<string>({ required: true })

const props = defineProps<{
  /** Show how many fit on a Letter sheet — true for the batch sheet only. */
  showPerSheet?: boolean
}>()

const items = computed(() =>
  LABEL_SIZES.map(size => ({
    value: size.id,
    label: props.showPerSheet ? `${size.name} · ${perSheet(size)} per sheet` : size.name,
    description: size.hint
  }))
)
</script>

<template>
  <UFormField label="Label size" name="labelSize" :ui="{ label: 'sb-mono text-(--sb-muted)' }">
    <USelectMenu
      v-model="model"
      :items="items"
      value-key="value"
      class="w-full"
      data-testid="label-size"
    />
  </UFormField>
</template>
