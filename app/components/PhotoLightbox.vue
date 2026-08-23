<script setup lang="ts">
/**
 * Fullscreen photo viewer: swipe sideways through the set, swipe down to
 * dismiss, tap or Escape to close.
 *
 * Hand-rolled on pointer events rather than a carousel library. The behaviour
 * is one transform and a threshold, and a dependency here would ship a
 * gesture engine, a virtualiser and a stylesheet to get it — see CLAUDE.md on
 * reaching for what is already there.
 *
 * The drag is *tracked*, not just triggered: the image follows the finger and
 * the backdrop fades with it, so a half-swipe shows you what it is about to do
 * and springs back when you let go without committing. That feedback is the
 * whole difference between this and a tap-to-close overlay.
 */
const props = defineProps<{
  urls: string[]
  /** Prefix for each photo's alt text; the position is appended. */
  label: string
}>()

const open = defineModel<boolean>('open', { required: true })
const index = defineModel<number>('index', { default: 0 })

// How far a drag must go to commit, as a fraction of the viewport and in px.
const SWIPE_FRACTION = 0.22
const DISMISS_PX = 110
// Below this, a drag has not declared a direction yet — locking the axis too
// early makes a mostly-horizontal swipe feel like it fights back.
const AXIS_PX = 8

const dragging = ref(false)
const axis = ref<'x' | 'y' | null>(null)
const dx = ref(0)
const dy = ref(0)
let startX = 0
let startY = 0

const stage = useTemplateRef<HTMLElement>('stage')

const count = computed(() => props.urls.length)
const atStart = computed(() => index.value <= 0)
const atEnd = computed(() => index.value >= count.value - 1)

// Fades as the photo is pulled away, so the page underneath comes back into
// view while the gesture is still reversible.
const backdropOpacity = computed(() => Math.max(0.35, 1 - dy.value / 420))
const stageStyle = computed(() => ({
  transform: `translate3d(0, ${dy.value}px, 0) scale(${Math.max(0.82, 1 - dy.value / 1400)})`,
  transition: dragging.value ? 'none' : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)'
}))
const trackStyle = computed(() => ({
  transform: `translate3d(calc(${-index.value * 100}% + ${dx.value}px), 0, 0)`,
  transition: dragging.value ? 'none' : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)'
}))

function reset() {
  dragging.value = false
  axis.value = null
  dx.value = 0
  dy.value = 0
}

function go(to: number) {
  index.value = Math.min(Math.max(to, 0), count.value - 1)
}

function close() {
  open.value = false
}

function onPointerDown(event: PointerEvent) {
  // Mouse right/middle buttons are not a drag.
  if (event.button !== 0) return
  startX = event.clientX
  startY = event.clientY
  dragging.value = true
  axis.value = null
  // Pointer capture keeps the move/up events coming even when the finger
  // leaves the element mid-drag, which is exactly what a fast swipe does.
  const target = event.currentTarget
  if (target instanceof HTMLElement) target.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value) return
  const moveX = event.clientX - startX
  const moveY = event.clientY - startY

  if (axis.value === null) {
    if (Math.abs(moveX) < AXIS_PX && Math.abs(moveY) < AXIS_PX) return
    axis.value = Math.abs(moveX) > Math.abs(moveY) ? 'x' : 'y'
  }

  if (axis.value === 'x') {
    // Resist at the ends rather than refusing: the rubber band is what tells
    // you there is nothing further that way.
    const overscrolling = (moveX > 0 && atStart.value) || (moveX < 0 && atEnd.value)
    dx.value = overscrolling ? moveX * 0.28 : moveX
  } else {
    // Downward only. Dragging a photo up towards nothing is not a gesture.
    dy.value = Math.max(0, moveY)
  }
}

function onPointerUp() {
  if (!dragging.value) return
  const width = stage.value?.clientWidth ?? window.innerWidth

  if (axis.value === 'x' && Math.abs(dx.value) > width * SWIPE_FRACTION) {
    go(index.value + (dx.value < 0 ? 1 : -1))
  } else if (axis.value === 'y' && dy.value > DISMISS_PX) {
    close()
  }
  reset()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
  else if (event.key === 'ArrowRight') go(index.value + 1)
  else if (event.key === 'ArrowLeft') go(index.value - 1)
}

const closeButton = useTemplateRef<HTMLElement>('closeButton')

watch(open, async (isOpen) => {
  reset()
  // The page behind must not scroll under the overlay — on iOS that is what
  // makes a fullscreen viewer feel like a div instead of a viewer.
  document.body.style.overflow = isOpen ? 'hidden' : ''
  if (!isOpen) return
  await nextTick()
  // Focus goes into the overlay so Escape and the arrow keys reach it without
  // the reader first having to tab into a dialog it was just dropped in.
  closeButton.value?.focus()
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="lb">
      <div
        v-if="open && urls.length"
        class="fixed inset-0 z-50 flex flex-col"
        :style="{ background: `rgba(8, 7, 6, ${backdropOpacity})` }"
        role="dialog"
        aria-modal="true"
        :aria-label="`${label}, photo viewer`"
        data-testid="photo-lightbox"
        @keydown="onKeydown"
      >
        <div class="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
          <span class="sb-mono text-white/85" data-testid="lightbox-position">
            {{ index + 1 }} / {{ count }}
          </span>
          <button
            ref="closeButton"
            type="button"
            data-testid="lightbox-close"
            aria-label="Close photo viewer"
            class="flex size-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
            @click="close"
          >
            <UIcon name="i-lucide-x" class="size-5" aria-hidden="true" />
          </button>
        </div>

        <!-- touch-action none: the browser's own pan would otherwise claim the
             gesture before pointermove ever fires. -->
        <div
          ref="stage"
          class="relative flex-1 touch-none overflow-hidden"
          :style="stageStyle"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <div class="flex h-full w-full" :style="trackStyle">
            <div
              v-for="(url, position) in urls"
              :key="url"
              class="flex h-full w-full shrink-0 items-center justify-center px-3"
            >
              <img
                :src="url"
                :alt="`${label}, photo ${position + 1} of ${count}`"
                data-testid="lightbox-image"
                draggable="false"
                class="max-h-full max-w-full rounded-2xl object-contain select-none"
              >
            </div>
          </div>
        </div>

        <div class="flex items-center justify-center gap-1.5 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <button
            v-for="(url, position) in urls"
            :key="url"
            type="button"
            :aria-label="`Show photo ${position + 1}`"
            :aria-current="position === index"
            :data-testid="`lightbox-dot-${position}`"
            class="h-1.5 rounded-full transition-all"
            :class="position === index ? 'w-6 bg-white' : 'w-1.5 bg-white/45'"
            @click="go(position)"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.lb-enter-active,
.lb-leave-active {
  transition: opacity 200ms ease;
}

.lb-enter-from,
.lb-leave-to {
  opacity: 0;
}

/* The spring on the stage is the point of the gesture, but a viewer who has
   asked for less motion gets the position change without the travel. */
@media (prefers-reduced-motion: reduce) {
  .lb-enter-active,
  .lb-leave-active {
    transition: none;
  }
}
</style>
