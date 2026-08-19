/**
 * The URL a printed QR code carries.
 *
 * Absolute on purpose: a phone's native camera opens this with no app context,
 * so a relative path would be meaningless. The origin is a parameter rather
 * than read from `window` here so it can be tested without a DOM — and so
 * callers must be explicit about which origin they are committing to paper.
 *
 * Note this is the *app* origin, not `runtimeConfig.public.pocketbaseUrl`,
 * which is a different host in production.
 */
export function boxQrUrl(qrId: string, origin: string): string {
  if (!qrId) throw new Error('boxQrUrl: qr_id is required')
  if (!origin) throw new Error('boxQrUrl: origin is required')
  return `${origin.replace(/\/+$/, '')}/box/${qrId}`
}

const SCAN_PATH = /^\/box\/([a-z0-9]{8})$/

/**
 * Extract a `qr_id` from a scanned QR code's payload, or `null` if it isn't
 * one this app printed.
 *
 * A scanned code is untrusted input a stranger can print and leave lying
 * around, so this is the security-relevant boundary: parse with `new URL`
 * inside a `try` and check only `pathname` against a strict shape — never
 * regex the raw string, which is how `https://evil.example/redirect?to=/box/x`
 * would slip through. The origin is deliberately not checked: a code printed
 * against a different deployment's origin still carries a real id worth
 * honouring. Callers must navigate using only the returned id, never the
 * scanned URL itself.
 */
export function qrIdFromScan(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  const match = SCAN_PATH.exec(url.pathname)
  return match?.[1] ?? null
}
