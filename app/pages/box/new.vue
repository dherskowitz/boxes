<script setup lang="ts">
definePageMeta({ nav: false })

// Static rather than `useId()`: the header's Save is a button outside the
// form that submits it through this id, and only one new-box form is ever
// mounted at a time.
const FORM_ID = 'new-box-form'

const { mutateAsync: createBox, isPending } = useCreateBox()
const errorMessage = ref('')

type NewBoxPayload = { title: string, description: string, location: string, tags: string[] }

/**
 * The two submits differ only in where they land.
 *
 * Save goes to the box, which is what you want when the label is already
 * printed or the box is not in front of you. Create box & print label goes to
 * the label, which is what you want when you have just taped one shut — the
 * whole point of the box is the code on its side, and making that a second
 * trip through the box index is how a box ends up unlabelled.
 */
async function submit(payload: NewBoxPayload, andPrint: boolean) {
  errorMessage.value = ''
  try {
    const box = await createBox(payload)
    await navigateTo(andPrint ? `/box/${box.qr_id}/print` : `/box/${box.qr_id}`)
  } catch (e) {
    errorMessage.value = pbError(e)
  }
}
</script>

<template>
  <div>
    <FormHeader
      title="New box"
      cancel-to="/boxes"
      submit-label="Save"
      :submit-for="FORM_ID"
      :pending="isPending"
    />

    <div class="sb-body pb-8">
      <BoxForm
        :form-id="FORM_ID"
        :pending="isPending"
        :error="errorMessage"
        @submit="payload => submit(payload, false)"
        @submit-and-print="payload => submit(payload, true)"
      />
    </div>
  </div>
</template>
