<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'

/**
 * The floating nav pill (v2 design): one dark control in the thumb zone
 * instead of a wrapping row of links across the top. Four destinations plus a
 * raised scan button, which is the app's headline action and the only one
 * that needs to be hittable without looking.
 *
 * Five slots for more than five screens: "More" is a real page, not a sheet,
 * holding the rest of the app — search, tags, reports, the print sheet — plus
 * who you are signed in as, the theme, and the way out.
 *
 * Search is not a slot of its own: both the dashboard and the box index open
 * with a search field, so the screen is one tap from where you already are.
 */
const links = [
  { to: '/', label: 'Home', icon: 'i-lucide-house' },
  { to: '/boxes', label: 'Boxes', icon: 'i-lucide-boxes' }
] as const

const rightLinks = [
  { to: '/items', label: 'Items', icon: 'i-lucide-list' },
  { to: '/more', label: 'More', icon: 'i-lucide-ellipsis' }
] as const

// One ordered list for the rail. The pill splits its four destinations around
// the raised scan button; a vertical rail has no thumb zone to raise anything
// into, so scan sits in sequence and keeps its amber only as a badge.
const railLinks = [...links, { to: '/scan', label: 'Scan', icon: 'i-lucide-scan-line' }, ...rightLinks] as const

// `v-if`, not `hidden lg:flex`. Both navs in the DOM makes every existing
// `getByTestId('nav-*')` in the e2e suite match two elements. `ssr: false`
// means this renders client-only, so there is no server pass to mismatch.
const isDesktop = useMediaQuery(DESKTOP)

const route = useRoute()
function isActive(to: string): boolean {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}
</script>

<template>
  <nav
    v-if="isDesktop"
    data-testid="nav-rail"
    class="sb-nav fixed inset-y-0 left-0 z-40 flex w-60 flex-col gap-1 px-4 py-6"
    :style="{ background: 'var(--sb-ink)' }"
    aria-label="Main"
  >
    <p class="sb-mono mb-4 px-3 text-white/55">Storage Boxes</p>

    <NuxtLink
      v-for="link in railLinks"
      :key="link.to"
      :to="link.to"
      :data-testid="`nav-${link.label.toLowerCase()}`"
      class="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-extrabold"
      :class="isActive(link.to) ? 'bg-white/10 text-white' : 'text-[#7d786e] hover:text-white'"
      :aria-current="isActive(link.to) ? 'page' : undefined"
    >
      <span
        v-if="link.to === '/scan'"
        class="flex size-8 shrink-0 items-center justify-center rounded-xl"
        :style="{ background: 'var(--sb-amber)', color: 'var(--sb-amber-ink)' }"
      >
        <UIcon :name="link.icon" class="size-[18px]" aria-hidden="true" />
      </span>
      <UIcon v-else :name="link.icon" class="size-[22px] shrink-0" aria-hidden="true" />
      {{ link.label }}
    </NuxtLink>
  </nav>

  <nav
    v-else
    data-testid="nav-pill"
    class="sb-nav fixed inset-x-[max(1.375rem,env(safe-area-inset-left))] z-40 flex items-center justify-between rounded-[1.625rem] px-4 py-3"
    :style="{
      bottom: 'calc(1.375rem + env(safe-area-inset-bottom))',
      background: 'var(--sb-ink)',
      boxShadow: '0 16px 34px rgba(0,0,0,.32)'
    }"
    aria-label="Main"
  >
    <NuxtLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      :data-testid="`nav-${link.label.toLowerCase()}`"
      class="flex min-w-11 flex-col items-center gap-[3px] text-[10px] font-extrabold"
      :class="isActive(link.to) ? 'text-white' : 'text-[#7d786e]'"
      :aria-current="isActive(link.to) ? 'page' : undefined"
    >
      <UIcon :name="link.icon" class="size-[22px]" aria-hidden="true" />
      {{ link.label }}
    </NuxtLink>

    <!-- Raised, amber, and the only coloured thing on the pill: scanning a
         label is the action the whole product is built around. -->
    <NuxtLink
      to="/scan"
      data-testid="nav-scan"
      aria-label="Scan a box label"
      class="-mt-[26px] -mb-[6px] flex size-[58px] items-center justify-center rounded-[1.25rem]"
      :style="{
        background: 'var(--sb-amber)',
        color: 'var(--sb-amber-ink)',
        boxShadow: '0 12px 24px oklch(0.78 0.16 75 / .5)'
      }"
    >
      <UIcon name="i-lucide-scan-line" class="size-7" aria-hidden="true" />
    </NuxtLink>

    <NuxtLink
      v-for="link in rightLinks"
      :key="link.to"
      :to="link.to"
      :data-testid="`nav-${link.label.toLowerCase()}`"
      class="flex min-w-11 flex-col items-center gap-[3px] text-[10px] font-extrabold"
      :class="isActive(link.to) ? 'text-white' : 'text-[#7d786e]'"
      :aria-current="isActive(link.to) ? 'page' : undefined"
    >
      <UIcon :name="link.icon" class="size-[22px]" aria-hidden="true" />
      {{ link.label }}
    </NuxtLink>
  </nav>
</template>
