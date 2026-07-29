import { StyleSheet } from 'react-native';

/**
 * Tracend design system — kinetic precision, instrument-readout aesthetic.
 * Single source of truth for all Meridian styling.
 */

// ─── Colors ─────────────────────────────────────────────
export const tc = {
  // Core canvas
  canvas: '#090D14',
  surface: '#121925',
  surfaceRaised: '#1A222F',
  surfaceElevated: '#1E2635',
  surfaceDim: '#090D14',
  surfaceBright: '#242D3E',
  surfaceContainerLowest: '#090D14',
  surfaceContainerLow: '#121925',
  surfaceContainer: '#1A222F',
  surfaceContainerHigh: '#1E2635',
  surfaceContainerHighest: '#242D3E',
  surfaceTint: '#9BA5FF',
  surfaceVariant: '#1A222F',
  surfaceTinted: 'rgba(138, 148, 245, 0.06)',

  // Text
  textPrimary: '#F4F7FB',
  textSecondary: '#8894A8',
  textMuted: 'rgba(136, 148, 168, 0.5)',
  textInverse: '#090D14',
  onBackground: '#F4F7FB',

  // Legacy text tokens (maps from old colors.ts)
  onSurface: '#F4F7FB',
  onSurfaceVariant: '#8894A8',

  // Semantic actions
  action: '#9BA5FF',
  actionDim: 'rgba(155, 165, 255, 0.12)',
  actionStrong: 'rgba(155, 165, 255, 0.25)',
  onAction: '#090D14',

  // Macronutrients
  protein: '#9BA5FF',
  proteinBg: 'rgba(155, 165, 255, 0.1)',
  carbs: '#59D6C7',
  carbsBg: 'rgba(89, 214, 199, 0.1)',
  fat: '#FF887D',
  fatBg: 'rgba(255, 136, 125, 0.1)',
  calories: '#F4F7FB',

  // Status
  stable: '#59D6C7',
  stableDim: 'rgba(89, 214, 199, 0.1)',
  attention: '#FF887D',
  attentionDim: 'rgba(255, 136, 125, 0.1)',
  chartreuse: '#BCE85D',
  amber: '#E2A45C',
  amberDim: 'rgba(226, 164, 92, 0.1)',

  // Legacy compatibility
  primary: '#9BA5FF',
  primaryContainer: 'rgba(155, 165, 255, 0.15)',
  onPrimary: '#090D14',
  onPrimaryContainer: '#F4F7FB',
  primaryFixed: '#9BA5FF',
  primaryFixedDim: 'rgba(155, 165, 255, 0.3)',
  onPrimaryFixed: '#090D14',
  onPrimaryFixedVariant: '#F4F7FB',
  inversePrimary: '#9BA5FF',

  secondary: '#8894A8',
  secondaryContainer: 'rgba(136, 148, 168, 0.12)',
  onSecondary: '#090D14',
  onSecondaryContainer: '#F4F7FB',
  secondaryFixed: '#8894A8',
  secondaryFixedDim: 'rgba(136, 148, 168, 0.3)',
  onSecondaryFixed: '#090D14',
  onSecondaryFixedVariant: '#F4F7FB',

  tertiary: '#59D6C7',
  tertiaryContainer: 'rgba(89, 214, 199, 0.12)',
  onTertiary: '#090D14',
  onTertiaryContainer: '#F4F7FB',
  tertiaryFixed: '#59D6C7',
  tertiaryFixedDim: 'rgba(89, 214, 199, 0.3)',
  onTertiaryFixed: '#090D14',
  onTertiaryFixedVariant: '#F4F7FB',

  error: '#FF887D',
  errorContainer: 'rgba(255, 136, 125, 0.1)',
  onError: '#090D14',
  onErrorContainer: '#F4F7FB',
  success: '#59D6C7',
  successContainer: 'rgba(89, 214, 199, 0.1)',
  warning: '#E2A45C',
  warningContainer: 'rgba(226, 164, 92, 0.1)',

  // Borders
  border: 'rgba(198, 197, 215, 0.08)',
  borderStrong: 'rgba(155, 165, 255, 0.25)',
  borderFocus: 'rgba(155, 165, 255, 0.35)',
  borderMuted: 'rgba(136, 148, 168, 0.1)',
  outline: 'rgba(136, 148, 168, 0.25)',
  outlineVariant: 'rgba(198, 197, 215, 0.08)',

  // Misc
  inverseSurface: '#F4F7FB',
  inverseOnSurface: '#090D14',
  background: '#090D14',
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
