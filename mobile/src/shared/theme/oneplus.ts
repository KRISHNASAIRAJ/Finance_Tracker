/**
 * oneplus — the OnePlus OxygenOS palette.
 *
 * The same palette the home-screen widgets use: a black canvas, white type
 * and the OnePlus red as the single accent. The pickers use it so that they
 * match the app (Glass Noir) and the widgets instead of clashing with them.
 */
export const op = {
  /** The page behind everything. */
  canvas: '#000000',
  /** A card / sheet floating on the canvas. */
  card: '#101010',
  /** A raised surface inside a card. */
  surface: '#1A1A1A',
  surfaceHigh: '#202020',
  /** A 1dp separator. */
  hairline: '#262626',

  /** The OnePlus red — the single accent. */
  red: '#EB0028',
  redSoft: '#FF3B4F',
  /** A translucent red (selected chips, rings). */
  redDim: 'rgba(235, 0, 40, 0.18)',

  /** Type. */
  white: '#FFFFFF',
  whiteDim: 'rgba(255, 255, 255, 0.72)',
  muted: 'rgba(255, 255, 255, 0.5)',
  faint: 'rgba(255, 255, 255, 0.3)',
  /** The dark ink used on top of the red. */
  ink: '#0B0B0B',

  /** The dimmed page behind a popup. */
  overlay: 'rgba(0, 0, 0, 0.72)',
};

/** The radius of a popup card. */
export const OP_CARD_RADIUS = 28;
/** The radius of a small chip / button. */
export const OP_CHIP_RADIUS = 12;
