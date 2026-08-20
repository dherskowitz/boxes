<script setup lang="ts">
import type { BoxListFilters } from '~/queries/keys'

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

function printSheet() {
  window.print()
}
</script>

<template>
  <div>
    <div v-if="isPending" data-testid="print-sheet-loading">
      <USkeleton class="h-8 w-48" />
    </div>

    <UAlert
      v-else-if="isError"
      data-testid="print-sheet-error"
      title="Could not load boxes"
      :description="pbError(error)"
    />

    <UAlert
      v-else-if="boxes.length === 0"
      data-testid="print-sheet-empty"
      title="No boxes yet"
      description="Create a box first, then come back to print its label."
    />

    <div v-else>
      <div class="no-print flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <UButton variant="outline" @click="selectAll">Select all</UButton>
          <UButton variant="outline" @click="clearAll">Clear all</UButton>
          <UButton :disabled="selectedBoxes.length === 0" @click="printSheet">Print</UButton>
        </div>
        <p>Only the {{ boxes.length }} boxes loaded on this page can be selected.</p>

        <ul class="flex flex-col gap-2">
          <li v-for="box in boxes" :key="box.id">
            <UCheckbox
              :model-value="selected.has(box.qr_id)"
              :label="box.title || box.qr_id"
              :data-testid="`select-box-${box.qr_id}`"
              @update:model-value="toggle(box.qr_id)"
            />
          </li>
        </ul>
      </div>

      <UAlert
        v-if="selectedBoxes.length === 0"
        data-testid="print-sheet-nothing-selected"
        title="Nothing selected"
        description="Tick at least one box above to build a print sheet."
      />

      <div v-else class="sheet-grid grid gap-4">
        <div
          v-for="box in selectedBoxes"
          :key="box.id"
          class="label"
          :data-testid="`print-label-${box.qr_id}`"
        >
          <QrCode :value="boxQrUrl(box.qr_id, origin)" :size="200" />
          <p>{{ box.title || box.qr_id }}</p>
          <p>{{ box.qr_id }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@media print {
  header,
  .no-print {
    display: none;
  }

  .sheet-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .label {
    break-inside: avoid;
  }
}
</style>
