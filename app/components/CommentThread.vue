<script setup lang="ts">
import type { FormError } from '@nuxt/ui'
import type { StorageComment } from '~/types/pocketbase'

/** Shared by the new-comment form and the edit form. */
function validateText(text: string): FormError[] {
  if (text.trim() === '') return [{ name: 'text', message: 'Write something before saving.' }]
  return []
}

const props = defineProps<{ itemId: string }>()

const itemIdRef = computed(() => props.itemId)
const { data, isPending, isError, error } = useComments(itemIdRef)
// Undefined until the query resolves, so the badge can tell "still loading"
// from "no comments" — see useUnreadComments, which must not mark an item read
// before its thread has actually been shown.
const resolvedComments = computed(() => data.value?.items)
const comments = computed(() => resolvedComments.value ?? [])
const errorMessage = computed(() => (error.value ? pbError(error.value) : ''))

const userMap = useAppUserMap()
const { userId } = useAuthUser()

const unreadCount = useUnreadComments(itemIdRef, resolvedComments)

function authorName(comment: StorageComment): string {
  // A comment whose author has since lost membership won't appear in the
  // directory — still render the comment, just without a real name.
  return userMap.value.get(comment.user)?.name ?? 'Former member'
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString()
}

// New comment
const newComment = reactive({ text: '' })
const createError = ref('')
const { mutateAsync: createComment, isPending: createPending } = useCreateComment()
async function onSubmit() {
  createError.value = ''
  try {
    await createComment({ itemId: props.itemId, text: newComment.text })
    newComment.text = ''
  } catch (e) {
    createError.value = pbError(e)
  }
}

// Enter writes a newline, as it does in every other textarea in the app and in
// the phone keyboard's own muscle memory. Send is the button — a comment on a
// stored item is a note worth a second line, not a chat message.

// Edit
const editingComment = ref<StorageComment | null>(null)
const editComment = reactive({ text: '' })
const editOpen = ref(false)
const editError = ref('')
const { mutateAsync: updateComment, isPending: updatePending } = useUpdateComment()
function startEdit(comment: StorageComment) {
  editingComment.value = comment
  editComment.text = comment.text
  editError.value = ''
  editOpen.value = true
}
async function saveEdit() {
  const existing = editingComment.value
  if (!existing) return
  editError.value = ''
  try {
    await updateComment({ existing, text: editComment.text })
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
  <div
    data-testid="comment-thread"
    class="flex flex-col gap-4 border-t-2 pt-5"
    :style="{ borderColor: 'var(--sb-line)' }"
  >
    <!-- The heading earns its rule and its space once there is a thread to
         head. On an item with no comments it was a border, a title and a
         separate "No comments yet." block — three stacked elements to say that
         nothing is there, directly above a composer that says it better. -->
    <div v-if="isPending || isError || comments.length > 0" class="flex items-center gap-2">
      <h2 class="text-sm font-extrabold">Comments</h2>
      <span
        v-if="comments.length"
        class="sb-chip"
        :style="{ background: 'var(--sb-fill)', color: 'var(--sb-on-fill)' }"
      >{{ comments.length }}</span>
      <UBadge v-if="unreadCount > 0" color="secondary" data-testid="comment-unread-badge">{{ unreadCount }} new</UBadge>
    </div>

    <div v-if="isPending" data-testid="comment-thread-loading" class="flex flex-col gap-2">
      <USkeleton class="h-12 w-full" />
      <USkeleton class="h-12 w-full" />
    </div>

    <UAlert v-else-if="isError" color="error" data-testid="comment-thread-error" :description="errorMessage" />

    <template v-else>
      <p
        v-if="comments.length === 0"
        data-testid="comment-thread-empty"
        class="text-[13px]"
        :style="{ color: 'var(--sb-muted)' }"
      >
        No comments yet.
      </p>

      <ul v-else class="flex flex-col gap-3">
        <li v-for="comment in comments" :key="comment.id" data-testid="comment" class="flex gap-2.5">
          <UserAvatar :name="authorName(comment)" size="sm" />
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <div class="flex flex-wrap items-baseline gap-1.5">
              <span data-testid="comment-author" class="text-xs font-extrabold">{{ authorName(comment) }}</span>
              <span
                data-testid="comment-timestamp"
                class="text-[11px] font-semibold"
                :style="{ color: 'var(--sb-muted)' }"
              >· {{ formatTimestamp(comment.created) }}</span>
            </div>
            <!-- The one square corner points back at the author's avatar. -->
            <p
              data-testid="comment-text"
              class="rounded-[16px] rounded-bl-[5px] border-[1.5px] px-3 py-2.5 text-[13px] leading-snug"
              :style="{ background: 'var(--sb-surface)', borderColor: 'var(--sb-line)' }"
            >{{ comment.text }}</p>
            <div v-if="canEditComment(comment, userId)" class="flex gap-1">
              <UButton data-testid="comment-edit" size="xs" variant="ghost" color="neutral" @click="startEdit(comment)">Edit</UButton>
              <UButton data-testid="comment-delete" size="xs" variant="ghost" color="error" @click="askDelete(comment)">Delete</UButton>
            </div>
          </div>
        </li>
      </ul>
    </template>

    <UAlert v-if="createError" color="error" data-testid="comment-form-error" :description="createError" />
    <!-- The composer the design pins to the bottom of the item screen: your
         own avatar, the field, and one send button. -->
    <UForm
      :state="newComment"
      :validate="() => validateText(newComment.text)"
      class="pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      @submit="onSubmit"
    >
      <UFormField name="text">
        <!-- One bordered box holding the field and its own footer row, rather
             than a button floated over a textarea with 56px of dead padding
             underneath it. The box is now exactly as tall as what is in it,
             the border reacts to focus as a single object, and the row that
             carries Send has somewhere to put the keyboard hint. -->
        <div
          class="flex flex-col rounded-[1.5rem] border-2 border-(--sb-line) transition-colors focus-within:border-(--sb-accent)"
          :style="{ background: 'var(--sb-surface)' }"
        >
          <UTextarea
            v-model="newComment.text"
            :rows="2"
            :maxrows="8"
            autoresize
            variant="none"
            data-testid="comment-input"
            placeholder="Add a comment…"
            class="w-full"
            :ui="{ base: 'resize-none px-4 pt-3.5 pb-1 text-[14px]' }"
          />

          <div class="flex items-center justify-end pr-2.5 pb-2.5">
            <UButton
              type="submit"
              icon="i-lucide-send"
              data-testid="comment-submit"
              class="size-10 shrink-0 justify-center rounded-full"
              :loading="createPending"
              :disabled="createPending"
            >
              <span class="sr-only">Post comment</span>
            </UButton>
          </div>
        </div>
      </UFormField>
    </UForm>

    <UModal v-model:open="editOpen" title="Edit comment">
      <template #body>
        <UForm
          :state="editComment"
          :validate="() => validateText(editComment.text)"
          data-testid="comment-edit-form"
          class="flex flex-col gap-4"
          @submit="saveEdit"
        >
          <UFormField name="text">
            <UTextarea v-model="editComment.text" data-testid="comment-edit-input" class="w-full" />
          </UFormField>
          <UAlert v-if="editError" color="error" :description="editError" />
          <div class="flex gap-2">
            <UButton
              data-testid="comment-cancel-edit"
              size="xl"
              variant="ghost"
              color="neutral"
              class="flex-1 justify-center rounded-[1.25rem] font-extrabold"
              @click="editOpen = false"
            >
              Cancel
            </UButton>
            <UButton
              type="submit"
              data-testid="comment-save-edit"
              size="xl"
              class="flex-1 justify-center rounded-[1.25rem] font-extrabold"
              :loading="updatePending"
            >
              Save
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <UModal v-model:open="deleteOpen" title="Delete comment">
      <template #body>
        <div data-testid="comment-delete-confirm" class="flex flex-col gap-3">
          <p class="text-sm leading-relaxed" :style="{ color: 'var(--sb-muted)' }">
            Delete this comment? This cannot be undone.
          </p>
          <UAlert v-if="deleteError" color="error" :description="deleteError" />
        </div>
      </template>
      <template #footer>
        <UButton
          data-testid="comment-cancel-delete"
          size="xl"
          variant="ghost"
          color="neutral"
          class="flex-1 justify-center rounded-[1.25rem] font-extrabold"
          @click="deleteOpen = false"
        >
          Cancel
        </UButton>
        <UButton
          data-testid="comment-confirm-delete"
          size="xl"
          color="error"
          class="flex-1 justify-center rounded-[1.25rem] font-extrabold"
          :loading="deletePending"
          @click="confirmDelete"
        >
          Delete
        </UButton>
      </template>
    </UModal>
  </div>
</template>
