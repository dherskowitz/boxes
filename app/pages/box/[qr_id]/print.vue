<script setup lang="ts">
const route = useRoute()
const qrId = computed(() => {
  const param = route.params.qr_id
  if (Array.isArray(param)) return param[0] ?? ''
  return param ?? ''
})

const { data: box, isPending, isError } = useBoxByQrId(qrId)

const origin = window.location.origin
const qrValue = computed(() => boxQrUrl(qrId.value, origin))
const label = computed(() => box.value?.title || qrId.value)

function printLabel() {
  window.print()
}
</script>

<template>
  <div>
    <div v-if="isPending" data-testid="print-loading">
      <USkeleton class="h-8 w-48" />
    </div>

    <UAlert
      v-else-if="isError"
      data-testid="box-not-found"
      title="Box not found"
      description="No box matches this code."
    />

    <div v-else class="label">
      <UButton class="no-print" @click="printLabel">Print</UButton>
      <div class="label-content">
        <QrCode :value="qrValue" :size="240" />
        <p class="label-title">{{ label }}</p>
        <p class="label-id">{{ qrId }}</p>
      </div>
    </div>
  </div>
</template>

<style>
@media print {
  header,
  .no-print {
    display: none;
  }

  .label-content {
    break-inside: avoid;
  }
}
</style>
