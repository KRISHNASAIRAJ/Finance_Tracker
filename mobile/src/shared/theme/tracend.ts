import { StyleSheet } from 'react-native';

/**
 * Tracend design system — kinetic precision, instrument-readout aesthetic.
 * Single source of truth for all Meridian styling.
 */

// ─── Colors ─────────────────────────────────────────────
export const tc = {
  // Core canvas — Glass Noir: pure black + white translucency
  canvas: '#000000',
  surface: '#101010',
  surfaceRaised: '#1A1A1A',
  surfaceElevated: '#202020',
  surfaceDim: '#000000',
  surfaceBright: '#262626',
  surfaceContainerLowest: '#000000',
  surfaceContainerLow: '#101010',
  surfaceContainer: '#1A1A1A',
  surfaceContainerHigh: '#202020',
  surfaceContainerHighest: '#262626',
  surfaceTint: '#FFFFFF',
  surfaceVariant: '#1A1A1A',
  surfaceTinted: 'rgba(255, 255, 255, 0.06)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textMuted: 'rgba(255, 255, 255, 0.5)',
  textInverse: '#000000',
  onBackground: '#FFFFFF',

  // Legacy text tokens (maps from old colors.ts)
  onSurface: '#FFFFFF',
  onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',

  // Semantic actions
  action: '#FFFFFF',
  actionDim: 'rgba(255, 255, 255, 0.12)',
  actionStrong: 'rgba(255, 255, 255, 0.25)',
  onAction: '#000000',

  // Macronutrients
  protein: '#9BA5FF',
  proteinBg: 'rgba(155, 165, 255, 0.1)',
  carbs: '#59D6C7',
  carbsBg: 'rgba(89, 214, 199, 0.1)',
  fat: '#FF887D',
  fatBg: 'rgba(255, 136, 125, 0.1)',
  calories: '#FFFFFF',

  // Status
  stable: '#59D6C7',
  stableDim: 'rgba(89, 214, 199, 0.1)',
  attention: '#FF887D',
  attentionDim: 'rgba(255, 136, 125, 0.1)',
  chartreuse: '#BCE85D',
  amber: '#E2A45C',
  amberDim: 'rgba(226, 164, 92, 0.1)',

  // Legacy compatibility
  primary: '#FFFFFF',
  primaryContainer: 'rgba(255, 255, 255, 0.15)',
  onPrimary: '#000000',
  onPrimaryContainer: '#FFFFFF',
  primaryFixed: '#FFFFFF',
  primaryFixedDim: 'rgba(255, 255, 255, 0.3)',
  onPrimaryFixed: '#000000',
  onPrimaryFixedVariant: '#FFFFFF',
  inversePrimary: '#FFFFFF',

  secondary: 'rgba(255, 255, 255, 0.7)',
  secondaryContainer: 'rgba(255, 255, 255, 0.12)',
  onSecondary: '#000000',
  onSecondaryContainer: '#FFFFFF',
  secondaryFixed: 'rgba(255, 255, 255, 0.7)',
  secondaryFixedDim: 'rgba(255, 255, 255, 0.3)',
  onSecondaryFixed: '#000000',
  onSecondaryFixedVariant: '#FFFFFF',

  tertiary: '#59D6C7',
  tertiaryContainer: 'rgba(89, 214, 199, 0.12)',
  onTertiary: '#000000',
  onTertiaryContainer: '#FFFFFF',
  tertiaryFixed: '#59D6C7',
  tertiaryFixedDim: 'rgba(89, 214, 199, 0.3)',
  onTertiaryFixed: '#000000',
  onTertiaryFixedVariant: '#FFFFFF',

  error: '#FF887D',
  errorContainer: 'rgba(255, 136, 125, 0.1)',
  onError: '#000000',
  onErrorContainer: '#FFFFFF',
  success: '#59D6C7',
  successContainer: 'rgba(89, 214, 199, 0.1)',
  warning: '#E2A45C',
  warningContainer: 'rgba(226, 164, 92, 0.1)',

  // Borders
  border: 'rgba(255, 255, 255, 0.1)',
  borderStrong: 'rgba(255, 255, 255, 0.25)',
  borderFocus: 'rgba(255, 255, 255, 0.35)',
  borderMuted: 'rgba(255, 255, 255, 0.08)',
  outline: 'rgba(255, 255, 255, 0.25)',
  outlineVariant: 'rgba(255, 255, 255, 0.1)',

  // Misc
  inverseSurface: '#FFFFFF',
  inverseOnSurface: '#000000',
  background: '#000000',
} as const;

// ─── Glass Noir 2.0 — depth + glow tokens ────────────────
export const glass = {
  fill: 'rgba(255, 255, 255, 0.055)',
  fillStrong: 'rgba(255, 255, 255, 0.09)',
  border: 'rgba(255, 255, 255, 0.14)',
  borderSoft: 'rgba(255, 255, 255, 0.08)',
  highlight: 'rgba(255, 255, 255, 0.24)',
  track: 'rgba(255, 255, 255, 0.06)',
} as const;

export const glow = {
  indigo: '#7B8EFF',
  teal: '#4FDBCC',
  pink: '#FFB2B9',
  cyan: '#5EE6FF',
  amber: '#FFD9A0',
  chartreuse: '#BCE85D',
} as const;

// LinearGradient color pairs for chips, heroes and accents
export const grad = {
  indigo: ['#7b8eff', '#3a4fc9'] as const,
  teal: ['#4fdbcc', '#007d73'] as const,
  pink: ['#ffb2b9', '#ea6479'] as const,
  cyan: ['#5ee6ff', '#00a8d6'] as const,
  lavender: ['#d0bcff', '#7b8eff'] as const,
  amber: ['#ffd9a0', '#e2a45c'] as const,
  rose: ['#ffdadc', '#ea6479'] as const,
  surface: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)'] as const,
  heroIndigo: ['rgba(123,142,255,0.32)', 'rgba(30,32,58,0.72)'] as const,
  heroTeal: ['rgba(79,219,204,0.22)', 'rgba(16,40,42,0.72)'] as const,
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
