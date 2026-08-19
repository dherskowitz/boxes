import { expect, test as setup } from '@playwright/test'

const ACCOUNTS = [
  { role: 'dana', email: 'dana@local.test' },
  { role: 'sam', email: 'sam@local.test' },
  { role: 'rae', email: 'rae@local.test' },
  { role: 'nobody', email: 'nobody@local.test' }
] as const

for (const { role, email } of ACCOUNTS) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('storagedev123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/')
    await page.context().storageState({ path: `tests/e2e/.auth/${role}.json` })
  })
}
