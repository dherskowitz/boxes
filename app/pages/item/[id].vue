<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
definePageMeta({ nav: false })

const route = useRoute()
const id = computed(() => String(route.params.id))

const { data: item, isPending, isError, error } = useItem(id)

// Deleting this item invalidates its own detail query, which then refetches
// and 404s while we are still on the page — an expected 404, not a wrong
// address, so it must not reach the error screen.
const deleting = ref(false)
useNotFound(error, deleting)
const errorMessage = computed(() => (error.value ? pbError(error.value) : ''))

const box = computed(() => item.value?.expand?.box)
const { canEdit } = useCanEdit(box)

const { $pb } = useNuxtApp()
// The viewer gets the originals — a 400px thumbnail stretched to fill a phone
// screen is exactly the case the gallery exists to serve well.
const fullUrls = computed(() => {
  const current = item.value
  if (!current) return []
  return current.images.map(name => $pb.files.getURL(current, name))
})

const lightboxOpen = ref(false)
const lightboxIndex = ref(0)
function openLightbox(at: number) {
  lightboxIndex.value = at
  lightboxOpen.value = true
}

const galleryUrls = computed(() => {
  const current = item.value
  if (!current) return []
  return current.images.map(name => $pb.files.getURL(current, name, { thumb: '400x400' }))
})

// The parent box's signature colour, so an item reads as belonging to its box
// before the box's name is read. Falls back to the app accent for a record
// whose `box` relation was not expanded.
const vars = computed(() => (box.value ? boxColorVars(box.value.qr_id) : {}))

const { data: tags } = useTags()
const tagNames = computed(() =>
  (item.value?.tags ?? [])
    .map(tagId => (tags.value ?? []).find(t => t.id === tagId)?.name)
    .filter((name): name is string => Boolean(name))
)

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
const itemActions = computed<DropdownMenuItem[]>(() => {
  if (!canEdit.value) return []
  return [
    { label: 'Edit item', icon: 'i-lucide-pencil', onSelect: () => { editOpen.value = true } },
    { type: 'separator' },
    { label: 'Delete item', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => { deleteOpen.value = true } }
  ]
})

const deleteOpen = ref(false)
const { mutateAsync: deleteItem, isPending: deletePending } = useDeleteItem()
const deleteError = ref('')
async function onDelete() {
  const current = item.value
  if (!current) return
  const qrId = box.value?.qr_id
  deleteError.value = ''
  deleting.value = true
  try {
    await deleteItem(current.id)
    deleteOpen.value = false
    await navigateTo(qrId ? `/box/${qrId}` : '/')
  } catch (e) {
    // Left open on purpose: the dialog is where the error is rendered, and
    // closing it would drop the only explanation of why nothing happened.
    deleting.value = false
    deleteError.value = pbError(e)
  }
}
</script>

<template>
  <div :style="vars">
    <div v-if="isPending" data-testid="item-loading" class="sb-body flex flex-col gap-4 pt-6">
      <USkeleton class="h-8 w-64" />
      <USkeleton class="h-40 w-full" />
    </div>

    <UAlert v-else-if="isError" color="error" class="m-[1.375rem]" :description="errorMessage" />

    <div v-else-if="item" class="pb-10">
      <!-- Colour-washed hero: the item's first photo where there is one, the
           box's colour where there is not. Either way the block is the box's
           colour, which is what carries the "this lives in that box" cue. -->
      <div
        class="relative flex h-[276px] items-end justify-center pb-9"
        :style="{ background: 'var(--c, var(--sb-accent))', color: 'var(--c-on, #fff)' }"
      >
        <button
          v-if="galleryUrls[0]"
          type="button"
          data-testid="open-lightbox"
          :aria-label="`View photos of ${item.title} full screen`"
          class="absolute inset-0"
          @click="openLightbox(0)"
        >
          <img
            data-testid="item-gallery-image"
            :src="galleryUrls[0]"
            :alt="`${item.title}, photo 1`"
            class="size-full object-cover"
          >
        </button>
        <div v-else class="absolute inset-0 flex items-center justify-center">
          <span class="flex size-29 items-center justify-center rounded-full border-2 border-white/40 bg-white/20">
            <UIcon name="i-lucide-package" class="size-13" aria-hidden="true" />
          </span>
        </div>

        <div class="absolute inset-x-[18px] top-[max(env(safe-area-inset-top),1rem)] flex justify-between">
          <UButton
            :to="box ? `/box/${box.qr_id}` : '/boxes'"
            icon="i-lucide-arrow-left"
            aria-label="Back to box"
            color="neutral"
            variant="solid"
            class="size-10 justify-center rounded-full bg-white text-[#1c1a17] shadow-lg hover:bg-white/90"
          />
          <UDropdownMenu
            v-if="itemActions.length"
            :items="itemActions"
            :content="{ align: 'end' }"
          >
            <UButton
              data-testid="item-actions"
              icon="i-lucide-ellipsis-vertical"
              aria-label="Item actions"
              color="neutral"
              :loading="deletePending"
              class="size-10 justify-center rounded-full bg-white text-[#1c1a17] shadow-lg hover:bg-white/90"
            />
          </UDropdownMenu>
        </div>

        <!-- A count, not dots. The dots that used to sit here were pinned to
             index 0 over an image that never moved: a carousel indicator for a
             carousel that did not exist. The real dots live in the viewer,
             where swiping actually changes the photo. -->
        <span
          v-if="galleryUrls.length > 1"
          class="sb-chip relative bg-black/45 px-2.5 py-1 text-white"
          data-testid="item-photo-count"
        >
          <UIcon name="i-lucide-images" class="size-3.5" aria-hidden="true" />
          {{ galleryUrls.length }} photos
        </span>
      </div>

      <div
        class="relative z-10 -mt-6 rounded-t-[1.875rem] px-[1.375rem] pt-[18px]"
        :style="{ background: 'var(--sb-bg)' }"
      >
        <div class="flex flex-col">
          <NuxtLink
            v-if="box"
            :to="`/box/${box.qr_id}`"
            class="sb-chip sb-chip-solid max-w-full items-start self-start px-3 py-1.5 whitespace-normal"
          >
            <UIcon name="i-lucide-package" class="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <!-- Wraps rather than truncating, and the location is dropped. The
                 chip answers "which box is this in" — with `· Basement under
                 the stairs` appended, a real box title ran out of room before
                 it finished and the answer was the part that got cut. -->
            <span class="min-w-0 text-left leading-snug break-words">
              {{ box.title || box.qr_id }}
            </span>
          </NuxtLink>

          <h1 class="sb-display mt-3 text-[27px] break-words">{{ item.title }}</h1>

          <!-- Full text colour, not muted: this is the item's own description,
               and next to the amber notes callout a grey line read as a caption
               on the note rather than the item's primary text. -->
          <p v-if="item.description" class="mt-2 text-[15px] leading-relaxed">
            {{ item.description }}
          </p>

          <div v-if="tagNames.length" class="mt-3.5 flex flex-wrap gap-1.5">
            <span v-for="name in tagNames" :key="name" class="sb-chip sb-chip-outline px-3 py-1.5">{{ name }}</span>
          </div>

          <!-- Notes are editors-only in the schema, and the design gives them
               their own amber callout so they never read as description. -->
          <!-- A left rule and a tint rather than a filled amber card with a 2px
               border. It still reads as a note and not as description, without
               being the loudest block on a screen where the description above
               is the more important text. -->
          <div
            v-if="item.notes"
            class="mt-4 flex gap-2.5 rounded-r-xl py-2.5 pr-3 pl-3"
            :style="{
              background: 'color-mix(in oklch, var(--sb-amber) 14%, var(--sb-surface))',
              borderLeft: '3px solid var(--sb-amber)'
            }"
          >
            <UIcon name="i-lucide-sticky-note" class="mt-0.5 size-4 shrink-0 opacity-70" aria-hidden="true" />
            <p class="text-[13px] leading-snug">{{ item.notes }}</p>
          </div>

          <div v-if="galleryUrls.length > 1" class="mt-4 flex flex-wrap gap-2">
            <button
              v-for="(url, index) in galleryUrls.slice(1)"
              :key="url"
              type="button"
              class="rounded-2xl"
              :aria-label="`View photo ${index + 2} of ${item.title} full screen`"
              @click="openLightbox(index + 1)"
            >
              <img
                data-testid="item-gallery-image"
                :src="url"
                :alt="`${item.title}, photo ${index + 2}`"
                class="size-24 rounded-2xl object-cover"
              >
            </button>
          </div>
          <p
            v-else-if="galleryUrls.length === 0"
            data-testid="item-gallery-empty"
            class="mt-4 text-sm"
            :style="{ color: 'var(--sb-muted)' }"
          >
            No photos yet.
          </p>
        </div>

        <CommentThread :item-id="item.id" class="mt-7" />
      </div>

      <DeleteConfirm
        v-model:open="deleteOpen"
        kind="item"
        :title="item.title"
        :pending="deletePending"
        :error="deleteError"
        @confirm="onDelete"
      />

      <PhotoLightbox
        v-model:open="lightboxOpen"
        v-model:index="lightboxIndex"
        :urls="fullUrls"
        :label="item.title"
      />

      <UModal v-model:open="editOpen" title="Edit item">
        <template #body>
          <ItemForm :existing="item" :pending="updatePending" :error="updateError" @submit="onUpdate" />
        </template>
      </UModal>
    </div>
  </div>
</template>
