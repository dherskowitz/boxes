<script setup lang="ts">
import type { StorageItem } from '~/types/pocketbase'

const MAX_IMAGES = 99

const props = defineProps<{
  existing?: StorageItem
  pending?: boolean
  error?: string
}>()

const emit = defineEmits<{
  submit: [payload: { title: string, description: string, notes: string, images: File[] }]
}>()

const title = ref(props.existing?.title ?? '')
const description = ref(props.existing?.description ?? '')
const notes = ref(props.existing?.notes ?? '')
const images = ref<File[]>([])

const tooManyImages = computed(() => images.value.length > MAX_IMAGES)

function onSubmit() {
  emit('submit', {
    title: title.value,
    description: description.value,
    notes: notes.value,
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

    <UFormField label="Notes">
      <UTextarea v-model="notes" class="w-full" />
    </UFormField>

    <!-- Editing images isn't supported by the update mutation (ItemEdit has no
         images field) — the upload only appears on create. -->
    <UFormField v-if="!existing" label="Photos">
      <UFileUpload v-model="images" multiple accept="image/*" />
      <p v-if="tooManyImages">Only the first {{ MAX_IMAGES }} photos will be uploaded.</p>
    </UFormField>

    <!-- Tag selection is wired in by wave 3, using slice B's TagPicker. -->

    <UAlert v-if="error" :description="error" data-testid="item-form-error" />

    <UButton type="submit" :loading="pending" :disabled="pending" block>
      {{ existing ? 'Save changes' : 'Add item' }}
    </UButton>
  </form>
</template>
