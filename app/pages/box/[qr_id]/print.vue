<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { DEFAULT_SINGLE_SIZE, labelSize } from '~/utils/labelSizes'

definePageMeta({ nav: false })

const route = useRoute()
const qrId = computed(() => {
  const param = route.params.qr_id
  if (Array.isArray(param)) return param[0] ?? ''
  return param ?? ''
})

const { data: box, isPending, isError } = useBoxByQrId(qrId)

const origin = window.location.origin
const qrValue = computed(() => boxQrUrl(qrId.value, origin))

// The same colour the box wears in the app, printed as the band across the
// top of its label — so a shelf of labels sorts by eye the way the index does.
const vars = computed(() => boxColorVars(qrId.value))

// Which stock is in the printer is a property of the printer, not of this box:
// stored per device, so it is still right the next time any box is printed.
const sizeId = useLocalStorage('storage-app-label-size', DEFAULT_SINGLE_SIZE)
const size = computed(() => labelSize(sizeId.value, DEFAULT_SINGLE_SIZE))

// `@page { size }` is the only way to tell the printer what stock it is on,
// and it cannot read a custom property — so it is written per selection into
// the document head rather than sat in the stylesheet as five dead rules.
useHead(
  computed(() => ({
    style: [
      {
        key: 'label-page-size',
        innerHTML: `@media print { @page { size: ${size.value.width}in ${size.value.height}in; margin: 0 } }`
      }
    ]
  }))
)

function printLabel() {
  window.print()
}
</script>

<template>
  <div>
    <div v-if="isPending" data-testid="print-loading" class="sb-body pt-6">
      <USkeleton class="h-8 w-48" />
    </div>

    <UAlert
      v-else-if="isError"
      class="m-[1.375rem]"
      color="error"
      data-testid="box-not-found"
      title="Box not found"
      description="No box matches this code."
    />

    <div v-else-if="box">
      <header class="sb-header" :style="vars">
        <div class="flex items-center justify-between gap-3">
          <UButton
            :to="`/box/${qrId}`"
            icon="i-lucide-arrow-left"
            variant="ghost"
            class="size-10 justify-center rounded-full bg-black/15 text-current hover:bg-black/25"
          >
            <span class="sr-only">Back to box</span>
          </UButton>
          <p class="sb-mono opacity-85" data-testid="print-size-label">Print preview · {{ size.name }}</p>
          <UButton
            class="no-print rounded-full bg-white font-extrabold hover:bg-white/90"
            :style="{ color: 'color-mix(in oklch, var(--c) 85%, #000)' }"
            icon="i-lucide-printer"
            @click="printLabel"
          >
            Print
          </UButton>
        </div>
      </header>

      <div class="sb-body flex flex-col gap-4">
        <div class="no-print">
          <LabelSizePicker v-model="sizeId" />
        </div>

        <!-- Scaled to fit rather than scrolled sideways: a 4in label is wider
             than a 390px phone, and four of the five stocks are 4in. -->
        <FitToWidth :natural-width="size.width * 96">
          <BoxLabel data-testid="box-label" :box="box" :size="size" :qr-value="qrValue" />
        </FitToWidth>

        <p class="no-print text-xs" :style="{ color: 'var(--sb-muted)' }">
          Prints one label to a page at {{ size.name }}. The code above the square is
          the fallback for when a scan will not take. For several at once, use the
          print sheet.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media print {
  /* The page *is* the label — `@page size` is set from the head, above. */
  .sb-body {
    padding: 0;
    gap: 0;
  }
}
</style>
