<script setup lang="ts">
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
const showNav = computed(() => route.meta.nav !== false)
</script>

<template>
  <div class="flex min-h-screen flex-col" :class="{ 'sb-page': showNav }">
    <!-- No top bar: v2 moves navigation into the floating pill at the bottom
         and gives each page its own saturated header block, so the shell owns
         only the states that gate every page. -->
    <main class="flex-1">
      <!-- Fixed, over the page rather than above it: both are transient, and
           pushing the header down every time one appears reflows the whole
           screen under the reader's thumb. Above the membership branches on
           purpose — they stay visible even when the directory gate is showing
           an error, which offline is exactly when it does.

           `pointer-events-none` on the strip so the empty space beside a
           banner never eats a tap meant for the page; each banner turns
           pointer events back on for itself. -->
      <div
        class="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col gap-2 px-[1.375rem] pt-[max(env(safe-area-inset-top),0.75rem)] [&>*]:pointer-events-auto"
      >
        <OfflineBanner />
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
