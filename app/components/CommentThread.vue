<script setup lang="ts">
import type { StorageComment } from '~/types/pocketbase'

const props = defineProps<{ itemId: string }>()

const itemIdRef = computed(() => props.itemId)
const { data, isPending, isError, error } = useComments(itemIdRef)
const comments = computed(() => data.value?.items ?? [])
const errorMessage = computed(() => (error.value ? pbError(error.value) : ''))

const userMap = useAppUserMap()
const { userId } = useAuthUser()

const unreadCount = useUnreadComments(itemIdRef, comments)
onMounted(() => markItemRead(props.itemId))

function authorName(comment: StorageComment): string {
  // A comment whose author has since lost membership won't appear in the
  // directory — still render the comment, just without a real name.
  return userMap.value.get(comment.user)?.name ?? 'Former member'
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString()
}

// New comment
const newText = ref('')
const createError = ref('')
const { mutateAsync: createComment, isPending: createPending } = useCreateComment()
async function onSubmit() {
  if (newText.value.trim() === '') return
  createError.value = ''
  try {
    await createComment({ itemId: props.itemId, text: newText.value })
    newText.value = ''
  } catch (e) {
    createError.value = pbError(e)
  }
}

// Edit
const editingComment = ref<StorageComment | null>(null)
const editText = ref('')
const editOpen = ref(false)
const editError = ref('')
const { mutateAsync: updateComment, isPending: updatePending } = useUpdateComment()
function startEdit(comment: StorageComment) {
  editingComment.value = comment
  editText.value = comment.text
  editError.value = ''
  editOpen.value = true
}
async function saveEdit() {
  const existing = editingComment.value
  if (!existing || editText.value.trim() === '') return
  editError.value = ''
  try {
    await updateComment({ existing, text: editText.value })
    editOpen.value = false
  } catch (e) {
    editError.value = pbError(e)
  }
}

// Delete
const deletingComment = ref<StorageComment | null>(null)
const deleteOpen = ref(false)
const deleteError = ref('')
const { mutateAsync: deleteComment, isPending: deletePending } = useDeleteComment()
function askDelete(comment: StorageComment) {
  deletingComment.value = comment
  deleteError.value = ''
  deleteOpen.value = true
}
async function confirmDelete() {
  const comment = deletingComment.value
  if (!comment) return
  deleteError.value = ''
  try {
    await deleteComment({ id: comment.id, itemId: props.itemId })
    deleteOpen.value = false
  } catch (e) {
    deleteError.value = pbError(e)
  }
}
</script>

<template>
  <div data-testid="comment-thread" class="flex flex-col gap-4">
    <div class="flex items-center gap-2">
      <h2 class="text-base font-medium">Comments</h2>
      <UBadge v-if="unreadCount > 0" data-testid="comment-unread-badge">{{ unreadCount }} new</UBadge>
    </div>

    <div v-if="isPending" data-testid="comment-thread-loading" class="flex flex-col gap-2">
      <USkeleton class="h-12 w-full" />
      <USkeleton class="h-12 w-full" />
    </div>

    <UAlert v-else-if="isError" data-testid="comment-thread-error" :description="errorMessage" />

    <template v-else>
      <div v-if="comments.length === 0" data-testid="comment-thread-empty">
        <p>No comments yet.</p>
      </div>

      <ul v-else class="flex flex-col gap-3">
        <li v-for="comment in comments" :key="comment.id" data-testid="comment" class="flex flex-col gap-1 border p-3">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <span data-testid="comment-author" class="text-sm font-medium">{{ authorName(comment) }}</span>
            <span data-testid="comment-timestamp" class="text-xs">{{ formatTimestamp(comment.created) }}</span>
          </div>
          <p data-testid="comment-text">{{ comment.text }}</p>
          <div v-if="canEditComment(comment, userId)" class="flex gap-2">
            <UButton data-testid="comment-edit" variant="ghost" @click="startEdit(comment)">Edit</UButton>
            <UButton data-testid="comment-delete" variant="ghost" @click="askDelete(comment)">Delete</UButton>
          </div>
        </li>
      </ul>
    </template>

    <UAlert v-if="createError" data-testid="comment-form-error" :description="createError" />
    <form class="flex flex-col gap-2" @submit.prevent="onSubmit">
      <UTextarea
        v-model="newText"
        data-testid="comment-input"
        placeholder="Add a comment"
        class="w-full"
      />
      <UButton
        type="submit"
        data-testid="comment-submit"
        :loading="createPending"
        :disabled="createPending || newText.trim() === ''"
      >
        Post comment
      </UButton>
    </form>

    <UModal v-model:open="editOpen" title="Edit comment">
      <template #body>
        <div data-testid="comment-edit-form" class="flex flex-col gap-4">
          <UTextarea v-model="editText" data-testid="comment-edit-input" class="w-full" />
          <UAlert v-if="editError" :description="editError" />
          <div class="flex gap-2">
            <UButton data-testid="comment-cancel-edit" variant="ghost" @click="editOpen = false">
              Cancel
            </UButton>
            <UButton
              data-testid="comment-save-edit"
              :loading="updatePending"
              :disabled="editText.trim() === ''"
              @click="saveEdit"
            >
              Save
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="deleteOpen" title="Delete comment">
      <template #body>
        <div data-testid="comment-delete-confirm" class="flex flex-col gap-4">
          <p>Delete this comment? This cannot be undone.</p>
          <UAlert v-if="deleteError" :description="deleteError" />
          <div class="flex gap-2">
            <UButton data-testid="comment-cancel-delete" variant="ghost" @click="deleteOpen = false">
              Cancel
            </UButton>
            <UButton data-testid="comment-confirm-delete" :loading="deletePending" @click="confirmDelete">
              Delete
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
