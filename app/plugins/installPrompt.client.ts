export default defineNuxtPlugin(() => {
  const deferred = useInstallPrompt()

  // No `onUnmounted` pair: the listener lives as long as the document does,
  // which is the point — the event can fire before the first route renders.
  window.addEventListener('beforeinstallprompt', (e) => {
    // Suppresses Chrome's own mini-infobar in favour of <InstallPrompt>.
    e.preventDefault()
    if (isBeforeInstallPromptEvent(e)) deferred.value = e
  })

  // Chrome fires this once the app is installed, from the prompt or from the
  // browser's own menu. Without it the nudge sits there offering to do
  // something that has already happened.
  window.addEventListener('appinstalled', () => {
    deferred.value = null
  })
})
