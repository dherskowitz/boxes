<script setup lang="ts">
import type { FormError } from '@nuxt/ui'
import type { StorageItem } from '~/types/pocketbase'

const MAX_IMAGES = 99

const props = defineProps<{
  existing?: StorageItem
  pending?: boolean
  error?: string
}>()

const emit = defineEmits<{
  submit: [payload: { title: string, description: string, notes: string, tags: string[], images: File[] }]
}>()

const state = reactive({
  title: props.existing?.title ?? '',
  description: props.existing?.description ?? '',
  notes: props.existing?.notes ?? '',
  // Copied, never the record's own array — see the note in BoxForm: an empty
  // init would make `itemUpdatePayload` see a real change to [] and wipe the
  // item's tags on a save that only touched the title.
  tags: [...(props.existing?.tags ?? [])],
  images: [] as File[]
})

const tooManyImages = computed(() => state.images.length > MAX_IMAGES)

function validate(): FormError[] {
  if (state.title.trim() === '') return [{ name: 'title', message: 'Give the item a title.' }]
  return []
}

function onSubmit() {
  emit('submit', {
    title: state.title.trim(),
    description: state.description,
    notes: state.notes,
    tags: state.tags,
    images: state.images.slice(0, MAX_IMAGES)
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

    <UFormField label="Notes" name="notes">
      <UTextarea v-model="state.notes" class="w-full" />
    </UFormField>

    <!-- Editing images isn't supported by the update mutation (ItemEdit has no
         images field) — the upload only appears on create. -->
    <UFormField v-if="!existing" label="Photos" name="images">
      <UFileUpload v-model="state.images" multiple accept="image/*" />
      <p v-if="tooManyImages">Only the first {{ MAX_IMAGES }} photos will be uploaded.</p>
    </UFormField>

    <UFormField label="Tags" name="tags">
      <TagPicker v-model="state.tags" />
    </UFormField>

    <UAlert v-if="error" color="error" :description="error" data-testid="item-form-error" />

    <UButton type="submit" size="xl" class="rounded-[1.25rem] font-extrabold" :loading="pending" :disabled="pending" block>
      {{ existing ? 'Save changes' : 'Add item' }}
    </UButton>
  </UForm>
</template>
