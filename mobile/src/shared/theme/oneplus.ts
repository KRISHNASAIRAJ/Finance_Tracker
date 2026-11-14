/**
 * oneplus — the Meridian v2 palette (formerly the OxygenOS palette).
 *
 * The same palette the home-screen widgets and the pickers use: a near-black
 * canvas, one flat card surface and the Meridian accent set. The pickers use
 * it so that they match the app instead of clashing with it.
 */
export const op = {
  /** The page behind everything. */
  canvas: '#0A0A0C',
  /** A card / sheet floating on the canvas. */
  card: '#131316',
  /** A raised surface inside a card. */
  surface: '#1B1B20',
  surfaceHigh: '#26262C',
  /** A 1dp separator. */
  hairline: '#1E1E22',

  /** Attention, overdue, destructive. */
  red: '#EB0028',
  redSoft: '#FF4D66',
  /** A translucent red (selected chips, rings). */
  redDim: 'rgba(235, 0, 40, 0.18)',

  /** Good, done, gaining. */
  mint: '#3EE6B0',
  /** Bank money. */
  sky: '#4DA3FF',
  /** Near a limit. */
  amber: '#FFB547',
  /** Sleep and investments. */
  violet: '#9B8CFF',

  /** Type. */
  white: '#F2F2F4',
  whiteDim: 'rgba(242, 242, 244, 0.72)',
  muted: 'rgba(242, 242, 244, 0.5)',
  faint: 'rgba(242, 242, 244, 0.3)',
  /** The dark ink used on top of an accent fill. */
  ink: '#0A0A0C',

  /** The dimmed page behind a popup. */
  overlay: 'rgba(0, 0, 0, 0.72)',
};

/** The radius of a popup card. */
export const OP_CARD_RADIUS = 26;
/** The radius of a small chip / button. */
export const OP_CHIP_RADIUS = 12;
