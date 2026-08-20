import { expect, test } from '@playwright/test'

test.describe('unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('redirects to login and preserves the intended destination', async ({ page }) => {
    await page.goto('/box/seedbox1')
    await expect(page).toHaveURL(/\/login\?redirect=/)
    // Vue Router's default query encoder leaves `/` unescaped (it's a legal
    // query character per RFC 3986), so assert the decoded value rather than
    // a specific percent-encoding.
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/box/seedbox1')
  })

  test('returns to the deep link after signing in', async ({ page }) => {
    await page.goto('/box/seedbox1')
    await page.getByLabel('Email').fill('dana@local.test')
    await page.getByLabel('Password').fill('storagedev123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/box/seedbox1')
    // Prove a working box screen is reached, not just a surviving URL.
    await expect(page.getByText('Winter coats and boots')).toBeVisible()
  })

  for (const hostile of ['https://evil.example', '//evil.example']) {
    test(`ignores the external redirect target ${hostile}`, async ({ page }) => {
      await page.goto(`/login?redirect=${encodeURIComponent(hostile)}`)
      await page.getByLabel('Email').fill('dana@local.test')
      await page.getByLabel('Password').fill('storagedev123')
      await page.getByRole('button', { name: 'Sign in' }).click()
      // signed in and inside the app, not stranded on the login screen
      await expect(page).toHaveURL('/')
      await expect(page.getByTestId('sign-out')).toBeVisible()
    })
  }

  // Every route in PRD section 9 except /login itself. The guard is global
  // middleware, so this is really asserting no page opts out of it.
  const PROTECTED = [
    '/',
    '/box/new',
    '/box/seedbox1',
    '/box/seedbox1/print',
    '/box/seedbox1/share',
    // Any id: the guard must fire before the page ever asks for the record.
    '/item/nosuchitem0001',
    '/print-sheet',
    '/search',
    '/tags',
    '/reports'
  ]

  for (const path of PROTECTED) {
    test(`${path} is not publicly reachable`, async ({ page }) => {
      await page.goto(path)
      // 45s, not the 15s default: on a cold dev server /reports pulls in
      // nuxt-charts and its first compile can outlast the default timeout,
      // which looks exactly like an unprotected route.
      await expect(page).toHaveURL(/\/login\?redirect=/, { timeout: 45_000 })
      expect(new URL(page.url()).searchParams.get('redirect')).toBe(path)
      await expect(page.getByTestId('sign-out')).toBeHidden()
    })
  }

  test('refuses an empty submit and names both missing fields', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Enter your email address.')).toBeVisible()
    await expect(page.getByText('Enter your password.')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('refuses an email that is not an email', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('dana.local.test')
    await page.getByLabel('Password').fill('storagedev123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('That does not look like an email address.')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('shows an error for a bad password', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('dana@local.test')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByTestId('login-error')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('signed in as a member', () => {
  test.use({ storageState: 'tests/e2e/.auth/rae.json' })

  test('reaches the app shell rather than the access-denied state', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('access-denied')).toBeHidden()
    // exact: true — the header logo link's accessible name is "Storage Boxes",
    // which substring-matches 'Boxes' too and makes the plain query ambiguous.
    await expect(page.getByRole('link', { name: 'Boxes', exact: true })).toBeVisible()
  })

  test('is sent to the app instead of the login form', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL('/')
  })
})

test.describe('an account without app membership', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('is rejected at the login screen and left with no session', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('nobody@local.test')
    await page.getByLabel('Password').fill('storagedev123')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByTestId('login-error')).toContainText('not an enabled member')
    await expect(page).toHaveURL(/\/login/)
    // The message is the visible half; this is the half that matters. The
    // credentials were valid, so authWithPassword did write a session —
    // login() must have cleared it again.
    // Key-name agnostic on purpose: asserting `getItem('pocketbase_auth')` is
    // null would also pass if the SDK renamed its key and a live token were
    // sitting under the new one.
    const stored = await page.evaluate(() =>
      Object.values(window.localStorage).filter(value => value.includes('"token"'))
    )
    expect(stored).toEqual([])

    // And no app page is reachable with what is left.
    await page.goto('/')
    await expect(page).toHaveURL(/\/login\?redirect=/)
  })
})

test.describe('signed in with a failing directory request', () => {
  test.use({ storageState: 'tests/e2e/.auth/dana.json' })

  test('reports the failure instead of claiming the account has no access', async ({ page }) => {
    await page.route('**/api/collections/storage_app_users/records**', route =>
      route.abort('failed')
    )
    await page.goto('/')
    // the directory query retries with backoff before settling into an error
    await expect(page.getByTestId('membership-error')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('access-denied')).toBeHidden()
  })
})
