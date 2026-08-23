<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import type { BoxListFilters } from '~/queries/keys'
import { DEFAULT_SHEET_SIZE, labelSize, perRow, perSheet } from '~/utils/labelSizes'

definePageMeta({ nav: false })

const filters = ref<BoxListFilters>({})
const { data, isPending, isError, error } = useBoxList(filters)

const boxes = computed(() => data.value?.items ?? [])
const selected = ref<Set<string>>(new Set())
const selectedBoxes = computed(() => boxes.value.filter(box => selected.value.has(box.qr_id)))

function toggle(qrId: string) {
  const next = new Set(selected.value)
  if (next.has(qrId)) next.delete(qrId)
  else next.add(qrId)
  selected.value = next
}

function selectAll() {
  selected.value = new Set(boxes.value.map(box => box.qr_id))
}

function clearAll() {
  selected.value = new Set()
}

const origin = window.location.origin

// Which stock is in the printer — its own preference, separate from the
// single-label page: a sheet is for many small stickers, one label is for one
// box, and they are rarely the same size.
const sheetSizeId = useLocalStorage('storage-app-sheet-label-size', DEFAULT_SHEET_SIZE)
const size = computed(() => labelSize(sheetSizeId.value, DEFAULT_SHEET_SIZE))

const sheetSummary = computed(
  () => `${size.value.name} · ${perRow(size.value)} across · ${perSheet(size.value)} per sheet`
)

function printSheet() {
  window.print()
}
</script>

<template>
  <div>
    <header class="sb-header no-print">
      <div class="flex items-center justify-between gap-3">
        <UButton
          to="/boxes"
          icon="i-lucide-arrow-left"
          variant="ghost"
          class="size-10 justify-center rounded-full bg-black/15 text-current hover:bg-black/25"
        >
          <span class="sr-only">Back to boxes</span>
        </UButton>
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 class="sb-display text-[22px]">Print QR labels</h1>
          <p class="sb-mono opacity-85">{{ selectedBoxes.length }} of {{ boxes.length }} selected</p>
        </div>
      </div>
    </header>

    <div class="sb-body">
      <div v-if="isPending" data-testid="print-sheet-loading">
        <USkeleton class="h-8 w-48" />
      </div>

      <UAlert
        v-else-if="isError"
        color="error"
        data-testid="print-sheet-error"
        title="Could not load boxes"
        :description="pbError(error)"
      />

      <UAlert
        v-else-if="boxes.length === 0"
        color="neutral"
        data-testid="print-sheet-empty"
        title="No boxes yet"
        description="Create a box first, then come back to print its label."
      />

      <div v-else class="flex flex-col gap-5">
        <div class="no-print flex flex-col gap-3">
          <div class="flex flex-wrap gap-2">
            <UButton variant="outline" color="neutral" class="rounded-full" @click="selectAll">Select all</UButton>
            <UButton variant="outline" color="neutral" class="rounded-full" @click="clearAll">Clear all</UButton>
            <UButton
              class="rounded-full"
              icon="i-lucide-printer"
              :disabled="selectedBoxes.length === 0"
              @click="printSheet"
            >
              Print {{ selectedBoxes.length || '' }}
            </UButton>
          </div>
          <LabelSizePicker v-model="sheetSizeId" show-per-sheet />

          <p class="text-xs" :style="{ color: 'var(--sb-muted)' }">
            Only the {{ boxes.length }} boxes loaded on this page can be selected.
          </p>

          <!-- Ticked rows carry their box's colour, so the checklist and the
               sheet below it read as the same set of labels. -->
          <ul class="grid gap-2 sm:grid-cols-2">
            <li
              v-for="box in boxes"
              :key="box.id"
              class="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
              :style="[
                boxColorVars(box.qr_id),
                selected.has(box.qr_id)
                  ? {
                    border: '2px solid var(--c)',
                    background: 'color-mix(in oklch, var(--c) 10%, var(--sb-surface))'
                  }
                  : { border: '2px solid var(--sb-line)', background: 'var(--sb-surface)' }
              ]"
            >
              <UCheckbox
                :model-value="selected.has(box.qr_id)"
                :label="box.title || box.qr_id"
                :data-testid="`select-box-${box.qr_id}`"
                :ui="{ label: 'text-[13px] font-extrabold' }"
                @update:model-value="toggle(box.qr_id)"
              />
            </li>
          </ul>
        </div>

        <UAlert
          v-if="selectedBoxes.length === 0"
          color="neutral"
          data-testid="print-sheet-nothing-selected"
          title="Nothing selected"
          description="Tick at least one box above to build a print sheet."
        />

        <div v-else class="flex flex-col gap-3">
          <p class="sb-mono no-print" data-testid="sheet-summary" :style="{ color: 'var(--sb-muted)' }">
            Sheet preview · {{ sheetSummary }}
          </p>

          <!-- Tracks sized to the chosen stock, packing as many across as the
               paper is wide — the layout does not need to know which paper. -->
          <!-- Scaled to fit rather than scrolled sideways. One 4in track is
               already wider than a phone, so on screen the sheet is a shrunken
               page; at print time FitToWidth stands down and it is real inches
               packed to the paper again. -->
          <FitToWidth :natural-width="size.width * 96">
            <div class="sheet-grid" :style="{ '--label-w': `${size.width}in` }">
              <BoxLabel
                v-for="box in selectedBoxes"
                :key="box.id"
                :data-testid="`print-label-${box.qr_id}`"
                :box="box"
                :size="size"
                :qr-value="boxQrUrl(box.qr_id, origin)"
              />
            </div>
          </FitToWidth>

          <p class="no-print flex items-center gap-1.5 text-xs font-bold" :style="{ color: 'var(--sb-muted)' }">
            <UIcon name="i-lucide-scissors" class="size-3.5" aria-hidden="true" />
            Dashed lines are cut guides.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* A 4in label is wider than a phone. Scroll the sheet sideways rather than
   shrink the labels — see the note in BoxLabel. */
/* `auto-fill` at a fixed track rather than a column count: the sheet packs to
   whatever the paper is wide — four 2in labels across a Letter page, one on a
   phone — without the layout having to know which it is printing on. No gap:
   adjacent dashed borders are the shared cut line. */
.sheet-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, var(--label-w));
  justify-content: start;
}

@media print {
  @page {
    size: letter;
    margin: 0.25in;
  }

  header,
  .no-print {
    display: none;
  }

  .sb-body {
    padding: 0;
  }
}
</style>
