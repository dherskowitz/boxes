<script setup lang="ts">
const { isOnline } = useOnline()
</script>

<template>
  <!-- In flow rather than fixed over the page: as an overlay it landed on top
       of each screen's own header — the back chevron, the kebab, the search
       field — so the notice about not being able to edit was itself the thing
       in the way.

       Drawn as a full-bleed strip in the app's own card colours, not a
       coloured alert card. Every screen opens with a saturated header block
       directly underneath, and a rounded blue rectangle floating above a
       purple one read as something that had come loose. Neutral is also the
       only choice that cannot clash: on a box screen the block below is that
       box's own colour. -->
  <div
    v-if="!isOnline"
    data-testid="offline-banner"
    class="flex items-center gap-3 px-[1.375rem] pt-[max(env(safe-area-inset-top),0.75rem)] pb-3"
    :style="{ background: 'var(--sb-surface)', borderBottom: '2px solid var(--sb-line)' }"
  >
    <span
      class="flex size-9 shrink-0 items-center justify-center rounded-[0.75rem]"
      :style="{ background: 'var(--sb-fill)', color: 'var(--sb-on-fill)' }"
    >
      <UIcon name="i-lucide-wifi-off" class="size-[18px]" aria-hidden="true" />
    </span>
    <p class="text-[13px] leading-snug">
      <span class="font-extrabold">You're offline.</span>
      <span :style="{ color: 'var(--sb-muted)' }">
        You can browse what you have already viewed, but you can't create or edit until you reconnect.
      </span>
    </p>
  </div>
</template>
