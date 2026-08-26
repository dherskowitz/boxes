/**
 * The Chromium install-prompt event, held from wherever it fires to whenever
 * something is on screen to offer it.
 *
 * Chrome fires `beforeinstallprompt` once, right after it has parsed the
 * manifest and found a service worker — which is during the first load, long
 * before `<InstallPrompt>` mounts, and on a cold visit to /login that
 * component never mounts at all (the page is `layout: false`). A listener
 * registered in the component's `onMounted` is always too late; the event is
 * gone and nothing offers to install the app. `plugins/installPrompt.client.ts`
 * catches it at plugin time and parks it here.
 */

// Not part of TS's DOM lib, so it needs its own shape rather than an `as` cast.
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function isBeforeInstallPromptEvent(e: Event): e is BeforeInstallPromptEvent {
  return 'prompt' in e
}

const deferred = shallowRef<BeforeInstallPromptEvent | null>(null)

export function useInstallPrompt() {
  return deferred
}
