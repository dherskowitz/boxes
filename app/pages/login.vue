<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const { login } = useAuth()

const email = ref('')
const password = ref('')
const error = ref('')
const pending = ref(false)

async function onSubmit() {
  pending.value = true
  error.value = ''
  try {
    await login(email.value, password.value)
    const redirect = route.query.redirect
    await navigateTo(typeof redirect === 'string' ? redirect : '/')
  } catch (e) {
    error.value = pbError(e)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <UCard class="w-full max-w-sm">
      <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
        <h1 class="text-lg font-medium">Storage Boxes</h1>

        <UFormField label="Email">
          <UInput v-model="email" type="email" autocomplete="email" required class="w-full" />
        </UFormField>

        <UFormField label="Password">
          <UInput
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            class="w-full"
          />
        </UFormField>

        <UAlert v-if="error" :description="error" data-testid="login-error" />

        <UButton type="submit" :loading="pending" block>Sign in</UButton>
      </form>
    </UCard>
  </div>
</template>
