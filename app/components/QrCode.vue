<script setup lang="ts">
import { toDataURL } from 'qrcode'

const props = withDefaults(defineProps<{ value: string, size?: number }>(), {
  size: 240
})

const dataUrl = ref('')

watchEffect(async () => {
  const value = props.value
  const size = props.size
  const url = await toDataURL(value, { errorCorrectionLevel: 'M', width: size, margin: 1 })
  // Guard against a stale response landing after `value` changed again.
  if (value === props.value) dataUrl.value = url
})
</script>

<template>
  <img
    v-if="dataUrl"
    :src="dataUrl"
    :width="size"
    :height="size"
    :alt="`QR code for ${value}`"
    data-testid="qr-code"
    :data-qr-value="value"
  >
</template>
