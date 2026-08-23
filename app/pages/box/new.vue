<script setup lang="ts">
definePageMeta({ nav: false })

const { mutateAsync: createBox, isPending } = useCreateBox()
const errorMessage = ref('')

async function onSubmit(payload: { title: string, description: string, location: string, tags: string[] }) {
  errorMessage.value = ''
  try {
    const box = await createBox(payload)
    await navigateTo(`/box/${box.qr_id}`)
  } catch (e) {
    errorMessage.value = pbError(e)
  }
}
</script>

<template>
  <div>
    <header class="sb-header">
      <div class="flex items-center justify-between gap-3">
        <UButton to="/boxes" variant="ghost" class="px-0 text-current opacity-85 hover:opacity-100">
          Cancel
        </UButton>
        <h1 class="text-[17px] font-extrabold">New box</h1>
        <!-- Balances "Cancel" so the title stays centred; the real submit is
             the full-width button at the bottom, in the thumb zone. -->
        <span class="w-14" aria-hidden="true" />
      </div>
    </header>

    <div class="sb-body pb-8">
      <BoxForm :pending="isPending" :error="errorMessage" @submit="onSubmit" />
    </div>
  </div>
</template>
