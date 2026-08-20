<script setup lang="ts">
import type { FormError } from '@nuxt/ui'

definePageMeta({ layout: false })

const route = useRoute()
const { login } = useAuth()

const state = reactive({ email: '', password: '' })
const error = ref('')
const pending = ref(false)

function validate(): FormError[] {
  const errors: FormError[] = []
  if (!state.email.trim()) errors.push({ name: 'email', message: 'Enter your email address.' })
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim())) {
    errors.push({ name: 'email', message: 'That does not look like an email address.' })
  }
  if (!state.password) errors.push({ name: 'password', message: 'Enter your password.' })
  return errors
}

async function onSubmit() {
  pending.value = true
  error.value = ''
  try {
    await login(state.email.trim(), state.password)
    const redirect = route.query.redirect
    // Only an internal path. `navigateTo` refuses an external target by
    // throwing, which would leave the user signed in but stranded on /login —
    // and `//evil.example` starts with '/' while still being external.
    const isInternal
      = typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
    await navigateTo(isInternal ? redirect : '/')
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
      <!-- novalidate: the browser's own bubble on `type="email"` would block
           submit before `validate` runs, so the per-field message never shows. -->
      <UForm
        novalidate
        :state="state"
        :validate="validate"
        class="flex flex-col gap-4"
        @submit="onSubmit"
      >
        <h1 class="text-lg font-medium">Storage Boxes</h1>

        <UFormField label="Email" name="email">
          <UInput v-model="state.email" type="email" autocomplete="email" class="w-full" />
        </UFormField>

        <UFormField label="Password" name="password">
          <UInput
            v-model="state.password"
            type="password"
            autocomplete="current-password"
            class="w-full"
          />
        </UFormField>

        <UAlert v-if="error" color="error" :description="error" data-testid="login-error" />

        <UButton type="submit" :loading="pending" block>Sign in</UButton>
      </UForm>
    </UCard>
  </div>
</template>
