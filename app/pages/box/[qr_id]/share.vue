<script setup lang="ts">
import { ClientResponseError } from 'pocketbase'
import type { StorageBoxPermission } from '~/types/pocketbase'

const route = useRoute()
const qrId = computed(() => String(route.params.qr_id))

const {
  data: box,
  isPending: boxPending,
  isError: boxIsError,
  error: boxError
} = useBoxByQrId(qrId)

const isNotFound = computed(
  () => boxError.value instanceof ClientResponseError && boxError.value.status === 404
)
const boxErrorMessage = computed(() => (boxError.value ? pbError(boxError.value) : ''))

const { userId } = useAuthUser()
// Sharing is managed by the box's creator only — the same asymmetry that
// keeps delete creator-only, so this reuses canDeleteBox rather than adding
// a second "is creator" predicate that could drift from it.
const isCreator = computed(() => canDeleteBox(box.value, userId.value))

const boxId = computed(() => box.value?.id ?? '')
const {
  data: permissionsResult,
  isPending: permissionsPending,
  isError: permissionsIsError,
  error: permissionsError,
  refetch: refetchPermissions
} = useBoxPermissions(boxId)
const permissionsErrorMessage = computed(() => (permissionsError.value ? pbError(permissionsError.value) : ''))

const editors = computed(() => (permissionsResult.value?.items ?? []).filter(p => p.role === 'editor'))

const userMap = useAppUserMap()
function nameFor(id: string): string {
  return userMap.value.get(id)?.name ?? 'Unknown member'
}

const grantable = useGrantableUsers(box)
const grantableOptions = computed(() => grantable.value.map(u => ({ label: u.name, value: u.id })))
const selectedUserId = ref('')

const { mutateAsync: grantEditor, isPending: grantPending } = useGrantEditor()
const grantError = ref('')
async function onGrant() {
  const current = box.value
  if (!current || !selectedUserId.value) return
  grantError.value = ''
  try {
    await grantEditor({ boxId: current.id, userId: selectedUserId.value })
    selectedUserId.value = ''
  } catch (e) {
    grantError.value = pbError(e)
  }
}

const { mutateAsync: revokeEditor, isPending: revokePending } = useRevokeEditor()
const revokeError = ref('')
const revokingId = ref('')
async function onRevoke(permission: StorageBoxPermission) {
  const current = box.value
  if (!current) return
  revokeError.value = ''
  revokingId.value = permission.id
  try {
    await revokeEditor({ id: permission.id, boxId: current.id })
  } catch (e) {
    revokeError.value = pbError(e)
  } finally {
    revokingId.value = ''
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="boxPending" data-testid="share-loading" class="flex flex-col gap-2">
      <USkeleton class="h-8 w-64" />
      <USkeleton class="h-24 w-full" />
    </div>

    <div v-else-if="isNotFound" data-testid="share-box-not-found" class="flex flex-col gap-3">
      <p>Box not found.</p>
      <UButton to="/">Back to boxes</UButton>
    </div>

    <UAlert v-else-if="boxIsError" :description="boxErrorMessage" />

    <div v-else-if="box" class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-lg font-medium">Share "{{ box.title || box.qr_id }}"</h1>
        <UButton variant="ghost" :to="`/box/${qrId}`">Back to box</UButton>
      </div>

      <div v-if="!isCreator" data-testid="share-denied">
        <p>Only the box's creator can manage sharing.</p>
      </div>

      <div v-else class="flex flex-col gap-4">
        <div v-if="permissionsPending" data-testid="share-editors-loading" class="flex flex-col gap-2">
          <USkeleton class="h-10 w-full" />
        </div>

        <div v-else-if="permissionsIsError" class="flex flex-col items-start gap-3">
          <UAlert title="Could not load editors" :description="permissionsErrorMessage" />
          <UButton data-testid="share-editors-retry" @click="refetchPermissions()">Try again</UButton>
        </div>

        <template v-else>
          <p v-if="editors.length === 0" data-testid="share-empty">
            No editors yet. Only you can edit this box.
          </p>

          <ul v-else class="flex flex-col gap-2">
            <li
              v-for="editor in editors"
              :key="editor.id"
              data-testid="share-editor-row"
              class="flex items-center justify-between gap-3 border-b pb-2"
            >
              <span>{{ nameFor(editor.user) }}</span>
              <UButton
                variant="ghost"
                data-testid="revoke-editor"
                :loading="revokingId === editor.id && revokePending"
                @click="onRevoke(editor)"
              >
                Remove
              </UButton>
            </li>
          </ul>

          <UAlert v-if="revokeError" :description="revokeError" />
        </template>

        <div class="flex flex-wrap items-end gap-2">
          <UFormField label="Grant editor" class="min-w-40 flex-1">
            <USelect
              v-model="selectedUserId"
              data-testid="grantable-users"
              :items="grantableOptions"
              placeholder="Choose a member"
            />
          </UFormField>
          <UButton
            data-testid="grant-editor"
            :loading="grantPending"
            :disabled="!selectedUserId"
            @click="onGrant"
          >
            Grant
          </UButton>
        </div>

        <p v-if="!permissionsPending && grantableOptions.length === 0">
          Every member already has access.
        </p>

        <UAlert v-if="grantError" :description="grantError" />
      </div>
    </div>
  </div>
</template>
