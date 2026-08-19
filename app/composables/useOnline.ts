import { useOnline as useVueUseOnline } from '@vueuse/core'

/**
 * `navigator.onLine` (what `@vueuse/core`'s `useOnline` wraps) is famously
 * optimistic: a device connected to a router with no upstream internet still
 * reports `true`. This wrapper exists as the single import site for that
 * signal so a real reachability probe can be added here later without
 * touching every call site. Deliberately no polling probe yet — nothing in
 * v1 needs that precision, and a probe that runs on a metered phone
 * connection is a real cost. Do not "simplify" this back to a raw
 * `navigator.onLine` listener.
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
 */
export function assertOnline(): void {
  if (!useVueUseOnline().value) {
    throw new Error('This action needs an internet connection. Reconnect and try again.')
  }
}
