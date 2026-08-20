<script setup lang="ts">
import type { FormError } from '@nuxt/ui'
import type { StorageBox } from '~/types/pocketbase'

const MAX_IMAGES = 15

const props = defineProps<{
  existing?: StorageBox
  pending?: boolean
  error?: string
}>()

const emit = defineEmits<{
  submit: [payload: { title: string, description: string, location: string, tags: string[], images: File[] }]
}>()

const state = reactive({
  title: props.existing?.title ?? '',
  description: props.existing?.description ?? '',
  location: props.existing?.location ?? '',
  // Copied, never the record's own array: an edit that changes nothing else
  // must still diff equal in `boxUpdatePayload`, and an empty init here would
  // send `tags: []` and silently wipe the box's tags on save.
  tags: [...(props.existing?.tags ?? [])],
  images: [] as File[]
})

const tooManyImages = computed(() => state.images.length > MAX_IMAGES)

function validate(): FormError[] {
  if (state.title.trim() === '') return [{ name: 'title', message: 'Give the box a title.' }]
  return []
}

function onSubmit() {
  emit('submit', {
    title: state.title.trim(),
    description: state.description,
    location: state.location,
    tags: state.tags,
    images: state.images.slice(0, MAX_IMAGES)
  })
}
</script>

<template>
  <UForm :state="state" :validate="validate" class="flex flex-col gap-4" @submit="onSubmit">
    <UFormField label="Title" name="title">
      <UInput v-model="state.title" class="w-full" />
    </UFormField>

    <UFormField label="Description" name="description">
      <UTextarea v-model="state.description" class="w-full" />
    </UFormField>

    <UFormField label="Location" name="location">
      <UInput v-model="state.location" class="w-full" />
    </UFormField>

    <!-- Editing images isn't supported by the update mutation (BoxEdit has no
         images field) — the upload only appears on create. -->
    <UFormField v-if="!existing" label="Photos" name="images">
      <UFileUpload v-model="state.images" multiple accept="image/*" />
      <p v-if="tooManyImages">Only the first {{ MAX_IMAGES }} photos will be uploaded.</p>
    </UFormField>

    <UFormField label="Tags" name="tags">
      <TagPicker v-model="state.tags" />
    </UFormField>

    <UAlert v-if="error" color="error" :description="error" data-testid="box-form-error" />

    <UButton type="submit" :loading="pending" :disabled="pending" block>
      {{ existing ? 'Save changes' : 'Create box' }}
    </UButton>
  </UForm>
</template>
