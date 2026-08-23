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
  <div
    class="flex min-h-screen flex-col justify-center gap-7 px-[1.625rem] py-[max(env(safe-area-inset-top),2rem)] text-white"
    :style="{ background: 'var(--sb-accent)' }"
  >
    <div class="flex flex-col gap-3.5">
      <div
        class="flex size-18 items-center justify-center rounded-[1.375rem]"
        :style="{ background: 'var(--sb-amber)', color: 'var(--sb-amber-ink)' }"
      >
        <UIcon name="i-lucide-package" class="size-9" aria-hidden="true" />
      </div>
      <!-- The space before the break is load-bearing: a `<br>` adds no
           whitespace to `textContent`, so without it a screen reader
           announces "StorageBoxes". -->
      <h1 class="sb-display text-[38px]">Storage <br>Boxes</h1>
      <p class="max-w-[280px] text-[15px] leading-relaxed opacity-85">
        Know what's in every box without opening a single one.
      </p>
    </div>

    <div
      class="rounded-[1.625rem] p-5"
      :style="{
        background: 'var(--sb-surface)',
        color: 'var(--sb-text)',
        boxShadow: '0 18px 40px rgba(20,6,58,.28)'
      }"
    >
      <!-- novalidate: the browser's own bubble on `type="email"` would block
           submit before `validate` runs, so the per-field message never shows. -->
      <UForm
        novalidate
        :state="state"
        :validate="validate"
        class="flex flex-col gap-3"
        @submit="onSubmit"
      >
        <UFormField label="Email" name="email" :ui="{ label: 'sb-mono text-[var(--sb-muted)]' }">
          <UInput
            v-model="state.email"
            type="email"
            autocomplete="email"
            size="xl"
            icon="i-lucide-mail"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Password" name="password" :ui="{ label: 'sb-mono text-[var(--sb-muted)]' }">
          <UInput
            v-model="state.password"
            type="password"
            autocomplete="current-password"
            size="xl"
            icon="i-lucide-lock"
            class="w-full"
          />
        </UFormField>

        <UAlert v-if="error" color="error" :description="error" data-testid="login-error" />

        <UButton
          type="submit"
          :loading="pending"
          block
          size="xl"
          class="justify-center rounded-[1.125rem] font-extrabold"
          :style="{ background: 'var(--sb-amber)', color: 'var(--sb-amber-ink)' }"
        >
          Sign in
        </UButton>
      </UForm>
    </div>
  </div>
</template>
