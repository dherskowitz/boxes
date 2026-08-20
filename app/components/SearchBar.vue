<script setup lang="ts">
defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string], submit: [] }>()
</script>

<template>
  <form class="flex gap-2" @submit.prevent="emit('submit')">
    <UFormField label="Search" class="flex-1">
      <UInput
        :model-value="modelValue"
        class="w-full"
        placeholder="Search boxes and items"
        data-testid="search-input"
        @update:model-value="v => emit('update:modelValue', String(v))"
      />
    </UFormField>
    <UButton type="submit" class="self-end">Search</UButton>
  </form>
</template>
