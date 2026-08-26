<script setup lang="ts">
const STORAGE_KEY = 'storage-app-install-dismissed'

// iOS Safari exposes `navigator.standalone`, missing from TS's DOM lib.
interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean
}

function hasStandaloneFlag(n: Navigator): n is NavigatorWithStandalone {
  return 'standalone' in n
}

function isStandaloneDisplay() {
  const iosStandalone = hasStandaloneFlag(navigator) && navigator.standalone === true
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

// Captured by plugins/installPrompt.client.ts, which is listening from the
// first load — this component mounts far too late to catch the event itself.
const deferredPrompt = useInstallPrompt()

const dismissed = ref(localStorage.getItem(STORAGE_KEY) === 'true')
const standalone = ref(isStandaloneDisplay())
const ios = ref(isIos())

const showInstallButton = computed(
  () => !standalone.value && !dismissed.value && deferredPrompt.value !== null
)
const showIosHint = computed(
  () => !standalone.value && !dismissed.value && ios.value && deferredPrompt.value === null
)

async function install() {
  if (!deferredPrompt.value) return
  await deferredPrompt.value.prompt()
  deferredPrompt.value = null
}

function dismiss() {
  dismissed.value = true
  localStorage.setItem(STORAGE_KEY, 'true')
}
</script>

<template>
  <!-- The nudge stays fixed: it is a one-off prompt rather than a state, and
       reflowing the page under the reader's thumb to announce it is worse than
       floating it. `pointer-events-none` on the strip so the empty space beside
       it never eats a tap meant for the page; the prompt turns pointer events
       back on for itself. The placement is owned here rather than by each
       caller — the login screen carries no layout to put it in. -->
  <div
    v-if="showInstallButton || showIosHint"
    class="pointer-events-none fixed inset-x-0 top-0 z-50 px-[1.375rem] pt-[max(env(safe-area-inset-top),0.75rem)] [&>*]:pointer-events-auto"
  >
    <div
      v-if="showInstallButton"
      data-testid="install-prompt"
      class="flex items-center gap-3 rounded-[1.375rem] p-3.5"
      :style="{ background: 'var(--sb-ink)', color: 'var(--sb-on-ink)' }"
    >
      <span
        class="flex size-11 shrink-0 items-center justify-center rounded-[0.875rem]"
        :style="{ background: 'var(--sb-amber)', color: 'var(--sb-amber-ink)' }"
      >
        <UIcon name="i-lucide-smartphone" class="size-5" aria-hidden="true" />
      </span>
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="text-sm font-extrabold">Keep it on your home screen</span>
        <span class="text-xs text-[#a9a49b]">Scanning works offline once installed.</span>
      </div>
      <div class="flex shrink-0 flex-col items-center gap-1">
        <UButton
          color="neutral"
          data-testid="install-button"
          class="bg-white text-[#1c1a17] hover:bg-white/90"
          @click="install"
        >
          Add
        </UButton>
        <UButton
          size="xs"
          variant="ghost"
          data-testid="install-dismiss"
          class="text-[#a9a49b] hover:text-white"
          @click="dismiss"
        >
          Later
        </UButton>
      </div>
    </div>

    <div
      v-else
      data-testid="ios-install-hint"
      class="flex items-center gap-3 rounded-[1.375rem] p-3.5"
      :style="{ background: 'var(--sb-ink)', color: 'var(--sb-on-ink)' }"
    >
      <span
        class="flex size-11 shrink-0 items-center justify-center rounded-[0.875rem]"
        :style="{ background: 'var(--sb-amber)', color: 'var(--sb-amber-ink)' }"
      >
        <UIcon name="i-lucide-share" class="size-5" aria-hidden="true" />
      </span>
      <span class="flex-1 text-[13px] leading-snug">
        Tap Share, then "Add to Home Screen" to install this app.
      </span>
      <UButton
        size="xs"
        variant="ghost"
        data-testid="install-dismiss"
        class="shrink-0 text-[#a9a49b] hover:text-white"
        @click="dismiss"
      >
        Later
      </UButton>
    </div>
  </div>
</template>
