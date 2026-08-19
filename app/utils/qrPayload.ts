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
