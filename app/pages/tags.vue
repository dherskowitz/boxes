<script setup lang="ts">
import type { StorageTag } from '~/types/pocketbase'

const { data: tags, isPending, isError, error, refetch } = useTags()
const tagUsage = useTagUsageMap()
const { role } = useAuth()

const renameTag = useRenameTag()
const deleteTag = useDeleteTag()

const canDelete = computed(() => role.value === 'owner' || role.value === 'admin')

function usageFor(tagId: string) {
  return tagUsage.value.get(tagId) ?? { boxCount: 0, itemCount: 0 }
}

const editingId = ref('')
const editName = ref('')
const renameError = ref('')

function startRename(tag: StorageTag) {
  editingId.value = tag.id
  editName.value = tag.name
  renameError.value = ''
}

function cancelRename() {
  editingId.value = ''
}

async function saveRename(tag: StorageTag) {
  renameError.value = ''
  const name = normalizeTagName(editName.value)
  if (!name) {
    renameError.value = 'Tag name cannot be empty.'
    return
  }
  try {
    await renameTag.mutateAsync({ id: tag.id, name })
    editingId.value = ''
  } catch (e) {
    renameError.value = pbError(e)
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
  <div class="flex flex-col gap-4">
    <h1 class="text-lg font-medium">Tags</h1>

    <div v-if="isPending" data-testid="tags-loading" class="flex flex-col gap-2">
      <USkeleton v-for="n in 3" :key="n" class="h-10 w-full" />
    </div>

    <div v-else-if="isError" class="flex flex-col items-start gap-3">
      <UAlert color="error" title="Could not load tags" :description="pbError(error)" />
      <UButton data-testid="tags-retry" @click="refetch()">Try again</UButton>
    </div>

    <p v-else-if="(tags ?? []).length === 0" data-testid="tags-empty">
      No tags yet. Tags are created from a box or item's tag picker.
    </p>

    <ul v-else class="flex flex-col gap-3">
      <li v-for="tag in tags ?? []" :key="tag.id" class="flex flex-wrap items-center gap-3 border-b pb-3">
        <span
          class="h-4 w-4 shrink-0 rounded-full"
          :style="tag.color ? { backgroundColor: tag.color } : undefined"
        />

        <template v-if="editingId === tag.id">
          <UFormField label="Name" class="min-w-40 flex-1">
            <UInput v-model="editName" class="w-full" />
          </UFormField>
          <UButton :loading="renameTag.isPending.value" @click="saveRename(tag)">
            Save
          </UButton>
          <UButton variant="ghost" @click="cancelRename">Cancel</UButton>
        </template>

        <template v-else>
          <span class="min-w-0 flex-1">{{ tag.name }}</span>
          <span class="text-sm text-dimmed">
            {{ usageFor(tag.id).boxCount }} boxes, {{ usageFor(tag.id).itemCount }} items
          </span>
          <UButton
            variant="ghost"
            :data-testid="`rename-tag-${tag.name}`"
            @click="startRename(tag)"
          >
            Rename
          </UButton>
          <UButton
            v-if="canDelete"
            variant="ghost"
            :data-testid="`delete-tag-${tag.name}`"
            @click="confirmDelete(tag)"
          >
            Delete
          </UButton>
        </template>
      </li>
    </ul>

    <UAlert v-if="renameError" color="error" :description="renameError" />

    <UModal
      v-model:open="deleteOpen"
      title="Delete tag"
      :description="
        deleteTarget
          ? `'${deleteTarget.name}' is used on ${usageFor(deleteTarget.id).boxCount} boxes and ${usageFor(deleteTarget.id).itemCount} items. Delete anyway?`
          : ''
      "
    >
      <template #footer>
        <UAlert v-if="deleteError" color="error" :description="deleteError" />
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="deleteTarget = null">Cancel</UButton>
          <UButton :loading="deleteTag.isPending.value" @click="performDelete">
            Delete
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
