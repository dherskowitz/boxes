<script setup lang="ts">
definePageMeta({ nav: false })

// Static rather than `useId()`: the header's Save is a button outside the form
// that submits it through this id, and only one is ever mounted at a time.
const FORM_ID = 'new-item-form'

const route = useRoute()
const qrId = computed(() => {
  const param = route.params.qr_id
  return typeof param === 'string' ? param : ''
})

const { data: box, isPending, isError, error } = useBoxByQrId(qrId)
useNotFound(error)

// The header wears the parent box's colour, so the screen says which box this
// is going into before the subtitle is read.
const vars = computed(() => boxColorVars(qrId.value))
const boxLabel = computed(() => box.value?.title || qrId.value)

const { mutateAsync: createItem, isPending: createPending } = useCreateItem()
const errorMessage = ref('')

// `reset()` lives on the form, which owns the field state.
const form = useTemplateRef('form')

// Confirms the last save without a toast that covers the field you are about
// to type in. It stands until the next save replaces it — a line of text that
// is still true is cheaper than a timer that erases it mid-glance.
const lastAdded = ref('')

interface ItemPayload {
  title: string
  description: string
  notes: string
  tags: string[]
  images: File[]
}

async function submit(payload: ItemPayload, andRepeat: boolean) {
  const current = box.value
  if (!current) return
  errorMessage.value = ''
  try {
    const item = await createItem({ boxId: current.id, ...payload })
    if (!andRepeat) {
      await navigateTo(`/item/${item.id}`)
      return
    }
    // Unpacking a box is a burst: the next thing is already in your other
    // hand, so stay here with an empty form rather than making the reader
    // walk back from the item they just made.
    lastAdded.value = item.title
    form.value?.reset()
  } catch (e) {
    errorMessage.value = pbError(e)
  }
}
</script>

<template>
  <div :style="vars">
    <FormHeader
      title="New item"
      :subtitle="isPending ? '' : `in ${boxLabel}`"
      :cancel-to="`/box/${qrId}`"
      submit-label="Save"
      :submit-for="FORM_ID"
      :pending="createPending"
    />

    <div class="sb-body sb-measure-form pb-8">
      <div v-if="isPending" data-testid="new-item-loading" class="flex flex-col gap-4 pt-2">
        <USkeleton v-for="n in 4" :key="n" class="h-12 w-full rounded-xl" />
      </div>

      <!-- A box that will not load is not a form you can submit: the create
           needs its id. -->
      <UAlert
        v-else-if="isError"
        color="error"
        title="Could not load this box"
        :description="pbError(error)"
        data-testid="new-item-box-error"
      />

      <template v-else>
        <p
          v-if="lastAdded"
          class="mb-3 flex items-center gap-2 text-sm font-bold"
          :style="{ color: 'var(--c)' }"
          data-testid="item-added"
        >
          <UIcon name="i-lucide-check" class="size-4 shrink-0" aria-hidden="true" />
          Added “{{ lastAdded }}”
        </p>

        <ItemForm
          ref="form"
          :form-id="FORM_ID"
          add-another
          :pending="createPending"
          :error="errorMessage"
          @submit="payload => submit(payload, false)"
          @submit-and-repeat="payload => submit(payload, true)"
        />
      </template>
    </div>
  </div>
</template>
