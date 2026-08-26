import { expect, test } from '@playwright/test'

/**
 * The install criteria, asserted against the HTML the server actually sends.
 *
 * Chrome and Firefox both decide whether to offer an install from the parsed
 * document: no `<link rel="manifest">` in it, no install UI, on either
 * browser. With `ssr: false` the only HTML there is is the prerendered shell,
 * and @vite-pwa/nuxt's `<VitePwaManifest>` component writes that link at
 * runtime with `useHead` — so the shipped file carried no manifest at all and
 * neither browser ever offered to install the app.
 *
 * `page.request` rather than the DOM on purpose: reading the live document
 * would pass just as happily on a link Vue added after load, which is the
 * thing this is here to rule out.
 */
test('serves an installable shell', async ({ page }) => {
  const html = await (await page.request.get('/')).text()

  expect(html).toContain('rel="manifest"')
  // Without `viewport-fit=cover` every `env(safe-area-inset-*)` in the app
  // resolves to 0, which is invisible in a tab and wrong in every installed
  // window — the status bar sits on top of the header.
  expect(html).toContain('viewport-fit=cover')
})

test('serves a manifest that meets the Android install bar', async ({ page }) => {
  const manifest = await (await page.request.get('/manifest.webmanifest')).json()

  expect(manifest.name).toBeTruthy()
  expect(manifest.short_name).toBeTruthy()
  expect(manifest.start_url).toBeTruthy()

  // Anything other than these three leaves the browser's own bars on screen,
  // and Chrome will not offer to install at all.
  expect(['fullscreen', 'standalone', 'minimal-ui']).toContain(manifest.display)

  // Android needs both sizes before it offers to install (PRD §7.9).
  const sizes = new Set(manifest.icons.map((icon: { sizes: string }) => icon.sizes))
  expect(sizes).toContain('192x192')
  expect(sizes).toContain('512x512')
})

/**
 * A maskable icon is full-bleed by definition: the launcher crops it to its
 * own shape — a circle on some Androids, a squircle on others — and anything
 * transparent at the corners is filled by the launcher's own plate, which is
 * the pale border showing around the app icon on the home screen. The exports
 * shipped with the rounded corners of the `any` icon, so every install drew
 * that plate.
 */
test('exports the maskable icons full-bleed, with no transparent corners', async ({ page }) => {
  await page.goto('/login')

  for (const size of [192, 512]) {
    const corners = await page.evaluate(async (px) => {
      const img = new Image()
      img.src = `/icons/maskable-icon-${px}x${px}.png`
      await img.decode()

      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      ctx.drawImage(img, 0, 0)

      const at = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data[3]
      return [at(0, 0), at(img.width - 1, 0), at(0, img.height - 1), at(img.width - 1, img.height - 1)]
    }, size)

    expect(corners, `maskable-icon-${size} corners`).toEqual([255, 255, 255, 255])
  }
})

/**
 * The nudge used to live only in the default layout, so it appeared only once
 * you were signed in — and the plugin calls `preventDefault()` on the event to
 * suppress Chrome's own mini-infobar in favour of it. Between the two, someone
 * who had not signed in yet was offered no way to install at all, which is most
 * of the people the nudge is for.
 */
test('offers the install nudge on the login screen, before any account', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()

  // Chrome fires this itself once it has read the manifest and found the
  // worker; Playwright's Chromium never installs anything, so it is dispatched
  // by hand. The plugin's listener is what catches it either way.
  await page.evaluate(() => {
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: () => Promise.resolve(),
      userChoice: Promise.resolve({ outcome: 'accepted' })
    })
    window.dispatchEvent(event)
  })

  await expect(page.getByTestId('install-prompt')).toBeVisible()
  await expect(page.getByTestId('install-prompt')).toContainText('home screen')
})
