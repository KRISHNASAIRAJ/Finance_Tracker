import { StyleSheet } from 'react-native';

/**
 * Tracend design system — kinetic precision, instrument-readout aesthetic.
 * Single source of truth for all Meridian styling.
 */

// ─── Colors ─────────────────────────────────────────────
export const tc = {
  // Core canvas - Meridian v2: one near-black page, flat card surfaces.
  canvas: '#0A0A0C',
  surface: '#131316',
  surfaceRaised: '#1B1B20',
  surfaceElevated: '#202020',
  surfaceDim: '#0A0A0C',
  surfaceBright: '#26262C',
  surfaceContainerLowest: '#050506',
  surfaceContainerLow: '#0A0A0C',
  surfaceContainer: '#131316',
  surfaceContainerHigh: '#1B1B20',
  surfaceContainerHighest: '#26262C',
  surfaceTint: '#F2F2F4',
  surfaceVariant: '#1B1B20',
  surfaceTinted: 'rgba(255, 255, 255, 0.05)',

  // Text
  textPrimary: '#F2F2F4',
  textSecondary: '#8E8E96',
  textMuted: '#6E6E76',
  textInverse: '#0A0A0C',
  onBackground: '#F2F2F4',

  // Legacy text tokens (maps from old colors.ts)
  onSurface: '#F2F2F4',
  onSurfaceVariant: '#8E8E96',

  // Semantic actions
  action: '#F2F2F4',
  actionDim: 'rgba(242, 242, 244, 0.12)',
  actionStrong: 'rgba(242, 242, 244, 0.25)',
  onAction: '#0A0A0C',

  // Macronutrients (kept distinct from the finance/sleep accents)
  protein: '#9BA5FF',
  proteinBg: 'rgba(155, 165, 255, 0.1)',
  carbs: '#59D6C7',
  carbsBg: 'rgba(89, 214, 199, 0.1)',
  fat: '#FF887D',
  fatBg: 'rgba(255, 136, 125, 0.1)',
  calories: '#F2F2F4',

  // Status - colour by meaning
  stable: '#3EE6B0',
  stableDim: 'rgba(62, 230, 176, 0.12)',
  attention: '#FF4D66',
  attentionDim: 'rgba(255, 77, 102, 0.12)',
  chartreuse: '#3EE6B0',
  amber: '#FFB547',
  amberDim: 'rgba(255, 181, 71, 0.12)',

  // Legacy compatibility
  primary: '#F2F2F4',
  primaryContainer: 'rgba(242, 242, 244, 0.15)',
  onPrimary: '#0A0A0C',
  onPrimaryContainer: '#F2F2F4',
  primaryFixed: '#F2F2F4',
  primaryFixedDim: 'rgba(242, 242, 244, 0.3)',
  onPrimaryFixed: '#0A0A0C',
  onPrimaryFixedVariant: '#F2F2F4',
  inversePrimary: '#F2F2F4',

  secondary: '#8E8E96',
  secondaryContainer: 'rgba(242, 242, 244, 0.12)',
  onSecondary: '#0A0A0C',
  onSecondaryContainer: '#F2F2F4',
  secondaryFixed: '#8E8E96',
  secondaryFixedDim: 'rgba(242, 242, 244, 0.3)',
  onSecondaryFixed: '#0A0A0C',
  onSecondaryFixedVariant: '#F2F2F4',

  tertiary: '#9B8CFF',
  tertiaryContainer: 'rgba(155, 140, 255, 0.14)',
  onTertiary: '#0A0A0C',
  onTertiaryContainer: '#F2F2F4',
  tertiaryFixed: '#9B8CFF',
  tertiaryFixedDim: 'rgba(155, 140, 255, 0.3)',
  onTertiaryFixed: '#0A0A0C',
  onTertiaryFixedVariant: '#F2F2F4',

  error: '#EB0028',
  errorContainer: 'rgba(235, 0, 40, 0.12)',
  onError: '#FFFFFF',
  onErrorContainer: '#F2F2F4',
  success: '#3EE6B0',
  successContainer: 'rgba(62, 230, 176, 0.12)',
  warning: '#FFB547',
  warningContainer: 'rgba(255, 181, 71, 0.12)',

  // Borders
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',
  borderFocus: 'rgba(255, 255, 255, 0.28)',
  borderMuted: 'rgba(255, 255, 255, 0.06)',
  outline: 'rgba(242, 242, 244, 0.28)',
  outlineVariant: 'rgba(242, 242, 244, 0.12)',

  // Misc
  inverseSurface: '#F2F2F4',
  inverseOnSurface: '#0A0A0C',
  background: '#0A0A0C',
} as const;

// ─── Glass Noir 2.0 — depth + glow tokens ────────────────
export const glass = {
  fill: 'rgba(255, 255, 255, 0.07)',
  fillStrong: 'rgba(255, 255, 255, 0.11)',
  border: 'rgba(255, 255, 255, 0.18)',
  borderSoft: 'rgba(255, 255, 255, 0.10)',
  highlight: 'rgba(255, 255, 255, 0.30)',
  track: 'rgba(255, 255, 255, 0.07)',
} as const;

export const glow = {
  indigo: '#9B8CFF',
  teal: '#3EE6B0',
  pink: '#FF4D66',
  cyan: '#4DA3FF',
  amber: '#FFB547',
  chartreuse: '#3EE6B0',
} as const;

// LinearGradient color pairs for chips, heroes and accents
export const grad = {
  indigo: ['#9B8CFF', '#5F4FD6'] as const,
  teal: ['#3EE6B0', '#1D9E77'] as const,
  pink: ['#FF4D66', '#C10020'] as const,
  cyan: ['#4DA3FF', '#1F6FCC'] as const,
  lavender: ['#C3B7FF', '#9B8CFF'] as const,
  amber: ['#FFB547', '#D98A12'] as const,
  rose: ['#FF8A9C', '#EB0028'] as const,
  surface: ['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)'] as const,
  heroIndigo: ['rgba(155,140,255,0.22)', 'rgba(22,20,40,0.72)'] as const,
  heroTeal: ['rgba(62,230,176,0.18)', 'rgba(12,32,28,0.72)'] as const,
} as const;

// Legacy alias - some files import `colors` from here
export const colors = tc;

// Old alias for backward compatibility during migration
export { tc as TracendColors };

// ─── Spacing ─────────────────────────────────────────────
export const ts = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  gutter: 20,
  gutterCompact: 16,
  // Legacy aliases
  containerPadding: 20,
  stackGapSm: 8,
  stackGapMd: 16,
  stackGapLg: 24,
  cardPadding: 16,
  gridGutter: 12,
};

// Legacy alias
export const spacing = ts;

// ─── Radii ───────────────────────────────────────────────
export const tr = {
  sm: 8,
  DEFAULT: 12,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

// Legacy alias
export const rounded = tr;

// ─── Shared Styles ───────────────────────────────────────
export const card = {
  backgroundColor: tc.surface as string,
  borderRadius: tr.lg,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: tc.border as string,
  overflow: 'hidden' as const,
};

export const cardFocus = {
  ...card,
  borderColor: tc.borderFocus as string,
};

export const cardPlain = {
  backgroundColor: tc.surface as string,
  borderRadius: tr.DEFAULT,
};

export const sectionTitle = {
  fontSize: 10,
  fontWeight: '600' as const,
  color: tc.textSecondary as string,
  letterSpacing: 0.6,
  marginTop: 4,
};

export const dataLarge = {
  fontSize: 28,
  fontWeight: '700' as const,
  color: tc.textPrimary as string,
};

export const dataBase = {
  fontSize: 14,
  fontWeight: '500' as const,
  color: tc.textPrimary as string,
};

export const labelMuted = {
  fontSize: 10,
  fontWeight: '600' as const,
  color: tc.textMuted as string,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
};

// ─── Progress Bar ────────────────────────────────────────
export const progressTrack = {
  height: 1.5,
  backgroundColor: 'rgba(198, 197, 215, 0.12)' as string,
  borderRadius: 1,
  overflow: 'hidden' as const,
};

export const progressFill = (pct: number, color: string) => ({
  height: 1.5,
  width: `${Math.min(100, Math.max(0, pct))}%` as string,
  backgroundColor: color,
  borderRadius: 1,
});

// ─── Macro dot helpers ───────────────────────────────────
export const macroDot = (color: string) => ({
  width: 6,
  height: 6,
  borderRadius: 3,
  backgroundColor: color,
});

// ─── Navigation Theme ────────────────────────────────────
export const navigationTheme = {
  dark: true,
  colors: {
    primary: tc.action,
    background: tc.canvas,
    card: tc.surface,
    text: tc.textPrimary,
    border: tc.border,
    notification: tc.attention,
  },
  fonts: {
    regular: {
      fontFamily: 'System',
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500' as const,
    },
    bold: {
      fontFamily: 'System',
      fontWeight: '700' as const,
    },
    heavy: {
      fontFamily: 'System',
      fontWeight: '800' as const,
    },
  },
};
