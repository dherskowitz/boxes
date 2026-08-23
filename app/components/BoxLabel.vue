<script setup lang="ts">
import type { StorageBox } from '~/types/pocketbase'
import type { LabelSize } from '~/utils/labelSizes'

/**
 * One box's printed label, at whatever size it is being printed.
 *
 * Both print surfaces render this — the single-label page and the batch sheet
 * — so a change to what a label says happens once. The size decides the
 * layout: a wide label puts the title beside the code, a square or tall one
 * puts it underneath, and the type scales with the stock rather than with the
 * viewport.
 *
 * Sized in inches throughout. CSS maps 1in to 96px on screen and to a real
 * inch on paper, so the preview and the sticker are the same object.
 */
const props = defineProps<{
  box: Pick<StorageBox, 'qr_id' | 'title' | 'location'>
  size: LabelSize
  /** Absolute URL the code resolves to. */
  qrValue: string
}>()

const label = computed(() => props.box.title || props.box.qr_id)

// Every measurement the template needs, as custom properties — the layout
// rules then read the same numbers the registry states, rather than a second
// copy of them drifting in the stylesheet.
const vars = computed(() => ({
  ...boxColorVars(props.box.qr_id),
  '--w': `${props.size.width}in`,
  '--h': `${props.size.height}in`,
  '--qr': `${props.size.qr}in`,
  '--title-pt': `${props.size.titlePt}pt`,
  '--title-lines': String(props.size.titleLines),
  '--band-pt': `${props.size.bandPt}pt`,
  // Padding and gaps scale with the smaller side, so a 2in square is not
  // given a 4in label's margins.
  '--pad': `${Math.min(props.size.width, props.size.height) * 0.045}in`,
  '--gap': `${Math.min(props.size.width, props.size.height) * 0.03}in`
}))

// The QR renders at a fixed pixel size and is then scaled to `--qr` by CSS.
// Generous, so a 4 × 6 label is not printing an upscaled 100px image.
const qrPixels = computed(() => Math.round(props.size.qr * 96 * 1.5))
</script>

<template>
  <div class="label" :class="`label--${size.layout}`" :style="vars">
    <div class="label-band">
      <span class="sb-mono">{{ box.qr_id }}</span>
    </div>

    <div class="label-body">
      <div class="label-qr">
        <QrCode :value="qrValue" :size="qrPixels" />
      </div>

      <div class="label-text">
        <p class="label-title">{{ label }}</p>
        <p v-if="size.location && box.location" class="label-location">{{ box.location }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No `max-width: 100%`. Clamping the width on a narrow phone while the height
   stays fixed in inches distorts the aspect ratio, which is the one thing a
   preview of physical stock has to get right — a 4 × 4 label rendered 368 × 384
   is not square. The page scrolls it sideways instead. */
.label {
  width: var(--w);
  height: var(--h);
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px dashed #d5d0c5;
  border-radius: 0.06in;
  background: #fff;
  color: #1c1a17;
}

.label-band {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(var(--pad) * 0.6) var(--pad);
  font-size: var(--band-pt);
  white-space: nowrap;
  background: var(--c);
  color: var(--c-on);
  /* Colour is the point of the band — browsers strip backgrounds when
     printing unless told not to. */
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

.label-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: var(--gap);
  padding: var(--pad);
  overflow: hidden;
}

.label--stacked .label-body {
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.label--beside .label-body {
  flex-direction: row;
  align-items: center;
  text-align: left;
}

.label-qr {
  flex: 0 0 auto;
  width: var(--qr);
  height: var(--qr);
  padding: calc(var(--pad) * 0.3);
  border: 1.5px solid #1c1a17;
  border-radius: 0.05in;
  background: #fff;
}

.label-qr :deep(img) {
  width: 100%;
  height: 100%;
}

/* `min-height: 0` and `overflow: hidden` so the text block, not the label,
   absorbs anything that will not fit — a flex child defaults to `min-height:
   auto`, which lets it push past its parent instead of clipping. This is what
   holds when a browser's minimum font size makes the title taller than any
   size in the registry planned for. */
.label-text {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: calc(var(--gap) * 0.5);
}

/* Clamped to the size's own line budget, and deliberately **no `max-height`**.
   A cap in `em` measures a shade under what two lines actually occupy once the
   font's metrics are counted, so it slices the bottom off the last line —
   visibly, and worse the larger the text. `-webkit-line-clamp` truncates at a
   line boundary on its own and needs no help. */
.label-title {
  max-width: 100%;
  font-weight: 800;
  font-size: var(--title-pt);
  line-height: 1.15;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--title-lines);
  line-clamp: var(--title-lines);
  overflow: hidden;
}

.label-location {
  max-width: 100%;
  font-size: calc(var(--title-pt) * 0.6);
  font-weight: 700;
  color: #57544c;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
</style>
