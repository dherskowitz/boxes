/**
 * Every box carries a signature colour. It washes its card on the index,
 * fills its detail hero, tints its item rows, and prints as the band across
 * the top of its label — so a box is recognisable before its title is read.
 *
 * Derived from `qr_id` rather than stored: the schema has no colour field
 * (and `pb_migrations/` is the source of truth, not something to widen for a
 * visual), and a derived value is the same on every device, offline, and on
 * paper. `qr_id` never changes for the life of a box, so neither does its
 * colour.
 *
 * The eight stops are the ones drawn in the v2 design, not a generated ramp.
 * `on` is the text colour that clears contrast on that fill — the two
 * lightest stops need dark ink, the rest take white.
 */
export interface BoxColor {
  /** oklch fill, e.g. `oklch(0.58 0.16 152)`. */
  color: string
  /** Text/icon colour that reads on `color`. */
  on: string
}

const PALETTE: readonly BoxColor[] = [
  { color: 'oklch(0.58 0.16 152)', on: '#ffffff' },
  { color: 'oklch(0.60 0.20 25)', on: '#ffffff' },
  { color: 'oklch(0.55 0.20 305)', on: '#ffffff' },
  { color: 'oklch(0.62 0.15 60)', on: '#241a08' },
  { color: 'oklch(0.62 0.14 195)', on: '#0a1c1f' },
  { color: 'oklch(0.58 0.16 350)', on: '#ffffff' },
  { color: 'oklch(0.55 0.21 292)', on: '#ffffff' },
  { color: 'oklch(0.58 0.15 120)', on: '#ffffff' }
]

export function boxColor(qrId: string): BoxColor {
  // Sum of code points, not a hash library: eight buckets need eight buckets'
  // worth of mixing, and this stays identical between the browser, a unit
  // test and the print sheet.
  let sum = 0
  for (let i = 0; i < qrId.length; i++) sum += qrId.charCodeAt(i)
  // `?? PALETTE[0]` only to satisfy noUncheckedIndexedAccess — the modulo
  // cannot land outside the array.
  return PALETTE[sum % PALETTE.length] ?? { color: 'oklch(0.55 0.21 292)', on: '#ffffff' }
}

/**
 * The same colour as the two custom properties every `.sb-*` class reads.
 * Bind with `:style="boxColorVars(box.qr_id)"` on whatever element scopes it.
 */
export function boxColorVars(qrId: string): Record<string, string> {
  const { color, on } = boxColor(qrId)
  return { '--c': color, '--c-on': on }
}
