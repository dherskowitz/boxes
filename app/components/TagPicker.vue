<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import type { StorageTag } from '~/types/pocketbase'

/**
 * Reusable tag picker. `v-model` is `string[]` of tag ids — the same shape
 * `StorageBox.tags` / `StorageItem.tags` store, so a consumer binds it
 * straight to a form field with no mapping.
 *
 * Two layouts, because the two forms ask different questions of the same
 * vocabulary:
 *
 * - `search` (the box form) is a combobox. Selected tags sit as chips inside
 *   the field and the matches drop below it with the count of boxes already
 *   carrying each one, so picking the shared spelling is easier than inventing
 *   a near-duplicate.
 * - `chips` (the item form) lays the whole vocabulary out as toggles. An item
 *   is usually tagged from the handful of tags its box already uses, and a
 *   grid you tap beats a field you type into when the answer is already on
 *   screen.
 *
 * The counts come from `useTagUsage()`, which /tags and /reports already
 * fetch. `box_count` rather than `item_count` because `search` only ever
 * renders on the box form — the item form uses `chips`, which shows no counts.
 */
const props = withDefaults(
  defineProps<{ variant?: 'search' | 'chips' }>(),
  { variant: 'search' }
)

const model = defineModel<string[]>({ default: () => [] })

const { data: tags } = useTags()
const { data: usage } = useTagUsage()
const createTag = useCreateTag()

// Tags created inline through this picker before `useTags` has refetched —
// merged in so the new chip shows immediately instead of flashing empty.
const justCreated = ref<StorageTag[]>([])

const allTags = computed<StorageTag[]>(() => {
  const known = tags.value ?? []
  const knownIds = new Set(known.map(t => t.id))
  return [...known, ...justCreated.value.filter(t => !knownIds.has(t.id))]
})

const boxCounts = computed(() => {
  const map = new Map<string, number>()
  for (const row of usage.value ?? []) map.set(row.id, row.box_count)
  return map
})

const selectedTags = computed(() =>
  model.value
    .map(id => allTags.value.find(t => t.id === id))
    .filter((t): t is StorageTag => t !== undefined)
)

const term = ref('')
const open = ref(false)
const errorMessage = ref('')

// Tags not already selected — nothing useful about offering a duplicate pick.
const unselected = computed(() => allTags.value.filter(t => !model.value.includes(t.id)))

/**
 * Matched through `normalizeTagName` on both sides, not raw substring.
 *
 * A plain match on the typed text leaves "Tax   Records" with no match *and*
 * nothing to create — the create path normalises to "tax records", finds the
 * existing tag and selects it, so offering neither is a dead end for input the
 * app already considers the same name.
 */
const matches = computed(() => {
  const needle = normalizeTagName(term.value)
  if (needle === '') return unselected.value
  return unselected.value.filter(t => normalizeTagName(t.name).includes(needle))
})

/**
 * Whether to offer creating what has been typed. Compared through
 * `normalizeTagName` rather than raw text so "Winter " does not offer to
 * create a second `winter`.
 */
const creatable = computed(() => {
  const name = normalizeTagName(term.value)
  if (name === '') return false
  return !allTags.value.some(t => normalizeTagName(t.name) === name)
})

function addTag(id: string) {
  if (!model.value.includes(id)) model.value = [...model.value, id]
}

function removeTag(id: string) {
  model.value = model.value.filter(t => t !== id)
}

function toggleTag(id: string) {
  if (model.value.includes(id)) removeTag(id)
  else addTag(id)
}

function pick(id: string) {
  addTag(id)
  term.value = ''
  open.value = false
}

async function onCreate() {
  // A double-tap on the create affordance must not create two tags.
  if (createTag.isPending.value) return

  const name = normalizeTagName(term.value)
  if (!name) return

  const existing = allTags.value.find(t => normalizeTagName(t.name) === name)
  if (existing) {
    // The unique constraint would reject a duplicate anyway — select the
    // existing tag instead of surfacing a confusing 400.
    pick(existing.id)
    return
  }

  errorMessage.value = ''
  try {
    const created = await createTag.mutateAsync({ name })
    justCreated.value = [...justCreated.value, created]
    pick(created.id)
  } catch (e) {
    errorMessage.value = pbError(e)
    term.value = ''
    open.value = false
  }
}

/**
 * Enter picks the single remaining match before it offers to create — typing
 * a name in full and pressing Enter should select that tag, not make a second
 * one with the same name.
 */
function onEnter() {
  const [only] = matches.value
  if (only && normalizeTagName(only.name) === normalizeTagName(term.value)) {
    pick(only.id)
    return
  }
  if (creatable.value) void onCreate()
}

/** Backspace on an empty field takes the last chip back off. */
function onBackspace() {
  if (term.value !== '') return
  const last = model.value.at(-1)
  if (last) removeTag(last)
}

// `chips` needs somewhere to type a new name, but only once asked for it —
// the dashed button is the affordance, the field replaces it.
const creatingChip = ref(false)
const chipInput = ref<HTMLInputElement | null>(null)

async function startChipCreate() {
  creatingChip.value = true
  await nextTick()
  chipInput.value?.focus()
}

async function onChipCreate() {
  await onCreate()
  creatingChip.value = false
}

// The list stays open until it is dismissed rather than closing on blur:
// blur fires before the option's own click, so closing there would swallow
// the pick that was already on its way.
const root = ref<HTMLElement | null>(null)
onClickOutside(root, () => { open.value = false })

function chipStyle(tag: StorageTag, selected: boolean): Record<string, string> {
  const color = tag.color || 'var(--sb-accent)'
  // Never a hardcoded white: a tag colour is user data, and the same green
  // that needs dark ink on /tags needs it here.
  return selected
    ? { background: color, color: readableInk(color), borderColor: color }
    : {
        background: 'var(--sb-surface)',
        borderColor: `color-mix(in oklch, ${color} 45%, var(--sb-surface))`,
        color: `color-mix(in oklch, ${color} 80%, var(--sb-text))`
      }
}
</script>

<template>
  <div ref="root" class="flex flex-col gap-2">
    <!-- ── search: chips inside the field, matches below ─────────────────── -->
    <template v-if="props.variant === 'search'">
      <div
        class="flex flex-wrap items-center gap-1.5 rounded-xl border-2 px-2.5 py-2 transition-colors"
        :style="{
          background: 'var(--sb-surface)',
          borderColor: open ? 'var(--sb-accent)' : 'var(--sb-line)'
        }"
        @click="open = true"
      >
        <span
          v-for="tag in selectedTags"
          :key="tag.id"
          class="sb-chip"
          :style="chipStyle(tag, true)"
          :data-testid="`selected-tag-${tag.id}`"
        >
          {{ tag.name }}
          <button
            type="button"
            class="cursor-pointer opacity-70 hover:opacity-100"
            :aria-label="`Remove ${tag.name}`"
            :data-testid="`remove-tag-${tag.id}`"
            @click.stop="removeTag(tag.id)"
          >
            <UIcon name="i-lucide-x" class="size-3" aria-hidden="true" />
          </button>
        </span>

        <input
          v-model="term"
          type="text"
          class="min-w-24 flex-1 bg-transparent py-1 text-[15px] outline-none placeholder:text-[var(--sb-muted)]"
          placeholder="Add a tag"
          data-testid="tag-search"
          @focus="open = true"
          @keydown.enter.prevent="onEnter"
          @keydown.delete="onBackspace"
          @keydown.escape="open = false"
        >
      </div>

      <!-- Nothing to show once every tag is picked and no new name is typed. -->
      <div
        v-if="open && (matches.length > 0 || creatable)"
        class="sb-card overflow-hidden"
        role="listbox"
        data-testid="tag-options"
      >
        <button
          v-for="tag in matches"
          :key="tag.id"
          type="button"
          role="option"
          class="flex w-full cursor-pointer items-center gap-2.5 border-b px-3.5 py-2.5 text-left text-[15px] last:border-b-0"
          :style="{ borderColor: 'var(--sb-line)' }"
          @click="pick(tag.id)"
        >
          <span
            class="size-2.5 shrink-0 rounded-full"
            :style="{ background: tag.color || 'var(--sb-accent)' }"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1 truncate font-semibold">{{ tag.name }}</span>
          <span class="sb-mono shrink-0" :style="{ color: 'var(--sb-muted)' }">
            {{ boxCounts.get(tag.id) ?? 0 }} {{ (boxCounts.get(tag.id) ?? 0) === 1 ? 'box' : 'boxes' }}
          </span>
        </button>

        <button
          v-if="creatable"
          type="button"
          class="flex w-full cursor-pointer items-center gap-2 px-3.5 py-2.5 text-left text-[15px] font-bold"
          :class="matches.length > 0 ? 'border-t' : ''"
          :style="{ borderColor: 'var(--sb-line)', color: 'var(--sb-accent)' }"
          :disabled="createTag.isPending.value"
          data-testid="create-tag"
          @click="onCreate"
        >
          <UIcon name="i-lucide-circle-plus" class="size-4 shrink-0" aria-hidden="true" />
          Create tag “{{ normalizeTagName(term) }}”
        </button>
      </div>
    </template>

    <!-- ── chips: the whole vocabulary as toggles ────────────────────────── -->
    <div v-else class="flex flex-wrap gap-2">
      <button
        v-for="tag in allTags"
        :key="tag.id"
        type="button"
        class="sb-chip cursor-pointer border-2 px-3.5 py-2 text-xs"
        :style="chipStyle(tag, model.includes(tag.id))"
        :aria-pressed="model.includes(tag.id)"
        :data-testid="model.includes(tag.id) ? `selected-tag-${tag.id}` : `tag-option-${tag.id}`"
        @click="toggleTag(tag.id)"
      >
        <UIcon
          v-if="model.includes(tag.id)"
          name="i-lucide-check"
          class="size-3.5 shrink-0"
          aria-hidden="true"
        />
        {{ tag.name }}
      </button>

      <input
        v-if="creatingChip"
        ref="chipInput"
        v-model="term"
        type="text"
        class="sb-chip w-32 border-2 border-dashed px-3.5 py-2 text-xs outline-none"
        :style="{ borderColor: 'var(--sb-line)', background: 'var(--sb-surface)', color: 'var(--sb-text)' }"
        placeholder="Tag name"
        data-testid="new-tag-input"
        @keydown.enter.prevent="onChipCreate"
        @keydown.escape="creatingChip = false; term = ''"
        @blur="onChipCreate"
      >
      <button
        v-else
        type="button"
        class="sb-chip cursor-pointer border-2 border-dashed px-3.5 py-2 text-xs"
        :style="{ borderColor: 'var(--sb-line)', color: 'var(--sb-muted)' }"
        data-testid="new-tag"
        @click="startChipCreate"
      >
        <UIcon name="i-lucide-plus" class="size-3.5 shrink-0" aria-hidden="true" />
        New tag
      </button>
    </div>

    <UAlert
      v-if="errorMessage"
      color="error"
      data-testid="tag-picker-error"
      :description="errorMessage"
    />
  </div>
</template>
