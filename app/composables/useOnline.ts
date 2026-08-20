import { useOnline as useVueUseOnline } from '@vueuse/core'

/**
 * `navigator.onLine` (what `@vueuse/core`'s `useOnline` wraps) is famously
 * optimistic: a device connected to a router with no upstream internet still
 * reports `true`. This wrapper exists as the single import site for that
 * signal so a real reachability probe can be added here later without
 * touching every call site. Deliberately no polling probe yet — nothing in
 * v1 needs that precision, and a probe that runs on a metered phone
 * connection is a real cost. Do not "simplify" this reactive signal back to
 * a raw `navigator.onLine` listener — it's only safe here because it's
 * created once inside a long-lived component's `setup()`, where Vue disposes
 * the underlying window listeners for you.
 */
export function useOnline() {
  return { isOnline: useVueUseOnline() }
}

/**
 * Write guard for mutation paths. v1 is offline-reads-only (PRD §3): a
 * write attempted offline must refuse with a clear message rather than
 * failing silently or losing the user's input. Call this at the top of a
 * mutation handler; the thrown message flows through `pbError()` with no
 * extra handling required.
 *
 * Reads `navigator.onLine` directly rather than going through `useOnline()`
 * above: this runs outside a component's `setup()`, so the window listeners
 * `useOnline()` registers would never be disposed — every mutation call
 * would leak two more `window` listeners for the life of the tab. A one-shot
 * read needs no subscription.
 */
export function assertOnline(): void {
  if (!navigator.onLine) {
    throw new Error('This action needs an internet connection. Reconnect and try again.')
  }
}
