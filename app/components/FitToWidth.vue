<script setup lang="ts">
/**
 * Shrink content to fit the width available, keeping its aspect ratio.
 *
 * For the label previews. A label is sized in inches because it has to print at
 * physical size, and `BoxLabel` deliberately refuses `max-width: 100%` — a 4 × 4
 * label clamped to 368px wide while its height stays 4in is not square, and the
 * one thing a preview of physical stock has to get right is its shape. So the
 * page used to scroll sideways instead, which it did for four of the five sizes.
 *
 * A transform keeps the ratio exactly and costs nothing at print time, where the
 * rule below resets it: the sheet is real inches again.
 *
 * `naturalWidth` is in CSS pixels — inches × 96.
 */
const props = defineProps<{ naturalWidth: number }>()

const host = useTemplateRef<HTMLElement>('host')
const inner = useTemplateRef<HTMLElement>('inner')

const scale = ref(1)
const scaledHeight = ref<number | null>(null)

function measure() {
  const hostEl = host.value
  const innerEl = inner.value
  if (!hostEl || !innerEl) return

  const available = hostEl.clientWidth
  const nextScale = available > 0 && props.naturalWidth > available
    ? available / props.naturalWidth
    : 1

  // A transform does not change the layout box, so the untransformed height
  // would leave a gap under a scaled-down label. Reserve the scaled height.
  const nextHeight = innerEl.offsetHeight * nextScale

  // Assign only on a real change. This component sets the height of the very
  // element it observes, so writing unconditionally feeds the observer its own
  // output and it never settles.
  if (nextScale !== scale.value) scale.value = nextScale
  if (nextHeight !== scaledHeight.value) scaledHeight.value = nextHeight
}

let observer: ResizeObserver | null = null
let frame = 0

/**
 * Measuring straight out of the callback resizes an observed element during
 * the observation pass, which the browser reports as "ResizeObserver loop
 * completed with undelivered notifications". A frame's delay puts the write
 * after the pass instead.
 */
function scheduleMeasure() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(measure)
}

onMounted(() => {
  measure()
  observer = new ResizeObserver(scheduleMeasure)
  if (host.value) observer.observe(host.value)
  // The inner box too: on the batch sheet the grid grows and shrinks as boxes
  // are ticked, with no change to naturalWidth to watch.
  if (inner.value) observer.observe(inner.value)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  observer?.disconnect()
  observer = null
})

// The label changes shape when a different stock is picked, and the picker does
// not remount this — measure again once the new size has rendered.
watch(() => props.naturalWidth, () => nextTick(measure))
</script>

<template>
  <div ref="host" class="fit-host" data-testid="label-frame" :style="scaledHeight === null ? undefined : { height: `${scaledHeight}px` }">
    <div
      ref="inner"
      class="fit-inner"
      :style="{ transform: `scale(${scale})` }"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.fit-host {
  overflow: hidden;
}

.fit-inner {
  transform-origin: top left;
  width: max-content;
}

@media print {
  /* `!important` on purpose: it has to beat the inline transform above, and a
     scaled label would print at the wrong physical size. */
  .fit-host {
    height: auto !important;
    overflow: visible;
  }

  .fit-inner {
    transform: none !important;
  }
}
</style>
