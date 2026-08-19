const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const LENGTH = 8

/**
 * A short, hand-typeable id for a box's printed QR label.
 *
 * Unique-constrained in the schema — the create path retries once on collision.
 * Lowercase alphanumeric only, matching PocketBase's own id pattern and
 * avoiding characters that are ambiguous on a printed sticker.
 */
export function newQrId(): string {
  const out: string[] = []
  // 252 = 7 * 36: the largest multiple of the alphabet size under 256, so
  // rejecting values above it keeps every character equally likely.
  const limit = 252
  while (out.length < LENGTH) {
    const bytes = new Uint8Array(LENGTH)
    crypto.getRandomValues(bytes)
    for (const byte of bytes) {
      if (byte < limit && out.length < LENGTH) {
        out.push(ALPHABET[byte % ALPHABET.length])
      }
    }
  }
  return out.join('')
}
