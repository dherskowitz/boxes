<script setup lang="ts">
// A top-level destination, so it keeps the nav pill: this is where the fifth
// slot goes, not somewhere you have to back out of.
const { user, member, role, logout } = useAuth()

// `member` is the app_memberships row (name, role); the email lives on the
// auth record, which is the only place it exists.
const email = computed(() => {
  const value = user.value?.email
  return typeof value === 'string' ? value : ''
})

const roleLabel = computed(() => {
  switch (role.value) {
    case 'owner': return 'Owner — full access, including deleting tags'
    case 'admin': return 'Admin — full access, including deleting tags'
    case 'member': return 'Member — can read everything, and edit what is shared with you'
    default: return 'No membership'
  }
})

// No Search row. /search is still a route — it is where both search fields
// land, and a search with its term and tags in the URL is linkable — but it
// is not a destination you set out for: the dashboard, the box index and the
// item list all open with a field that goes there. A menu entry for it was a
// slower way to reach a screen you are already one tap from.
const sections = [
  {
    heading: 'Your storage',
    links: [
      { to: '/tags', label: 'Tags', icon: 'i-lucide-tag', hint: 'Rename or remove the shared vocabulary' },
      { to: '/archived', label: 'Archived boxes', icon: 'i-lucide-archive', hint: 'Put several back at once' },
      { to: '/reports', label: 'Reports', icon: 'i-lucide-chart-column', hint: 'Fill, locations, tag usage, growth' }
    ]
  },
  {
    heading: 'Labels',
    links: [
      { to: '/scan', label: 'Scan a label', icon: 'i-lucide-scan-line', hint: 'Or type a code by hand' },
      { to: '/print-sheet', label: 'Print sheet', icon: 'i-lucide-printer', hint: 'Several labels on one page' }
    ]
  }
] as const

const signingOut = ref(false)
async function onSignOut() {
  signingOut.value = true
  await logout()
  await navigateTo('/login')
}
</script>

<template>
  <div>
    <AppHeader eyebrow="Signed in as">
      <template #title>
        <h1 class="sb-display text-[30px] break-words">{{ member?.name || 'Your account' }}</h1>
        <p v-if="email" class="text-sm opacity-85">{{ email }}</p>
      </template>
    </AppHeader>

    <div class="sb-body flex flex-col gap-5">
      <div class="sb-card flex items-start gap-3 p-4" data-testid="more-role">
        <UIcon name="i-lucide-shield-check" class="mt-0.5 size-5 shrink-0 text-(--sb-accent)" aria-hidden="true" />
        <p class="text-[13px] leading-snug" :style="{ color: 'var(--sb-muted)' }">{{ roleLabel }}</p>
      </div>

      <!-- The theme lives here rather than in every page header: it is set
           once and then left alone, which is what this screen is for. -->
      <section class="flex flex-col gap-2.5">
        <h2 class="sb-mono" :style="{ color: 'var(--sb-muted)' }">Appearance</h2>
        <!-- The control gets its own row. Beside the label it had to share a
             390px line with a two-line hint, which squeezed the hint into four
             lines and the three segments into the gap that was left. -->
        <div class="sb-card flex flex-col gap-3 p-3.5">
          <div class="flex items-center gap-3">
            <span
              class="flex size-11 shrink-0 items-center justify-center rounded-[0.875rem]"
              :style="{ background: 'color-mix(in oklch, var(--sb-accent) 12%, var(--sb-surface))', color: 'var(--sb-accent)' }"
            >
              <UIcon name="i-lucide-sun-moon" class="size-5" aria-hidden="true" />
            </span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="text-[15px] font-extrabold">Theme</span>
              <span class="text-[11px] font-bold" :style="{ color: 'var(--sb-muted)' }">Light, dark, or follow the phone</span>
            </span>
          </div>
          <ThemeToggle class="w-full" />
        </div>
      </section>

      <section v-for="section in sections" :key="section.heading" class="flex flex-col gap-2.5">
        <h2 class="sb-mono" :style="{ color: 'var(--sb-muted)' }">{{ section.heading }}</h2>
        <div class="grid gap-2.5 md:grid-cols-2">
          <NuxtLink
            v-for="link in section.links"
            :key="link.to"
            :to="link.to"
            class="sb-card flex items-center gap-3 p-3.5"
          >
            <span
              class="flex size-11 shrink-0 items-center justify-center rounded-[0.875rem]"
              :style="{ background: 'color-mix(in oklch, var(--sb-accent) 12%, var(--sb-surface))', color: 'var(--sb-accent)' }"
            >
              <UIcon :name="link.icon" class="size-5" aria-hidden="true" />
            </span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="text-[15px] font-extrabold">{{ link.label }}</span>
              <span class="text-[11px] font-bold" :style="{ color: 'var(--sb-muted)' }">{{ link.hint }}</span>
            </span>
            <UIcon name="i-lucide-chevron-right" class="size-[18px] shrink-0" :style="{ color: 'var(--sb-muted)' }" aria-hidden="true" />
          </NuxtLink>
        </div>
      </section>

      <UButton
        block
        size="xl"
        color="neutral"
        data-testid="sign-out"
        icon="i-lucide-log-out"
        class="justify-center rounded-[1.25rem] font-extrabold"
        :loading="signingOut"
        @click="onSignOut"
      >
        Sign out
      </UButton>
    </div>
  </div>
</template>
