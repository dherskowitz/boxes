<script setup lang="ts">
/**
 * The beat between scanning a label and landing on the box.
 *
 * Scanning used to navigate the instant a code resolved, which is fine when it
 * is the right box and disorienting when it is not — a shelf of near-identical
 * boxes gives you no way to tell you grabbed the wrong one until the page has
 * already changed under you. This names the box first, and gets out of the way
 * on its own.
 *
 * Green rather than the box's own colour: it is a transient success state and
 * reads with the tick. Every other surface in the app is where the box colour
 * does its work.
 */
const props = defineProps<{ qrId: string }>()
const emit = defineEmits<{ again: [] }>()

/** Long enough to read the title, short enough not to feel like a wait. */
const HOLD_MS = 1200

const qrId = computed(() => props.qrId)
const { data: box, isPending, isError } = useBoxByQrId(qrId)

const boxId = computed(() => box.value?.id ?? '')
const { data: comments } = useBoxCommentCount(boxId)
const commentCount = computed(() => comments.value?.totalItems ?? 0)

const itemCounts = useBoxItemCounts()
const itemCount = computed(() => (box.value ? itemCounts.value.get(box.value.id) : undefined))

/**
 * "Garage shelf B2 · 9 items". Either half can be missing — a box need not
 * have a location, and the counts come from a view that may not be cached on
 * a phone that has just come back online in a garage.
 */
const chip = computed(() => {
  const parts: string[] = []
  if (box.value?.location) parts.push(box.value.location)
  const count = itemCount.value
  if (count !== undefined) parts.push(`${count} ${count === 1 ? 'item' : 'items'}`)
  return parts.join(' · ')
})

const activity = computed(() => {
  if (!box.value) return ''
  const when = relativeTime(box.value.updated)
  const parts = [when ? `Updated ${when}` : '']
  if (commentCount.value > 0) {
    parts.push(`${commentCount.value} ${commentCount.value === 1 ? 'comment' : 'comments'}`)
  }
  return parts.filter(Boolean).join(' · ')
})

/**
 * The hold starts when the box resolves, not when the code is read, so the
 * wait is the fetch rather than a timer stacked on top of it.
 *
 * An unresolvable code goes straight through: box detail owns the 404 screen,
 * and holding someone on a confirmation of a box that does not exist would be
 * a second place to explain the same thing.
 */
const timer = ref<ReturnType<typeof setTimeout> | null>(null)

function cancel() {
  if (timer.value !== null) clearTimeout(timer.value)
  timer.value = null
}

watch([box, isError], ([resolved, failed]) => {
  if (timer.value !== null) return
  if (failed) {
    void navigateTo(`/box/${props.qrId}`)
    return
  }
  if (!resolved) return
  timer.value = setTimeout(() => navigateTo(`/box/${props.qrId}`), HOLD_MS)
}, { immediate: true })

onBeforeUnmount(cancel)

function onAgain() {
  cancel()
  emit('again')
}
</script>

<template>
  <div
    class="flex flex-1 flex-col items-center justify-center gap-5 px-[1.375rem] text-center text-white"
    :style="{ background: 'oklch(0.55 0.15 152)' }"
    data-testid="scan-hit"
  >
    <span class="flex size-33 items-center justify-center rounded-full bg-white">
      <UIcon
        name="i-lucide-check"
        class="size-16"
        :style="{ color: 'oklch(0.55 0.15 152)' }"
        aria-hidden="true"
      />
    </span>

    <div class="flex flex-col items-center gap-2.5">
      <p class="sb-mono opacity-85" data-testid="scan-hit-code">BOX-{{ qrId.toUpperCase() }}</p>

      <template v-if="isPending">
        <USkeleton class="h-9 w-56 bg-white/25" />
      </template>
      <template v-else>
        <h2 class="sb-display text-[30px] break-words" data-testid="scan-hit-title">
          {{ box?.title || qrId }}
        </h2>
        <span v-if="chip" class="sb-chip bg-black/20 px-3.5 py-2 text-xs" data-testid="scan-hit-chip">
          {{ chip }}
        </span>
      </template>
    </div>

    <p class="flex items-center gap-2 text-sm font-extrabold">
      <span
        class="size-2 rounded-full bg-white/80"
        style="animation: sb-pulse 1.4s ease-in-out infinite"
        aria-hidden="true"
      />
      Opening box…
    </p>

    <p
      v-if="activity"
      class="flex items-center gap-2.5 rounded-[1.125rem] bg-black/20 px-3.5 py-2.5 text-left text-[13px] leading-snug"
      data-testid="scan-hit-activity"
    >
      <UIcon name="i-lucide-message-circle" class="size-4 shrink-0 opacity-80" aria-hidden="true" />
      {{ activity }}
    </p>

    <UButton
      variant="ghost"
      class="font-extrabold text-white/90 hover:text-white"
      data-testid="scan-again"
      @click="onAgain"
    >
      Wrong box? Scan again
    </UButton>
  </div>
</template>
