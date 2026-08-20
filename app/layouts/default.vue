<script setup lang="ts">
const {
  isMember,
  isMembershipPending,
  isMembershipError,
  membershipError,
  refetchMembership,
  logout
} = useAuth()

const membershipErrorMessage = computed(() => pbError(membershipError.value))

// `/items` is built by a concurrent slice; the link resolves to nothing until
// that lands. Adding it here rather than there keeps this file single-owner.
const links = [
  { label: 'Dashboard', to: '/' },
  { label: 'Boxes', to: '/boxes' },
  { label: 'Items', to: '/items' },
  { label: 'Search', to: '/search' },
  { label: 'Tags', to: '/tags' },
  { label: 'Reports', to: '/reports' }
]

async function onSignOut() {
  await logout()
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <!-- flex-wrap on both: six links plus the logo and sign-out do not fit on
         one 412px row, and the primary target is a phone. -->
    <header class="flex flex-wrap items-center gap-4 border-b p-4">
      <NuxtLink to="/" class="font-medium">Storage Boxes</NuxtLink>
      <nav class="flex flex-1 flex-wrap gap-3">
        <NuxtLink v-for="link in links" :key="link.to" :to="link.to">{{ link.label }}</NuxtLink>
      </nav>
      <UButton variant="ghost" data-testid="sign-out" @click="onSignOut">Sign out</UButton>
    </header>

    <main class="flex-1 space-y-4 p-4">
      <!-- Both sit above the membership branches on purpose: they stay visible
           even when the directory gate is showing an error, which offline is
           exactly when it does. Plain block elements — never an overlay, so
           the user can still read the cached content underneath. -->
      <OfflineBanner />
      <InstallPrompt />

      <div v-if="isMembershipPending" data-testid="membership-pending">
        <USkeleton class="h-8 w-48" />
      </div>

      <div
        v-else-if="isMembershipError"
        data-testid="membership-error"
        class="flex flex-col items-start gap-3"
      >
        <UAlert
          color="error"
          title="Could not check your access"
          :description="membershipErrorMessage"
        />
        <UButton data-testid="membership-retry" @click="refetchMembership()">Try again</UButton>
      </div>

      <UAlert
        v-else-if="!isMember"
        color="error"
        data-testid="access-denied"
        title="No access to this app"
        description="Your account is not an enabled member of Storage Boxes. Ask an admin to grant you access."
      />

      <slot v-else />
    </main>
  </div>
</template>
