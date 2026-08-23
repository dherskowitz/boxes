<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'

/**
 * The foot of a paginated list: fetches the next page when it scrolls into
 * view, and offers a button for when it does not.
 *
 * The button is not a fallback nobody sees. An observer that fires on scroll
 * never fires for someone driving by keyboard, and it will not fire at all
 * where reduced motion or a stalled request leaves the sentinel parked
 * on-screen. Tapping it is also the only recovery from a page that failed.
 */
const props = defineProps<{
  /** Whether another page exists. The whole foot disappears when it does not. */
  hasMore: boolean
  /** A page is in flight. Stops the observer asking for the same page twice. */
  loading: boolean
  /** What the list holds, for the end-of-list line: "boxes", "items". */
  noun?: string
  /** How many are loaded, shown once there is nothing more to fetch. */
  total?: number
}>()

const emit = defineEmits<{ more: [] }>()

const sentinel = useTemplateRef<HTMLElement>('sentinel')

useIntersectionObserver(
  sentinel,
  ([entry]) => {
    if (!entry?.isIntersecting) return
    if (!props.hasMore || props.loading) return
    emit('more')
  },
  // Ask a screen early, so the next page is usually there by the time the
  // reader reaches the bottom rather than after a visible stall.
  { rootMargin: '400px' }
)
</script>

<template>
  <div v-if="hasMore" ref="sentinel" class="flex justify-center py-4" data-testid="infinite-more">
    <UButton
      size="lg"
      variant="outline"
      color="neutral"
      class="rounded-full font-extrabold"
      :loading="loading"
      @click="emit('more')"
    >
      {{ loading ? 'Loading…' : 'Load more' }}
    </UButton>
  </div>

  <!-- Only worth saying once the list ran to more than one page: on a short
       list "that is all of them" is stating the obvious. -->
  <p
    v-else-if="noun && total !== undefined && total > 0"
    data-testid="infinite-end"
    class="py-2 text-center text-xs font-bold"
    :style="{ color: 'var(--sb-muted)' }"
  >
    All {{ total }} {{ noun }}
  </p>
</template>
