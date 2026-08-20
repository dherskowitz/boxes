<script setup lang="ts">
const STORAGE_KEY = 'storage-app-install-dismissed'

// The Chromium install-prompt event is not part of TS's DOM lib, so it needs
// its own shape rather than an `as` cast onto `Event`.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isBeforeInstallPromptEvent(e: Event): e is BeforeInstallPromptEvent {
  return 'prompt' in e
}

// iOS Safari exposes `navigator.standalone`, also missing from TS's DOM lib.
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

const dismissed = ref(localStorage.getItem(STORAGE_KEY) === 'true')
const standalone = ref(isStandaloneDisplay())
const ios = ref(isIos())
const deferredPrompt = shallowRef<BeforeInstallPromptEvent | null>(null)

const showInstallButton = computed(
  () => !standalone.value && !dismissed.value && deferredPrompt.value !== null
)
const showIosHint = computed(
  () => !standalone.value && !dismissed.value && ios.value && deferredPrompt.value === null
)

function onBeforeInstallPrompt(e: Event) {
  e.preventDefault()
  if (isBeforeInstallPromptEvent(e)) {
    deferredPrompt.value = e
  }
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
})

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
  <div v-if="showInstallButton" data-testid="install-prompt" class="flex items-center gap-3">
    <span class="flex-1">Install Storage Boxes for quicker access.</span>
    <UButton data-testid="install-button" @click="install">Install</UButton>
    <UButton data-testid="install-dismiss" variant="ghost" @click="dismiss">Dismiss</UButton>
  </div>

  <div v-else-if="showIosHint" data-testid="ios-install-hint" class="flex items-center gap-3">
    <span class="flex-1">Tap Share, then "Add to Home Screen" to install this app.</span>
    <UButton data-testid="install-dismiss" variant="ghost" @click="dismiss">Dismiss</UButton>
  </div>
</template>
