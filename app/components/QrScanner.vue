<script setup lang="ts">
import { QrcodeStream } from 'vue-qrcode-reader'
import type { EmittedError } from 'vue-qrcode-reader'

type ScannerState = 'scanning' | 'invalid' | 'permission-denied' | 'no-camera' | 'error'

const state = ref<ScannerState>('scanning')
const errorMessage = ref('')

function onDetect(codes: { rawValue: string }[]) {
  const raw = codes[0]?.rawValue
  if (!raw) return
  const qrId = qrIdFromScan(raw)
  if (!qrId) {
    state.value = 'invalid'
    return
  }
  navigateTo(`/box/${qrId}`)
}

function onError(error: EmittedError) {
  if (error.name === 'NotAllowedError') {
    state.value = 'permission-denied'
  } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
    state.value = 'no-camera'
  } else {
    errorMessage.value = pbError(error)
    state.value = 'error'
  }
}
</script>

<template>
  <div data-testid="qr-scanner">
    <UAlert
      v-if="state === 'permission-denied'"
      color="warning"
      data-testid="scanner-permission-denied"
      title="Camera access denied"
      description="Allow camera access for this site in your browser settings, then try again."
    />
    <UAlert
      v-else-if="state === 'no-camera'"
      color="warning"
      data-testid="scanner-no-camera"
      title="No camera available"
      description="This device has no camera the app can use. Enter the box's code shown under its label instead."
    />
    <UAlert
      v-else-if="state === 'error'"
      color="error"
      data-testid="scanner-error"
      title="Could not start the camera"
      :description="errorMessage"
    />
    <template v-else>
      <QrcodeStream @detect="onDetect" @error="onError" />
      <UAlert
        v-if="state === 'invalid'"
        color="warning"
        data-testid="scanner-invalid"
        title="That is not a storage box code"
        description="Keep scanning, or try another code."
      />
    </template>
  </div>
</template>
