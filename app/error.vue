<script setup lang="ts">
import type { NuxtError } from '#app'

/**
 * Whatever Nuxt could not render: a route that does not exist, or a client
 * error that took the app down. Rendered outside the layout, so it carries its
 * own chrome — and its own `UApp`, without which the Nuxt UI components on it
 * have no root to portal from.
 *
 * The copy is split on status rather than shown raw. A 404 is a wrong address
 * and the way out is a link; a 500 is something broken and the way out is to
 * try again. `error.message` is only shown for the second, and only under the
 * heading — it is diagnostic, not an explanation.
 */
const props = defineProps<{ error: NuxtError }>()

const isNotFound = computed(() => props.error.statusCode === 404)

const detail = computed(() => {
  // A 404's message is the router's own "Page not found: /nope", which tells
  // the reader nothing the heading has not already said.
  if (isNotFound.value) return ''
  return typeof props.error.message === 'string' ? props.error.message : ''
})

// `clearError` unmounts this page and re-renders the app at the given route.
// Reloading instead would throw away the cached queries that make the app
// usable offline, which is exactly the state a 500 is most likely to be read in.
function goHome() {
  clearError({ redirect: '/' })
}

function retry() {
  clearError({ redirect: useRoute().fullPath })
}
</script>

<template>
  <UApp>
    <div
      class="flex min-h-screen flex-col justify-center gap-8 px-[1.625rem] py-[max(env(safe-area-inset-top),2rem)] text-white"
      :style="{ background: isNotFound ? 'var(--sb-accent)' : 'oklch(0.6 0.2 25)' }"
      data-testid="error-page"
    >
      <div class="flex flex-col gap-3.5">
        <div
          class="flex size-18 items-center justify-center rounded-[1.375rem]"
          :style="{ background: 'var(--sb-amber)', color: 'var(--sb-amber-ink)' }"
        >
          <UIcon
            :name="isNotFound ? 'i-lucide-package-search' : 'i-lucide-unplug'"
            class="size-9"
            aria-hidden="true"
          />
        </div>

        <p class="sb-mono opacity-80" data-testid="error-status">{{ error.statusCode }}</p>

        <h1 class="sb-display text-[38px]">
          <template v-if="isNotFound">Nothing <br>here</template>
          <template v-else>Something <br>broke</template>
        </h1>

        <p class="max-w-[300px] text-[15px] leading-relaxed opacity-85">
          <template v-if="isNotFound">
            That address doesn't match a box, an item or a screen. If you scanned a
            label, the box may have been deleted.
          </template>
          <template v-else>
            The app hit an error it couldn't recover from. Your boxes are fine — this
            went wrong on the way to the screen.
          </template>
        </p>
      </div>

      <div
        v-if="detail"
        class="rounded-2xl border border-white/25 bg-black/15 p-3.5"
        data-testid="error-detail"
      >
        <p class="font-mono text-[12px] leading-snug break-words opacity-90">{{ detail }}</p>
      </div>

      <div class="flex flex-col gap-2.5">
        <UButton
          v-if="!isNotFound"
          size="xl"
          block
          data-testid="error-retry"
          icon="i-lucide-rotate-ccw"
          class="justify-center rounded-[1.25rem] font-extrabold"
          :style="{ background: 'var(--sb-amber)', color: 'var(--sb-amber-ink)' }"
          @click="retry"
        >
          Try again
        </UButton>

        <UButton
          size="xl"
          block
          data-testid="error-home"
          icon="i-lucide-house"
          :variant="isNotFound ? 'solid' : 'outline'"
          class="justify-center rounded-[1.25rem] font-extrabold"
          :style="isNotFound
            ? { background: 'var(--sb-amber)', color: 'var(--sb-amber-ink)' }
            : { borderColor: 'rgba(255,255,255,.4)', color: '#fff' }"
          @click="goHome"
        >
          Back to the dashboard
        </UButton>

        <UButton
          size="xl"
          block
          to="/scan"
          data-testid="error-scan"
          icon="i-lucide-scan-line"
          variant="ghost"
          class="justify-center rounded-[1.25rem] font-extrabold text-white hover:bg-white/15"
        >
          Scan a label instead
        </UButton>
      </div>
    </div>
  </UApp>
</template>
