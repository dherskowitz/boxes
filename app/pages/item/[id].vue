<script setup lang="ts">
import { ClientResponseError } from 'pocketbase'

const route = useRoute()
const id = computed(() => String(route.params.id))

const { data: item, isPending, isError, error } = useItem(id)

const isNotFound = computed(
  () => error.value instanceof ClientResponseError && error.value.status === 404
)
const errorMessage = computed(() => (error.value ? pbError(error.value) : ''))

const box = computed(() => item.value?.expand?.box)
const { canEdit } = useCanEdit(box)

const { $pb } = useNuxtApp()
const galleryUrls = computed(() => {
  const current = item.value
  if (!current) return []
  return current.images.map(name => $pb.files.getURL(current, name, { thumb: '400x400' }))
})

// Edit
const editOpen = ref(false)
const { mutateAsync: updateItem, isPending: updatePending } = useUpdateItem()
const updateError = ref('')
async function onUpdate(payload: { title: string, description: string, notes: string, tags: string[] }) {
  const current = item.value
  if (!current) return
  updateError.value = ''
  try {
    await updateItem({ existing: current, edit: payload })
    editOpen.value = false
  } catch (e) {
    updateError.value = pbError(e)
  }
}

// Delete
const deleteOpen = ref(false)
const { mutateAsync: deleteItem, isPending: deletePending } = useDeleteItem()
const deleteError = ref('')
async function onDelete() {
  const current = item.value
  if (!current) return
  const qrId = box.value?.qr_id
  deleteError.value = ''
  try {
    await deleteItem(current.id)
    deleteOpen.value = false
    await navigateTo(qrId ? `/box/${qrId}` : '/')
  } catch (e) {
    deleteError.value = pbError(e)
    deleteOpen.value = false
  }
}
</script>

<template>
  <div>
    <div v-if="isPending" data-testid="item-loading" class="flex flex-col gap-4">
      <USkeleton class="h-8 w-64" />
      <USkeleton class="h-40 w-full" />
    </div>

    <div v-else-if="isNotFound" data-testid="item-not-found" class="flex flex-col gap-3">
      <p>Item not found.</p>
      <UButton to="/">Back to boxes</UButton>
    </div>

    <UAlert v-else-if="isError" :description="errorMessage" />

    <div v-else-if="item" class="flex flex-col gap-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <h1 class="text-lg font-medium">{{ item.title }}</h1>
        <div class="flex flex-wrap gap-2">
          <UButton v-if="canEdit" data-testid="edit-item" @click="editOpen = true">Edit</UButton>
          <UButton
            v-if="canEdit"
            data-testid="delete-item"
            :loading="deletePending"
            @click="deleteOpen = true"
          >
            Delete
          </UButton>
        </div>
      </div>

      <UAlert v-if="deleteError" :description="deleteError" />

      <p v-if="item.description">{{ item.description }}</p>
      <p v-if="item.notes">{{ item.notes }}</p>

      <div v-if="galleryUrls.length > 0" class="flex flex-wrap gap-2">
        <img
          v-for="(url, index) in galleryUrls"
          :key="url"
          data-testid="item-gallery-image"
          :src="url"
          :alt="`${item.title}, photo ${index + 1}`"
          class="h-24 w-24 object-cover"
        >
      </div>
      <div v-else data-testid="item-gallery-empty">
        <p>No photos yet.</p>
      </div>

      <UModal v-model:open="deleteOpen" title="Delete item">
        <template #body>
          <div data-testid="delete-item-confirm" class="flex flex-col gap-4">
            <p>Delete "{{ item.title }}"? This cannot be undone.</p>
            <div class="flex gap-2">
              <UButton data-testid="cancel-delete-item" variant="ghost" @click="deleteOpen = false">
                Cancel
              </UButton>
              <UButton data-testid="confirm-delete-item" :loading="deletePending" @click="onDelete">
                Delete item
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <UModal v-model:open="editOpen" title="Edit item">
        <template #body>
          <ItemForm :existing="item" :pending="updatePending" :error="updateError" @submit="onUpdate" />
        </template>
      </UModal>

      <CommentThread :item-id="item.id" />
    </div>
  </div>
</template>
