<script setup lang="ts">
import type { FormError } from '@nuxt/ui'
import type { StorageItem } from '~/types/pocketbase'

const MAX_IMAGES = 99

const props = defineProps<{
  existing?: StorageItem
  pending?: boolean
  error?: string
  /**
   * Ties this form to the Save rendered in the screen's header. Omitted in
   * the edit modal, which has its own footer.
   */
  formId?: string
  /** Offer "Save & add another". Only meaningful while filling a box. */
  addAnother?: boolean
}>()

const emit = defineEmits<{
  submit: [payload: ItemPayload]
  /** Save, then hand back an empty form in the same box. */
  'submit-and-repeat': [payload: ItemPayload]
}>()

interface ItemPayload {
  title: string
  description: string
  notes: string
  tags: string[]
  images: File[]
}

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

// Two inputs over one, because they are different intentions on a phone:
// `capture` opens the camera straight to the back lens, without it the OS
// offers the photo library. A single "choose file" makes the reader pick from
// a sheet for something they already decided before they tapped.
const cameraInput = ref<HTMLInputElement | null>(null)
const libraryInput = ref<HTMLInputElement | null>(null)

/**
 * Thumbnail URLs, held alongside the files rather than derived from them.
 *
 * `URL.createObjectURL` mints a new handle on every call and pins the file in
 * memory until it is revoked, so a computed would leak one per re-render for
 * as long as the form is open.
 */
const previews = ref<string[]>([])

function onFiles(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement) || !target.files) return
  const added = Array.from(target.files)
  state.images = [...state.images, ...added]
  previews.value = [...previews.value, ...added.map(file => URL.createObjectURL(file))]
  // Cleared so picking the same file twice in a row still fires `change`.
  target.value = ''
}

function releasePreviews() {
  for (const url of previews.value) URL.revokeObjectURL(url)
  previews.value = []
}

function removeImage(at: number) {
  const url = previews.value[at]
  if (url) URL.revokeObjectURL(url)
  state.images = state.images.filter((_, i) => i !== at)
  previews.value = previews.value.filter((_, i) => i !== at)
}

onBeforeUnmount(releasePreviews)

function validate(): FormError[] {
  if (state.title.trim() === '') return [{ name: 'title', message: 'Give the item a title.' }]
  return []
}

function payload(): ItemPayload {
  return {
    title: state.title.trim(),
    description: state.description,
    notes: state.notes,
    tags: state.tags,
    images: state.images.slice(0, MAX_IMAGES)
  }
}

/**
 * Both footer actions submit the same form so both run `validate` — emitting
 * straight from the repeat button would be a second path to a create that
 * skips the title check.
 */
const repeatAfter = ref(false)

function onValidSubmit() {
  if (repeatAfter.value) {
    repeatAfter.value = false
    emit('submit-and-repeat', payload())
    return
  }
  emit('submit', payload())
}

/** Empty the form in place, for "Save & add another". */
function reset() {
  state.title = ''
  state.description = ''
  state.notes = ''
  state.tags = []
  state.images = []
  releasePreviews()
}

defineExpose({ reset })
</script>

<template>
  <UForm
    :id="formId"
    :state="state"
    :validate="validate"
    class="flex flex-col gap-3.5"
    @submit="onValidSubmit"
    @error="repeatAfter = false"
  >
    <UFormField label="Title · Required" name="title">
      <UInput v-model="state.title" size="xl" class="w-full" data-testid="item-title" />
    </UFormField>

    <UFormField label="Description" name="description">
      <UTextarea v-model="state.description" :rows="3" class="w-full" />
    </UFormField>

    <!-- Amber, matching the callout item detail renders these in, so the note
         is recognisable as the same thing in both places. The label says who
         can change it, not who can see it: `storage_items.notes` has no
         separate read rule, and every member of the app can read every box. -->
    <UFormField label="Notes · Editors can edit" name="notes">
      <UTextarea
        v-model="state.notes"
        :rows="2"
        class="w-full"
        :ui="{ base: 'bg-[color-mix(in_oklch,var(--sb-amber)_18%,var(--sb-surface))]' }"
        data-testid="item-notes"
      />
    </UFormField>

    <!-- Editing images isn't supported by the update mutation (ItemEdit has no
         images field) — the upload only appears on create. -->
    <UFormField v-if="!existing" label="Photos" name="images">
      <div class="flex flex-wrap gap-2.5">
        <div
          v-for="(url, i) in previews"
          :key="url"
          class="relative size-[72px] shrink-0 overflow-hidden rounded-[1.125rem]"
        >
          <img :src="url" alt="" class="size-full object-cover">
          <button
            type="button"
            class="absolute top-1 right-1 flex size-5 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white"
            :aria-label="`Remove photo ${i + 1}`"
            :data-testid="`remove-photo-${i}`"
            @click="removeImage(i)"
          >
            <UIcon name="i-lucide-x" class="size-3" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          class="flex size-[72px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-[1.125rem] border-2 border-dashed"
          :style="{ borderColor: 'var(--sb-line)', color: 'var(--sb-muted)' }"
          data-testid="photo-camera"
          @click="cameraInput?.click()"
        >
          <UIcon name="i-lucide-camera" class="size-5" aria-hidden="true" />
          <span class="sb-mono text-[9px]">Camera</span>
        </button>

        <button
          type="button"
          class="flex size-[72px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-[1.125rem] border-2 border-dashed"
          :style="{ borderColor: 'var(--sb-line)', color: 'var(--sb-muted)' }"
          data-testid="photo-library"
          @click="libraryInput?.click()"
        >
          <UIcon name="i-lucide-image" class="size-5" aria-hidden="true" />
          <span class="sb-mono text-[9px]">Library</span>
        </button>
      </div>

      <!-- Kept in the DOM and hidden rather than rendered on demand: the click
           that opens the picker has to land on an input that already exists,
           or the browser treats it as untrusted and silently does nothing. -->
      <input
        ref="cameraInput"
        type="file"
        accept="image/*"
        capture="environment"
        class="hidden"
        data-testid="photo-camera-input"
        @change="onFiles"
      >
      <input
        ref="libraryInput"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        data-testid="photo-library-input"
        @change="onFiles"
      >

      <p v-if="tooManyImages" class="mt-2 text-xs" :style="{ color: 'var(--sb-muted)' }">
        Only the first {{ MAX_IMAGES }} photos will be uploaded.
      </p>
    </UFormField>

    <UFormField label="Tags" name="tags">
      <TagPicker v-model="state.tags" variant="chips" />
    </UFormField>

    <UAlert v-if="error" color="error" :description="error" data-testid="item-form-error" />

    <div class="flex gap-2.5">
      <UButton
        v-if="addAnother"
        type="submit"
        size="xl"
        color="neutral"
        variant="outline"
        class="flex-1 justify-center rounded-[1.25rem] text-center font-extrabold"
        :loading="pending"
        :disabled="pending"
        data-testid="item-submit-repeat"
        @click="repeatAfter = true"
      >
        Save &amp; add another
      </UButton>

      <UButton
        type="submit"
        size="xl"
        class="flex-1 justify-center rounded-[1.25rem] font-extrabold"
        :style="{ background: 'var(--sb-ink)', color: 'var(--sb-on-ink)' }"
        :loading="pending"
        :disabled="pending"
        :block="!addAnother"
        data-testid="item-submit"
      >
        {{ existing ? 'Save changes' : 'Save item' }}
      </UButton>
    </div>
  </UForm>
</template>
