<script setup lang="ts">
import type { SearchResult } from '~/queries/search'

const props = defineProps<{ results: SearchResult[], term?: string }>()

// Grouped, as the v2 design draws them: a box you can open and an item you
// can look at are different answers to the same question, and interleaving
// them makes you re-read every row to work out which is which.
type BoxResult = Extract<SearchResult, { kind: 'box' }>
type ItemResult = Extract<SearchResult, { kind: 'item' }>

/**
 * The line under a box's title: where it is, and — when the title is not the
 * answer — what did match.
 *
 * A box can surface for a word in its description or on an item sealed inside
 * it, and a row with no visible reason reads as a bug in the search rather
 * than as a hit. `title` and `unknown` add nothing: one is already highlighted
 * above, and the other is a match we cannot honestly point at.
 */
function subtitle(result: BoxResult): string {
  const { location } = result.box
  const reason = result.reason
  const why
    = reason.kind === 'description'
      ? 'matched description'
      : reason.kind === 'location'
        ? 'matched location'
        : reason.kind === 'items'
          ? `matched ${reason.count} ${reason.count === 1 ? 'item' : 'items'}`
          : ''

  return [location, why].filter(Boolean).join(' · ')
}

const boxes = computed(() => props.results.filter((r): r is BoxResult => r.kind === 'box'))
const items = computed(() => props.results.filter((r): r is ItemResult => r.kind === 'item'))

/**
 * Split a title around the search term so the matched run can be marked.
 * Returns plain text parts — never HTML — so a title containing markup, or a
 * term containing regex metacharacters, cannot become anything but text.
 */
function highlight(text: string): { text: string, match: boolean }[] {
  const term = (props.term ?? '').trim()
  if (!term) return [{ text, match: false }]

  const parts: { text: string, match: boolean }[] = []
  const haystack = text.toLowerCase()
  const needle = term.toLowerCase()
  let cursor = 0

  for (;;) {
    const at = haystack.indexOf(needle, cursor)
    if (at === -1) break
    if (at > cursor) parts.push({ text: text.slice(cursor, at), match: false })
    parts.push({ text: text.slice(at, at + needle.length), match: true })
    cursor = at + needle.length
  }

  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false })
  return parts
}
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <section v-if="boxes.length" class="flex flex-col gap-2.5">
      <h2 class="sb-mono" :style="{ color: 'var(--sb-muted)' }">Boxes · {{ boxes.length }}</h2>
      <NuxtLink
        v-for="result in boxes"
        :key="result.box.id"
        :to="`/box/${result.box.qr_id}`"
        data-testid="search-result-box"
        class="sb-card-tinted flex items-center gap-3 p-[11px]"
        :style="boxColorVars(result.box.qr_id)"
      >
        <span
          class="flex size-[54px] shrink-0 items-center justify-center rounded-[15px]"
          :style="{ background: 'var(--c)', color: 'var(--c-on)' }"
        >
          <UIcon name="i-lucide-package" class="size-6" aria-hidden="true" />
        </span>
        <span class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="text-base font-extrabold">
            <span
              v-for="(part, i) in highlight(result.box.title || result.box.qr_id)"
              :key="i"
              :class="part.match ? 'rounded-[5px] bg-[oklch(0.88_0.14_92)] px-[3px] text-[#2a1f06]' : ''"
            >{{ part.text }}</span>
          </span>
          <span v-if="subtitle(result)" class="sb-on-tint text-xs font-bold" data-testid="box-match-reason">{{ subtitle(result) }}</span>
        </span>
        <UIcon name="i-lucide-chevron-right" class="size-[18px] shrink-0" :style="{ color: 'var(--sb-muted)' }" aria-hidden="true" />
      </NuxtLink>
    </section>

    <section v-if="items.length" class="flex flex-col gap-2.5">
      <h2 class="sb-mono" :style="{ color: 'var(--sb-muted)' }">Items · {{ items.length }}</h2>
      <NuxtLink
        v-for="result in items"
        :key="result.item.id"
        :to="`/item/${result.item.id}`"
        data-testid="search-result-item"
        class="sb-card flex items-center gap-3 p-[11px]"
      >
        <span
          class="flex size-[54px] shrink-0 items-center justify-center rounded-[15px]"
          :style="{ background: 'var(--sb-fill)', color: 'var(--sb-on-fill)' }"
        >
          <UIcon name="i-lucide-package" class="size-6" aria-hidden="true" />
        </span>
        <span class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="text-[15px] font-extrabold">
            <span
              v-for="(part, i) in highlight(result.item.title)"
              :key="i"
              :class="part.match ? 'rounded-[5px] bg-[oklch(0.88_0.14_92)] px-[3px] text-[#2a1f06]' : ''"
            >{{ part.text }}</span>
          </span>
          <span
            v-if="result.item.expand?.box"
            class="text-[11px] font-bold"
            :style="{ color: 'var(--sb-muted)' }"
          >in {{ result.item.expand.box.title || result.item.expand.box.qr_id }}</span>
        </span>
      </NuxtLink>
    </section>
  </div>
</template>
