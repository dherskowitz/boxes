<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'

const {
  isMember,
  isMembershipPending,
  isMembershipError,
  membershipError,
  refetchMembership
} = useAuth()

const membershipErrorMessage = computed(() => pbError(membershipError.value))

// The nav pill belongs to the top-level screens. A detail screen — a box, an
// item, a form, the scanner — gets there from one of them and leaves by its
// own back control, and the design gives that space to the screen's own
// actions instead. Pages opt out with `definePageMeta({ nav: false })`.
const route = useRoute()
const isDesktop = useMediaQuery(DESKTOP)
// `nav: false` exists because the floating pill covers the thumb zone a detail
// screen needs for its own actions — box detail's Add item sits exactly there.
// A side rail takes no thumb zone, so at desktop width those screens keep their
// navigation. `rail: false` is the opt-out for a screen that must stay
// chromeless at every width: the scanner.
const showNav = computed(() =>
  isDesktop.value ? route.meta.rail !== false : route.meta.nav !== false
)
const showOffline = computed(() => route.meta.offlineBanner !== false)
</script>

<template>
  <div class="flex min-h-dvh flex-col" :class="{ 'sb-page sb-shell-offset': showNav }">
    <!-- No top bar: v2 moves navigation into the floating pill at the bottom
         and gives each page its own saturated header block, so the shell owns
         only the states that gate every page. -->
    <main class="flex-1">
      <!-- Above the membership branches on purpose: it stays visible even when
           the directory gate is showing an error, which offline is exactly
           when it does. In flow, so it never covers the page's own header —
           see the component. -->
      <OfflineBanner v-if="showOffline" />

      <!-- The nudge stays fixed: it is a one-off prompt rather than a state,
           and reflowing the page under the reader's thumb to announce it is
           worse than floating it. `pointer-events-none` on the strip so the
           empty space beside it never eats a tap meant for the page; the
           prompt turns pointer events back on for itself. -->
      <div
        class="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col gap-2 px-[1.375rem] pt-[max(env(safe-area-inset-top),0.75rem)] [&>*]:pointer-events-auto"
      >
        <InstallPrompt />
      </div>

      <div v-if="isMembershipPending" data-testid="membership-pending" class="p-[1.375rem]">
        <USkeleton class="h-8 w-48" />
      </div>

      <div
        v-else-if="isMembershipError"
        data-testid="membership-error"
        class="flex flex-col items-start gap-3 p-[1.375rem]"
      >
        <UAlert
          color="error"
          title="Could not check your access"
          :description="membershipErrorMessage"
        />
        <UButton data-testid="membership-retry" @click="refetchMembership()">Try again</UButton>
      </div>

      <div v-else-if="!isMember" class="p-[1.375rem]">
        <UAlert
          color="error"
          data-testid="access-denied"
          title="No access to this app"
          description="Your account is not an enabled member of Storage Boxes. Ask an admin to grant you access."
        />
      </div>

      <slot v-else />
    </main>

    <!-- Outside the membership gate: someone locked out still needs a way to
         sign out of the account that is locked out. -->
    <AppNav v-if="showNav" />
  </div>
</template>
