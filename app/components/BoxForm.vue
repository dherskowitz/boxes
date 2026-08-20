<script setup lang="ts">
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

const title = ref(props.existing?.title ?? '')
const description = ref(props.existing?.description ?? '')
const location = ref(props.existing?.location ?? '')
// Copied, never the record's own array: an edit that changes nothing else
// must still diff equal in `boxUpdatePayload`, and an empty init here would
// send `tags: []` and silently wipe the box's tags on save.
const tags = ref<string[]>([...(props.existing?.tags ?? [])])
const images = ref<File[]>([])

const tooManyImages = computed(() => images.value.length > MAX_IMAGES)

function onSubmit() {
  emit('submit', {
    title: title.value,
    description: description.value,
    location: location.value,
    tags: tags.value,
    images: images.value.slice(0, MAX_IMAGES)
  })
}
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
    <UFormField label="Title">
      <UInput v-model="title" required class="w-full" />
    </UFormField>

    <UFormField label="Description">
      <UTextarea v-model="description" class="w-full" />
    </UFormField>

    <UFormField label="Location">
      <UInput v-model="location" class="w-full" />
    </UFormField>

    <!-- Editing images isn't supported by the update mutation (BoxEdit has no
         images field) — the upload only appears on create. -->
    <UFormField v-if="!existing" label="Photos">
      <UFileUpload v-model="images" multiple accept="image/*" />
      <p v-if="tooManyImages">Only the first {{ MAX_IMAGES }} photos will be uploaded.</p>
    </UFormField>

    <UFormField label="Tags">
      <TagPicker v-model="tags" />
    </UFormField>

    <UAlert v-if="error" :description="error" data-testid="box-form-error" />

    <UButton type="submit" :loading="pending" :disabled="pending" block>
      {{ existing ? 'Save changes' : 'Create box' }}
    </UButton>
  </form>
</template>
