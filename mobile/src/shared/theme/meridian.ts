/**
 * meridian.ts — the Meridian v2 design tokens.
 *
 * Single source of truth for the reskinned surfaces (see `DOC-20261114-WA0008`).
 * Flat, high-contrast, instrument-like: one canvas, one card surface, six
 * meaningful accent colours and a strict type scale.
 *
 * Colour is used by MEANING, never by decoration:
 *   red    → attention / overdue / destructive
 *   amber  → near a limit / warning
 *   mint   → good, done, gaining
 *   sky    → bank money
 *   violet → sleep and investments
 *
 * Every animation is under 1.6s and every one of them is opt-out via the
 * system "reduce motion" setting (see `useReducedMotion`).
 */

/** ─── Palette ─────────────────────────────────────────────────────────── */
export const mc = {
  // Canvas & surfaces
  /** The page behind everything. */
  canvas: '#0A0A0C',
  /** The outside of the phone frame (web only, harmless on mobile). */
  void: '#050506',
  /** A card / panel. */
  card: '#131316',
  /** A card that needs a second tone (the credit-card stack). */
  cardAlt: '#16161A',
  /** A raised surface inside a card. */
  raised: '#1B1B20',
  /** A chip / small neutral pill. */
  chip: '#1B1B20',
  /** Chart track + progress track. */
  track: '#26262C',
  /** Inactive chart bar. */
  barDim: '#2A2A31',
  /** A 1dp separator between rows. */
  line: '#1E1E22',
  /** A 1dp separator with a bit more presence. */
  lineSoft: '#26262C',
  /** The drawer's dimmed page behind it. */
  overlay: 'rgba(0, 0, 0, 0.72)',
  /** Border of an unchecked checkbox. */
  checkbox: '#3A3A42',
  /** Label on a filled red chip (day-of-week strip). */
  redLav: '#FFD0D6',
  /** Body copy on a mint-tinted card. */
  mintText: '#CFEFE4',

  // Accents — meaning first
  /** Attention, overdue, destructive. */
  red: '#EB0028',
  /** Attention, but softer (chips, "due soon" text). */
  redSoft: '#FF4D66',
  /** Tinted background for red. */
  redDim: '#3A0A14',
  /** Deeper red tint (the "next service due" panel). */
  redTint: '#1A0A0E',

  /** Good, done, gaining. */
  mint: '#3EE6B0',
  /** Tinted background for mint. */
  mintDim: '#0E2A22',

  /** Bank money. */
  sky: '#4DA3FF',
  /** Tinted background for sky. */
  skyDim: '#0E2038',

  /** Near a limit / warning. */
  amber: '#FFB547',
  /** Tinted background for amber. */
  amberDim: '#3A2A0A',

  /** Sleep and investments. */
  violet: '#9B8CFF',
  /** Tinted background for violet. */
  violetDim: '#1E1A38',
  /** Deeper violet tint (the sleep header panel). */
  violetTint: '#17142B',

  // Type
  /** Primary type. */
  text: '#F2F2F4',
  /** Secondary type (subtitles, captions). */
  textDim: '#8E8E96',
  /** Tertiary type (inactive nav, disabled). */
  textFaint: '#6E6E76',
  /** The dimmest type (footers, empty icons). */
  textGhost: '#55555C',
  /** Ink on top of a red / violet / amber fill. */
  ink: '#0A0A0C',
  /** Pure white (only for brand marks and network logos). */
  white: '#FFFFFF',
} as const;

/**
 * Semantic aliases — prefer these over raw accents so the meaning stays
 * obvious at the call site.
 */
export const mv = {
  attention: mc.red,
  attentionSoft: mc.redSoft,
  warning: mc.amber,
  good: mc.mint,
  bank: mc.sky,
  sleep: mc.violet,
  invest: mc.violet,
} as const;

/** ─── Radii ──────────────────────────────────────────────────────────── */
export const mr = {
  /** A card. */
  card: 26,
  /** A list row / small panel. */
  row: 22,
  /** A chip / segmented pill. */
  chip: 22,
  /** A small tag. */
  tag: 10,
  /** An icon tile. */
  tile: 13,
  /** A small badge. */
  badge: 12,
  /** The bottom navigation pill. */
  nav: 30,
  /** A circular button. */
  circle: 999,
  /** Fully round. */
  full: 9999,
} as const;

/** ─── Type scale ──────────────────────────────────────────────────────── */
export const mtx = {
  /** The all-caps label used on every card. */
  label: { fontSize: 11, fontWeight: '500', letterSpacing: 1.2, color: mc.textDim },
  /** A small all-caps label. */
  labelSm: { fontSize: 10, fontWeight: '500', letterSpacing: 1, color: mc.textDim },
  /** A screen title. */
  title: { fontSize: 26, fontWeight: '500', color: mc.text },
  /** A sub-screen title. */
  titleSm: { fontSize: 19, fontWeight: '500', color: mc.text },
  /** The big number on a hero card. */
  hero: { fontSize: 36, fontWeight: '500', color: mc.text },
  /** A card value. */
  value: { fontSize: 24, fontWeight: '500', color: mc.text },
  /** A row title. */
  rowTitle: { fontSize: 15, fontWeight: '500', color: mc.text },
  /** A row subtitle. */
  rowSub: { fontSize: 12, color: mc.textDim },
  /** Body copy. */
  body: { fontSize: 13, color: mc.text },
} as const;

/** ─── Motion ──────────────────────────────────────────────────────────── */
/**
 * Durations mirror the reference keyframes. Nothing exceeds 1.6s.
 */
export const mm = {
  /** Card fade-up duration. */
  rise: 600,
  /** Per-card stagger. */
  stagger: 50,
  /** Line chart draw-in. */
  draw: 1600,
  /** Bar grow / gauge sweep / ring sweep. */
  sweep: 800,
  /** Number count-up. */
  count: 800,
  /** Tab switch cross-fade. */
  crossfade: 250,
  /** Press feedback. */
  press: 140,
  /** Drawer slide. */
  drawer: 300,
} as const;

/** ─── Helpers ─────────────────────────────────────────────────────────── */

/** A translucent version of a hex colour (e.g. `alpha('#EB0028', 0.2)`). */
export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Clamp a 0..1 ratio. */
export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Clamp a number between two bounds. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
