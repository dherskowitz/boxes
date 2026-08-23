/**
 * The label stock this app can print, and the layout each one wants.
 *
 * One registry rather than numbers scattered through two print pages: a size
 * is not just a width and a height, it is also how big the code should be,
 * whether the title sits under it or beside it, and how many fit on a sheet.
 * Those travel together or they drift apart.
 *
 * Every measurement is in inches. CSS maps 1in to 96px on screen and to a real
 * inch on paper, so the preview and the sticker are the same object.
 */

/** Letter, less the 0.25in margin the print sheet sets on each side. */
export const PRINTABLE_WIDTH_IN = 8
export const PRINTABLE_HEIGHT_IN = 10.5

export type LabelLayout = 'stacked' | 'beside'

export interface LabelSize {
  /** Stable id — this is what gets stored as the reader's preference. */
  id: string
  /** What the picker shows. */
  name: string
  /** What the stock is for, in the reader's terms. */
  hint: string
  width: number
  height: number
  /**
   * Where the title goes relative to the code. Stated, not derived: the rule
   * of thumb is "wide labels put the title beside the code", but 4 × 4 is
   * square and still wants it underneath, so the registry decides.
   */
  layout: LabelLayout
  /** Side of the QR square, inches. */
  qr: number
  /** Title size in points, and how many lines it may run to. */
  titlePt: number
  titleLines: number
  /** The mono code across the band, in points. */
  bandPt: number
  /** Whether there is room for the location under the title. */
  location: boolean
}

/**
 * Ordered smallest to largest — the picker reads as a scale rather than a set.
 *
 * The numbers are per size rather than derived from one formula because the
 * constraint changes shape: on a 2in square the QR is nearly the whole label
 * and the title is a tiebreaker; on 4 × 6 the title is the headline and the
 * code is a convenience.
 */
const SMALLEST: LabelSize = {
  id: '2x2',
  name: '2 × 2 in',
  hint: 'Small square — a shelf of boxes at a glance',
  width: 2,
  height: 2,
  layout: 'stacked',
  qr: 0.98,
  titlePt: 6.5,
  titleLines: 1,
  bandPt: 6,
  // No room. One line of title is all a 2in square carries once the code has
  // taken its share.
  location: false
}

export const LABEL_SIZES: readonly LabelSize[] = [
  SMALLEST,
  {
    id: '4x2',
    name: '4 × 2 in',
    hint: 'Address label — the common sheet stock',
    width: 4,
    height: 2,
    layout: 'beside',
    qr: 1.35,
    titlePt: 13,
    titleLines: 2,
    bandPt: 7,
    location: true
  },
  {
    id: '4x3',
    name: '4 × 3⅓ in',
    hint: 'Shipping label, 6 to a sheet',
    width: 4,
    height: 10 / 3,
    // Stacked, not beside, despite being wider than it is tall: at a 1.2
    // ratio it is nearer square than strip, and a code big enough to earn a
    // label this size leaves the title barely an inch to sit in. Underneath,
    // the title gets the full 3.6in.
    layout: 'stacked',
    // 1.65, not 1.8: this is the tightest stock in the registry — two title
    // lines and a location under a code, in 3⅓in — so it keeps the most
    // headroom for a title that renders larger than planned.
    qr: 1.65,
    titlePt: 16,
    titleLines: 2,
    bandPt: 9,
    location: true
  },
  {
    id: '4x4',
    name: '4 × 4 in',
    hint: 'Large square — one box, one label',
    width: 4,
    height: 4,
    layout: 'stacked',
    qr: 2.2,
    titlePt: 16,
    titleLines: 2,
    bandPt: 11,
    location: false
  },
  {
    id: '4x6',
    name: '4 × 6 in',
    hint: 'Full shipping label — readable across a garage',
    width: 4,
    height: 6,
    layout: 'stacked',
    qr: 3,
    titlePt: 22,
    titleLines: 2,
    bandPt: 12,
    location: true
  }
]

/** Big enough to be the one good label for a box. */
export const DEFAULT_SINGLE_SIZE = '4x4'
/** Small enough that a sheet of them is worth printing. */
export const DEFAULT_SHEET_SIZE = '2x2'

/**
 * Look a size up by id, falling back to `fallback` rather than returning
 * `undefined` — the id comes from localStorage, which can hold anything a
 * previous version wrote or a user typed into devtools.
 */
export function labelSize(id: string | null | undefined, fallback: string): LabelSize {
  return (
    LABEL_SIZES.find(size => size.id === id)
    ?? LABEL_SIZES.find(size => size.id === fallback)
    // Unreachable unless both ids are wrong, and still better than a crash on
    // a print page. Named rather than `LABEL_SIZES[0]`, which is
    // `LabelSize | undefined` under noUncheckedIndexedAccess.
    ?? SMALLEST
  )
}

/** How many fit across one Letter sheet, cut apart on the shared guides. */
export function perRow(size: LabelSize): number {
  return Math.max(1, Math.floor(PRINTABLE_WIDTH_IN / size.width))
}

/** How many fit on one Letter sheet. */
export function perSheet(size: LabelSize): number {
  return perRow(size) * Math.max(1, Math.floor(PRINTABLE_HEIGHT_IN / size.height))
}
