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
