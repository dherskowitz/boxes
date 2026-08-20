<script setup lang="ts">
const { mutateAsync: createBox, isPending } = useCreateBox()
const errorMessage = ref('')

async function onSubmit(payload: { title: string, description: string, location: string, tags: string[], images: File[] }) {
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
  <div class="flex flex-col gap-4">
    <h1 class="text-lg font-medium">New box</h1>
    <BoxForm :pending="isPending" :error="errorMessage" @submit="onSubmit" />
  </div>
</template>
