<script setup lang="ts">
import type { StorageTag } from '~/types/pocketbase'

/**
 * Reusable tag picker. `v-model` is `string[]` of tag ids — the same shape
 * `StorageBox.tags` / `StorageItem.tags` store, so a consumer binds it
 * straight to a form field with no mapping. Standalone: no router use, no
 * page-specific assumptions. Wave 3 mounts this inside the box and item
 * forms; this slice does not wire it into anything.
 */
const model = defineModel<string[]>({ default: () => [] })

const { data: tags } = useTags()
const createTag = useCreateTag()

// Tags created inline through this picker before `useTags` has refetched —
// merged in so the new chip shows immediately instead of flashing empty.
const justCreated = ref<StorageTag[]>([])

const allTags = computed<StorageTag[]>(() => {
  const known = tags.value ?? []
  const knownIds = new Set(known.map(t => t.id))
  return [...known, ...justCreated.value.filter(t => !knownIds.has(t.id))]
})

const selectedTags = computed(() =>
  model.value
    .map(id => allTags.value.find(t => t.id === id))
    .filter((t): t is StorageTag => t !== undefined)
)

// Tags not already selected — nothing useful about offering a duplicate pick.
const pickerItems = computed(() => allTags.value.filter(t => !model.value.includes(t.id)))

const picked = ref<string | undefined>(undefined)
const errorMessage = ref('')

function addTag(id: string) {
  if (!model.value.includes(id)) model.value = [...model.value, id]
}

function removeTag(id: string) {
  model.value = model.value.filter(t => t !== id)
}

function onSelect(value: string | undefined) {
  if (value) addTag(value)
  // Reset so the input goes back to empty rather than showing the picked id.
  picked.value = undefined
}

async function onCreate(raw: string) {
  // A double-tap on the create affordance must not create two tags.
  if (createTag.isPending.value) return

  const name = normalizeTagName(raw)
  if (!name) return

  const existing = allTags.value.find(t => normalizeTagName(t.name) === name)
  if (existing) {
    // The unique constraint would reject a duplicate anyway — select the
    // existing tag instead of surfacing a confusing 400.
    addTag(existing.id)
    picked.value = undefined
    return
  }

  errorMessage.value = ''
  try {
    const created = await createTag.mutateAsync({ name })
    justCreated.value = [...justCreated.value, created]
    addTag(created.id)
  } catch (e) {
    errorMessage.value = pbError(e)
  } finally {
    picked.value = undefined
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <UInputMenu
      v-model="picked"
      :items="pickerItems"
      value-key="id"
      label-key="name"
      create-item
      :loading="createTag.isPending.value"
      placeholder="Add a tag"
      class="w-full"
      @update:model-value="onSelect"
      @create="onCreate"
    />

    <UAlert
      v-if="errorMessage"
      color="error"
      data-testid="tag-picker-error"
      :description="errorMessage"
    />

    <div v-if="selectedTags.length" class="flex flex-wrap gap-2">
      <UBadge
        v-for="tag in selectedTags"
        :key="tag.id"
        :style="tag.color ? { backgroundColor: tag.color } : undefined"
        class="flex items-center gap-1"
        :data-testid="`selected-tag-${tag.id}`"
      >
        {{ tag.name }}
        <UButton
          icon="i-lucide-x"
          size="xs"
          variant="link"
          :aria-label="`Remove ${tag.name}`"
          :data-testid="`remove-tag-${tag.id}`"
          @click="removeTag(tag.id)"
        />
      </UBadge>
    </div>
  </div>
</template>
