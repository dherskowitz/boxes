<script setup lang="ts">
import { QrcodeStream } from 'vue-qrcode-reader'
import type { EmittedError } from 'vue-qrcode-reader'

type ScannerState = 'scanning' | 'invalid' | 'permission-denied' | 'no-camera' | 'error'

const state = ref<ScannerState>('scanning')
const errorMessage = ref('')

// Four L-shaped corner marks. Spelled as data so the four near-identical
// class strings do not get retyped four times in the template.
const CORNERS = [
  { class: 'top-0 left-0 rounded-tl-[1.75rem] border-t-[5px] border-l-[5px]' },
  { class: 'top-0 right-0 rounded-tr-[1.75rem] border-t-[5px] border-r-[5px]' },
  { class: 'bottom-0 left-0 rounded-bl-[1.75rem] border-b-[5px] border-l-[5px]' },
  { class: 'bottom-0 right-0 rounded-br-[1.75rem] border-b-[5px] border-r-[5px]' }
] as const

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
  <div data-testid="qr-scanner" class="relative flex-1">
    <div v-if="state === 'permission-denied' || state === 'no-camera' || state === 'error'" class="p-[1.375rem]">
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
        v-else
        color="error"
        data-testid="scanner-error"
        title="Could not start the camera"
        :description="errorMessage"
      />
    </div>

    <template v-else>
      <QrcodeStream class="absolute inset-0 size-full" @detect="onDetect" @error="onError" />

      <!-- The amber target from the v2 design. `pointer-events-none` so none
           of it can sit between a tap and the camera surface. -->
      <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div class="relative size-64 rounded-[2.125rem] shadow-[0_0_0_2000px_rgba(8,8,10,.62)]">
          <span
            v-for="corner in CORNERS"
            :key="corner.class"
            class="absolute size-14 border-[oklch(0.86_0.17_88)]"
            :class="corner.class"
          />
          <span
            class="absolute inset-x-4 top-1/2 h-[3px] bg-[oklch(0.86_0.17_88)] shadow-[0_0_20px_oklch(0.86_0.17_88)]"
            style="animation: sb-pulse 1.6s ease-in-out infinite"
          />
          <span
            class="absolute -bottom-11 left-1/2 -translate-x-1/2 rounded-full px-3.5 py-1.5 text-xs font-extrabold whitespace-nowrap"
            :style="{ background: 'oklch(0.86 0.17 88)', color: '#2a1f06' }"
          >hold ~20 cm away</span>
        </div>
      </div>

      <div v-if="state === 'invalid'" class="absolute inset-x-[1.375rem] bottom-4">
        <UAlert
          color="warning"
          data-testid="scanner-invalid"
          title="That is not a storage box code"
          description="Keep scanning, or try another code."
        />
      </div>
    </template>
  </div>
</template>
