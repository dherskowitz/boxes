<script setup lang="ts">
import type { FormError } from '@nuxt/ui'
import type { StorageTag } from '~/types/pocketbase'

const { data: tags, isPending, isError, error, refetch } = useTags()
const tagUsage = useTagUsageMap()
const { role } = useAuth()

// The header's figures — the same reporting rows the usage counts come from,
// so a tag's own numbers and the total can never disagree.
const { data: boxFill } = useBoxFill()
const { data: tagUsageRows } = useTagUsage()
const totals = computed(() => reportTotals(boxFill.value, tagUsageRows.value))

const updateTag = useUpdateTag()
const deleteTag = useDeleteTag()

const canDelete = computed(() => role.value === 'owner' || role.value === 'admin')

function usageFor(tagId: string) {
  return tagUsage.value.get(tagId) ?? { boxCount: 0, itemCount: 0 }
}

/** "1 box · 3 items". Pluralised on each half independently. */
function usageLabel(tagId: string): string {
  const { boxCount, itemCount } = usageFor(tagId)
  return `${boxCount} ${boxCount === 1 ? 'box' : 'boxes'} · ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
}

const editingId = ref('')
const edit = reactive({ name: '', color: '' })
const editError = ref('')

// `<input type="color">` has no empty state — it falls back to black, which
// reads as a colour someone chose. A tag seeded or created without one starts
// at the app accent instead, in hex because the input takes nothing else.
const NO_COLOUR = '#7c3aed'

function startEdit(tag: StorageTag) {
  editingId.value = tag.id
  edit.name = tag.name
  edit.color = tag.color || NO_COLOUR
  editError.value = ''
}

function validateEdit(): FormError[] {
  // Normalised, not raw: '   ' and '' are the same empty name to the API.
  if (!normalizeTagName(edit.name)) {
    return [{ name: 'name', message: 'Tag name cannot be empty.' }]
  }
  return []
}

function cancelEdit() {
  editingId.value = ''
}

async function saveEdit(tag: StorageTag) {
  editError.value = ''
  try {
    await updateTag.mutateAsync({ id: tag.id, name: normalizeTagName(edit.name), color: edit.color })
    editingId.value = ''
  } catch (e) {
    editError.value = pbError(e)
  }
}

const deleteTarget = ref<StorageTag | null>(null)
const deleteOpen = computed({
  get: () => deleteTarget.value !== null,
  set: (value: boolean) => {
    if (!value) deleteTarget.value = null
  }
})
const deleteError = ref('')

function confirmDelete(tag: StorageTag) {
  deleteTarget.value = tag
  deleteError.value = ''
}

// What the delete takes with it. A tag is a relation, so removing it strips
// the label off every box and item carrying it — the reason to hesitate, and
// therefore the thing to show before the confirm rather than after.
const deleteNote = computed(() => {
  const target = deleteTarget.value
  if (!target) return ''
  const { boxCount, itemCount } = usageFor(target.id)
  if (boxCount === 0 && itemCount === 0) return ''
  const boxes = `${boxCount} ${boxCount === 1 ? 'box' : 'boxes'}`
  const items = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
  return `This label comes off ${boxes} and ${items}.`
})

async function performDelete() {
  if (!deleteTarget.value) return
  try {
    await deleteTag.mutateAsync(deleteTarget.value.id)
    deleteTarget.value = null
  } catch (e) {
    deleteError.value = pbError(e)
  }
}
</script>

<template>
  <div>
    <AppHeader>
      <template #title>
        <h1 class="sb-display text-[30px]">Tags</h1>
        <p class="sb-mono opacity-80">
          {{ totals.tags }} tags · {{ totals.boxes }} boxes · {{ totals.items }} items
        </p>
      </template>
    </AppHeader>

    <div class="sb-body flex flex-col gap-2.5">
      <div v-if="isPending" data-testid="tags-loading" class="grid gap-2.5 md:grid-cols-2">
        <USkeleton v-for="n in 3" :key="n" class="h-[62px] w-full rounded-[1.125rem]" />
      </div>

      <div v-else-if="isError" class="flex flex-col items-start gap-3">
        <UAlert color="error" title="Could not load tags" :description="pbError(error)" />
        <UButton data-testid="tags-retry" @click="refetch()">Try again</UButton>
      </div>

      <div
        v-else-if="(tags ?? []).length === 0"
        data-testid="tags-empty"
        class="flex flex-col items-center gap-4 px-2 py-12 text-center"
      >
        <div
          class="flex size-24 items-center justify-center rounded-[2rem]"
          :style="{ background: 'var(--sb-fill)', color: 'var(--sb-on-fill)' }"
        >
          <UIcon name="i-lucide-tag" class="size-11" aria-hidden="true" />
        </div>
        <p class="text-sm" :style="{ color: 'var(--sb-muted)' }">
          No tags yet. Tags are created from a box or item's tag picker.
        </p>
      </div>

      <ul v-else class="grid gap-2.5 md:grid-cols-2">
        <li
          v-for="tag in tags ?? []"
          :key="tag.id"
          class="sb-card p-3"
          :style="editingId === tag.id ? { borderColor: 'var(--sb-accent)' } : undefined"
        >
          <UForm
            v-if="editingId === tag.id"
            :state="edit"
            :validate="validateEdit"
            class="flex flex-col gap-2.5"
            @submit="saveEdit(tag)"
          >
            <div class="flex items-center gap-2.5">
              <!-- The swatch is the control: the native picker sits invisible
                   on top of it, so the thing you tap is the colour you are
                   changing rather than a separate field beside it. -->
              <span
                class="relative size-[30px] shrink-0 overflow-hidden rounded-[10px]"
                :style="{ background: edit.color }"
              >
                <label class="sr-only" :for="`tag-colour-${tag.id}`">Colour</label>
                <input
                  :id="`tag-colour-${tag.id}`"
                  v-model="edit.color"
                  type="color"
                  class="absolute inset-0 size-full cursor-pointer opacity-0"
                >
              </span>
              <UFormField label="Name" name="name" class="min-w-0 flex-1" :ui="{ label: 'sr-only' }">
                <UInput v-model="edit.name" class="w-full font-extrabold" />
              </UFormField>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-[11px] font-bold" :style="{ color: 'var(--sb-muted)' }">
                Updates {{ usageLabel(tag.id) }}
              </span>
              <div class="flex gap-1">
                <UButton variant="ghost" color="neutral" size="sm" @click="cancelEdit">Cancel</UButton>
                <UButton type="submit" size="sm" :loading="updateTag.isPending.value">Save</UButton>
              </div>
            </div>
          </UForm>

          <div v-else class="flex items-center gap-2.5">
            <span
              class="size-[30px] shrink-0 rounded-[10px]"
              :style="{ background: tag.color || 'var(--sb-accent)' }"
            />
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="text-[15px] font-extrabold">{{ tag.name }}</span>
              <span class="text-[11px] font-bold" :style="{ color: 'var(--sb-muted)' }">
                {{ usageLabel(tag.id) }}
              </span>
            </div>
            <!-- The accessible name comes from `sr-only` content, not an
                 `aria-label`: a label reading "Rename …" would be matched by
                 any by-label query for a "Name" field on the same screen. -->
            <UButton
              icon="i-lucide-pencil"
              variant="ghost"
              color="neutral"
              :data-testid="`rename-tag-${tag.name}`"
              @click="startEdit(tag)"
            >
              <span class="sr-only">Rename {{ tag.name }}</span>
            </UButton>
            <UButton
              v-if="canDelete"
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              :data-testid="`delete-tag-${tag.name}`"
              @click="confirmDelete(tag)"
            >
              <span class="sr-only">Delete {{ tag.name }}</span>
            </UButton>
          </div>
        </li>
      </ul>

      <UAlert v-if="editError" color="error" :description="editError" />
    </div>

    <DeleteConfirm
      v-model:open="deleteOpen"
      kind="tag"
      :title="deleteTarget?.name ?? ''"
      :pending="deleteTag.isPending.value"
      :error="deleteError"
      :note="deleteNote"
      @confirm="performDelete"
    />
  </div>
</template>
