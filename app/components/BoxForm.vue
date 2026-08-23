<script setup lang="ts">
import type { FormError } from '@nuxt/ui'
import type { StorageBox } from '~/types/pocketbase'

const props = defineProps<{
  existing?: StorageBox
  pending?: boolean
  error?: string
}>()

const emit = defineEmits<{
  // No `images`. A box is identified by its colour, its name and its printed
  // code — a photo of a sealed cardboard box tells you nothing the label does
  // not. Photos belong on the items inside, which is what you are trying to
  // recognise. The schema field stays; nothing writes to it.
  submit: [payload: { title: string, description: string, location: string, tags: string[] }]
}>()

const state = reactive({
  title: props.existing?.title ?? '',
  description: props.existing?.description ?? '',
  location: props.existing?.location ?? '',
  // Copied, never the record's own array: an edit that changes nothing else
  // must still diff equal in `boxUpdatePayload`, and an empty init here would
  // send `tags: []` and silently wipe the box's tags on save.
  tags: [...(props.existing?.tags ?? [])]
})

function validate(): FormError[] {
  if (state.title.trim() === '') return [{ name: 'title', message: 'Give the box a title.' }]
  return []
}

function onSubmit() {
  emit('submit', {
    title: state.title.trim(),
    description: state.description,
    location: state.location,
    tags: state.tags
  })
}
</script>

<template>
  <UForm :state="state" :validate="validate" class="flex flex-col gap-3.5" @submit="onSubmit">
    <UFormField label="Title" name="title">
      <UInput v-model="state.title" class="w-full" />
    </UFormField>

    <UFormField label="Description" name="description">
      <UTextarea v-model="state.description" class="w-full" />
    </UFormField>

    <UFormField label="Location" name="location">
      <UInput v-model="state.location" class="w-full" />
    </UFormField>

    <UFormField label="Tags" name="tags">
      <TagPicker v-model="state.tags" />
    </UFormField>

    <UAlert v-if="error" color="error" :description="error" data-testid="box-form-error" />

    <UButton type="submit" size="xl" class="rounded-[1.25rem] font-extrabold" :loading="pending" :disabled="pending" block>
      {{ existing ? 'Save changes' : 'Create box' }}
    </UButton>
  </UForm>
</template>
