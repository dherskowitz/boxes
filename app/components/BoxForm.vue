<script setup lang="ts">
import type { FormError } from '@nuxt/ui'
import type { StorageBox } from '~/types/pocketbase'

const props = defineProps<{
  existing?: StorageBox
  pending?: boolean
  error?: string
  /**
   * Ties this form to a submit button rendered outside it — the Save in the
   * screen's header. Omitted in the edit modal, which has its own footer.
   */
  formId?: string
}>()

const emit = defineEmits<{
  // No `images`. A box is identified by its colour, its name and its printed
  // code — a photo of a sealed cardboard box tells you nothing the label does
  // not. Photos belong on the items inside, which is what you are trying to
  // recognise. The schema field stays; nothing writes to it.
  submit: [payload: { title: string, description: string, location: string, tags: string[] }]
  /** Create, then go straight to the label. Only offered on create. */
  'submit-and-print': [payload: { title: string, description: string, location: string, tags: string[] }]
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

// Locations already on other boxes. Typing one by hand is how the same shelf
// ends up spelled three ways, and /reports groups the donut on the raw string.
const { data: boxFill } = useBoxFill()
const suggestions = computed(() => recentLocations(boxFill.value, state.location))

function validate(): FormError[] {
  if (state.title.trim() === '') return [{ name: 'title', message: 'Give the box a title.' }]
  return []
}

function payload() {
  return {
    title: state.title.trim(),
    description: state.description,
    location: state.location,
    tags: state.tags
  }
}

function onSubmit() {
  emit('submit', payload())
}

/**
 * `UForm` runs `validate` on its own submit only, so the print action goes
 * through the same submit rather than emitting directly — otherwise it would
 * be a second path to a create that skips the title check.
 */
const printAfter = ref(false)

function onValidSubmit() {
  if (printAfter.value) {
    printAfter.value = false
    emit('submit-and-print', payload())
    return
  }
  onSubmit()
}
</script>

<template>
  <UForm
    :id="formId"
    :state="state"
    :validate="validate"
    class="flex flex-col gap-3.5"
    @submit="onValidSubmit"
    @error="printAfter = false"
  >
    <UFormField label="Title · Required" name="title">
      <UInput v-model="state.title" size="xl" class="w-full" data-testid="box-title" />
    </UFormField>

    <UFormField label="Description" name="description">
      <UTextarea v-model="state.description" :rows="3" class="w-full" />
    </UFormField>

    <UFormField label="Location" name="location">
      <UInput
        v-model="state.location"
        size="xl"
        icon="i-lucide-map-pin"
        class="w-full"
        data-testid="box-location"
      />
      <!-- Suggestions, not a select: a new box often goes somewhere that has
           never held one, so the field stays free text and these only save
           typing. -->
      <!-- One line that scrolls, not a wrapping block. Six locations with
           real names wrap to three rows and push the tags and the submit off
           a phone screen — the suggestions are a shortcut, not the field. The
           scroll is on this row alone, so the page itself never moves
           sideways. -->
      <div v-if="suggestions.length" class="mt-2 flex items-center gap-2">
        <span class="sb-mono shrink-0" :style="{ color: 'var(--sb-muted)' }">Recent</span>
        <div class="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
          <button
            v-for="location in suggestions"
            :key="location"
            type="button"
            class="sb-chip shrink-0 cursor-pointer border-2 px-3 py-1.5"
            :style="{
              borderColor: 'var(--sb-line)',
              background: 'var(--sb-surface)',
              color: 'var(--sb-muted)'
            }"
            :data-testid="`recent-location-${location}`"
            @click="state.location = location"
          >
            {{ location }}
          </button>
        </div>
      </div>
    </UFormField>

    <UFormField label="Tags" name="tags">
      <TagPicker v-model="state.tags" variant="search" />
    </UFormField>

    <UAlert v-if="error" color="error" :description="error" data-testid="box-form-error" />

    <UButton
      type="submit"
      size="xl"
      class="rounded-[1.25rem] font-extrabold"
      :loading="pending"
      :disabled="pending"
      block
      data-testid="box-submit"
      @click="printAfter = !existing"
    >
      {{ existing ? 'Save changes' : 'Create box & print label' }}
    </UButton>
  </UForm>
</template>
