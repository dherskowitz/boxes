/**
 * Text colour that stays legible on an arbitrary background.
 *
 * Tag colours are user data — any hex can be stored — so a chip cannot assume
 * white ink the way `boxColor` can, where the eight fills are fixed and each
 * ships its own `on` value. Painting a background and leaving the foreground to
 * the component's default is what put dark green type on a green chip in dark
 * mode.
 *
 * Uses the WCAG relative-luminance formula rather than a naive average: at the
 * same average, a green reads far brighter than a blue, and averaging picks
 * white ink for backgrounds that plainly need black.
 *
 * Anything it cannot parse — a CSS variable, a named colour, `oklch(…)` —
 * returns white, which is what the app's own accent and every saturated tag in
 * the seed want anyway.
 */
export function readableInk(background: string): string {
  const hex = background.trim().replace(/^#/, '')
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex
  if (!/^[0-9a-f]{6}$/i.test(full)) return '#ffffff'

  const channel = (offset: number) => {
    const value = parseInt(full.slice(offset, offset + 2), 16) / 255
    // sRGB gamma, not the raw value: 50% grey is nowhere near half as bright.
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)

  // Not a midpoint and not a guess. WCAG contrast is (Ll + 0.05) / (Ld + 0.05),
  // so white and black tie where (1.05)/(L + 0.05) = (L + 0.05)/(0.05) — that is
  // L = sqrt(1.05 * 0.05) - 0.05, about 0.179. Above it black wins, below it
  // white does. Picking anything higher hands white to mid-tones it cannot
  // carry: on the seed's #16a34a green, white scores 3.3:1 and black 6.4:1.
  return luminance > 0.179 ? '#16130f' : '#ffffff'
}
