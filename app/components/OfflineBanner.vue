<script setup lang="ts">
const { isOnline } = useOnline()
</script>

<template>
  <UAlert
    v-if="!isOnline"
    color="info"
    data-testid="offline-banner"
    title="You're offline"
    description="You can browse what you have already viewed, but you can't create or edit until you reconnect."
  />
</template>
