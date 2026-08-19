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

const links = [
  { label: 'Boxes', to: '/' },
  { label: 'Search', to: '/search' },
  { label: 'Tags', to: '/tags' },
  { label: 'Reports', to: '/reports' }
]

async function onSignOut() {
  logout()
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="flex items-center gap-4 border-b p-4">
      <NuxtLink to="/" class="font-medium">Storage Boxes</NuxtLink>
      <nav class="flex flex-1 gap-3">
        <NuxtLink v-for="link in links" :key="link.to" :to="link.to">{{ link.label }}</NuxtLink>
      </nav>
      <UButton variant="ghost" data-testid="sign-out" @click="onSignOut">Sign out</UButton>
    </header>

    <main class="flex-1 p-4">
      <div v-if="isMembershipPending" data-testid="membership-pending">
        <USkeleton class="h-8 w-48" />
      </div>

      <div
        v-else-if="isMembershipError"
        data-testid="membership-error"
        class="flex flex-col items-start gap-3"
      >
        <UAlert
          title="Could not check your access"
          :description="membershipErrorMessage"
        />
        <UButton data-testid="membership-retry" @click="refetchMembership()">Try again</UButton>
      </div>

      <UAlert
        v-else-if="!isMember"
        data-testid="access-denied"
        title="No access to this app"
        description="Your account is not an enabled member of Storage Boxes. Ask an admin to grant you access."
      />

      <slot v-else />
    </main>
  </div>
</template>
