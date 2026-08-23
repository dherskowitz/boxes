<script setup lang="ts">
/**
 * The confirmation every destructive action goes through.
 *
 * Deleting a box or an item is not undoable and not recoverable — there is no
 * trash — so a single "are you sure" button one mis-tap away from the bin icon
 * is not enough. This shows the exact name of the thing, offers to copy it,
 * and only enables the delete once that name has been typed back.
 *
 * `blockedReason` covers the case where the delete cannot succeed at all: the
 * dialog explains why and offers no way through, which is a better home for
 * that sentence than a greyed-out control with a note floating near it.
 */
const props = defineProps<{
  /** 'box' | 'item' | 'tag' — used in the copy and to derive the testids. */
  kind: string
  /** The exact text the user must type back. */
  title: string
  pending?: boolean
  error?: string
  /** Set when the delete cannot proceed; suppresses the confirm entirely. */
  blockedReason?: string
  /** What else this delete affects — shown above the confirm, not hidden. */
  note?: string
}>()

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ confirm: [] }>()

const typed = ref('')
const copied = ref(false)
const copyError = ref('')

// A stale value from the last time the dialog was opened would leave the
// delete button armed before the user has typed anything.
watch(open, (isOpen) => {
  if (!isOpen) return
  typed.value = ''
  copied.value = false
  copyError.value = ''
})

// Case-insensitive and trimmed. The guard here is deliberateness, not
// transcription accuracy — and the copy button exists precisely so nobody has
// to retype a 90-character box title by hand.
const matches = computed(
  () => typed.value.trim().toLowerCase() === props.title.trim().toLowerCase() && props.title !== ''
)

async function copyTitle() {
  copyError.value = ''
  try {
    await navigator.clipboard.writeText(props.title)
    copied.value = true
  } catch {
    // Not an unexpected failure: the Clipboard API needs a secure context and
    // a permission, and neither is guaranteed. Say what to do instead.
    copyError.value = 'Could not copy. Select the name above and copy it by hand.'
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="`Delete ${kind}`">
    <template #body>
      <div :data-testid="`delete-${kind}-confirm`" class="flex flex-col gap-3">
        <UAlert
          v-if="blockedReason"
          color="warning"
          :data-testid="`delete-${kind}-blocked`"
          :description="blockedReason"
        />

        <template v-else>
          <UAlert
            v-if="note"
            color="warning"
            :data-testid="`delete-${kind}-note`"
            :description="note"
          />

          <p class="text-sm leading-relaxed" :style="{ color: 'var(--sb-muted)' }">
            This cannot be undone. Type the {{ kind }}'s name to confirm.
          </p>

          <div class="sb-card flex items-center gap-2 p-3">
            <span class="min-w-0 flex-1 font-mono text-[13px] break-words">{{ title }}</span>
            <UButton
              :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              size="sm"
              variant="ghost"
              color="neutral"
              :data-testid="`delete-${kind}-copy`"
              @click="copyTitle"
            >
              <span class="sr-only">Copy the {{ kind }} name</span>
            </UButton>
          </div>

          <UFormField :label="`Type ${kind} name`" :ui="{ label: 'sr-only' }">
            <UInput
              v-model="typed"
              autocapitalize="none"
              autocomplete="off"
              spellcheck="false"
              size="lg"
              class="w-full"
              :placeholder="`Type the ${kind} name`"
              :data-testid="`delete-${kind}-input`"
            />
          </UFormField>

          <p v-if="copyError" class="text-xs" :style="{ color: 'var(--sb-muted)' }">{{ copyError }}</p>
        </template>

        <UAlert v-if="error" color="error" :description="error" />
      </div>
    </template>

    <template #footer>
      <UButton
        size="xl"
        variant="ghost"
        color="neutral"
        class="flex-1 justify-center rounded-[1.25rem] font-extrabold"
        :data-testid="`cancel-delete-${kind}`"
        @click="open = false"
      >
        Cancel
      </UButton>
      <!-- disabled:opacity-40, not Nuxt UI's default 75: a red button that
           still looks live is the opposite of what a locked confirm should
           read as. -->
      <UButton
        v-if="!blockedReason"
        size="xl"
        color="error"
        class="flex-1 justify-center rounded-[1.25rem] font-extrabold disabled:opacity-40"
        :data-testid="`confirm-delete-${kind}`"
        :loading="pending"
        :disabled="!matches || pending"
        @click="emit('confirm')"
      >
        Delete {{ kind }}
      </UButton>
    </template>
  </UModal>
</template>
