<script setup lang="ts">
import { QrcodeCapture } from 'vue-qrcode-reader'
import type { FormError } from '@nuxt/ui'

// Full-bleed and dark: the camera is the screen, so the shell's nav pill and
// padded body would only sit on top of it. The layout's offline notice goes
// too — this screen has its own, in its own colours, under the viewfinder, and
// the pair of them said the same thing twice.
definePageMeta({ nav: false, rail: false, offlineBanner: false })

const { isOnline } = useOnline()

// PRD §7.3's manual fallback, drawn as "Enter code" in the v2 design. A label
// that will not scan — creased, wet, badly lit — still has its id printed
// under the code, and typing eight characters beats losing the box.
const codeOpen = ref(false)
const codeState = reactive({ code: '' })

function normalizeCode(raw: string): string {
  return raw.trim().toLowerCase()
}

function validateCode(): FormError[] {
  const code = normalizeCode(codeState.code)
  if (!code) return [{ name: 'code', message: 'Enter the code printed under the QR square.' }]
  if (!/^[a-z0-9]{8}$/.test(code)) {
    return [{ name: 'code', message: 'A box code is eight letters and digits.' }]
  }
  return []
}

// The code a scan resolved to, which swaps the camera for the confirmation.
// Null means the camera is live.
const hit = ref<string | null>(null)

function onHit(qrId: string) {
  hit.value = qrId
}

function onScanAgain() {
  hit.value = null
}

async function onCodeSubmit() {
  await navigateTo(`/box/${normalizeCode(codeState.code)}`)
}

// "From photo": the same scan, run against a picture from the library rather
// than the live camera. Untrusted input, so it goes through `qrIdFromScan`
// exactly like a live scan — never navigate to the scanned URL itself.
const photoError = ref('')

async function onPhotoDetect(codes: { rawValue: string }[]) {
  const raw = codes[0]?.rawValue
  const qrId = raw ? qrIdFromScan(raw) : null
  if (!qrId) {
    photoError.value = 'No storage box code found in that picture.'
    return
  }
  photoError.value = ''
  // Same confirmation as a live scan: a code read off a photo is more likely
  // to be the wrong box, not less.
  hit.value = qrId
}
</script>

<template>
  <div class="flex min-h-dvh flex-col text-[#f4f2ec]" :style="{ background: '#0f0e11' }">
    <ScanHit v-if="hit" :qr-id="hit" @again="onScanAgain" />

    <template v-else>
    <div class="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),0.75rem)] pb-1">
      <UButton
        to="/boxes"
        icon="i-lucide-x"
        aria-label="Close scanner"
        variant="ghost"
        class="size-10 justify-center rounded-full bg-white/15 text-current hover:bg-white/25"
      />
      <h1 class="text-[15px] font-extrabold">Scan a box label</h1>
      <!-- Balances the close button so the title stays centred. -->
      <span class="size-10" aria-hidden="true" />
    </div>

    <QrScanner @hit="onHit" />

    <div class="relative flex flex-col gap-3.5 px-[1.375rem] pt-4 pb-[calc(1.75rem+env(safe-area-inset-bottom))]">
      <div
        v-if="!isOnline"
        data-testid="scan-offline-hint"
        class="flex items-center gap-3 rounded-[1.25rem] border border-white/15 bg-white/10 p-3.5"
      >
        <span class="flex size-11 shrink-0 items-center justify-center rounded-[0.875rem] bg-white/15">
          <UIcon name="i-lucide-wifi-off" class="size-5" aria-hidden="true" />
        </span>
        <p class="text-[13px] leading-snug text-[#d6d4cd]">
          Offline? Scanning still works. You'll see whatever this device has already loaded.
        </p>
      </div>

      <UAlert v-if="photoError" color="warning" data-testid="scan-photo-error" :description="photoError" />

      <div class="flex gap-2.5">
        <UButton
          data-testid="scan-enter-code"
          icon="i-lucide-keyboard"
          size="xl"
          variant="ghost"
          class="flex-1 justify-center rounded-[1.125rem] bg-white/15 font-extrabold text-current hover:bg-white/25"
          @click="codeOpen = true"
        >
          Enter code
        </UButton>

        <!-- The file input is the control; the label is what it looks like. -->
        <label
          class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[1.125rem] bg-[#f4f2ec] px-4 py-3.5 text-sm font-extrabold text-[#17171a]"
        >
          <UIcon name="i-lucide-images" class="size-[17px]" aria-hidden="true" />
          From photo
          <QrcodeCapture class="sr-only" data-testid="scan-from-photo" @detect="onPhotoDetect" />
        </label>
      </div>
    </div>
    </template>

    <UModal v-model:open="codeOpen" title="Enter box code">
      <template #body>
        <UForm
          novalidate
          :state="codeState"
          :validate="validateCode"
          class="flex flex-col gap-4"
          @submit="onCodeSubmit"
        >
          <UFormField label="Box code" name="code" description="The eight characters printed under the QR square.">
            <UInput
              v-model="codeState.code"
              data-testid="scan-code-input"
              autocapitalize="none"
              autocomplete="off"
              spellcheck="false"
              class="w-full font-mono"
            />
          </UFormField>
          <UButton type="submit" data-testid="scan-code-submit" block size="xl">Open box</UButton>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
