---
name: Meridian
colors:
  # ── Dark Mode Surfaces (PRIMARY — use these) ──────────────
  surface: '#121218'              # base app bg — near-black
  surface-dim: '#0e0e14'          # dimmed surface, lowest layer
  surface-bright: '#1e1e26'       # elevated surface
  surface-container-lowest: '#0a0a10'
  surface-container-low: '#161620'
  surface-container: '#1e1e2a'
  surface-container-high: '#252532'
  surface-container-highest: '#2d2d3c'
  surface-tint: '#7b8eff'
  surface-variant: '#2a2a3a'
  # ── Text on Surfaces ──────────────────────────────────────
  on-surface: '#e4e2f5'           # primary text — near-white with lavender tint
  on-surface-variant: '#a8a6c0'   # secondary text — muted lavender-gray
  on-background: '#e4e2f5'
  inverse-surface: '#e4e2f5'
  inverse-on-surface: '#121218'
  # ── Outlines ──────────────────────────────────────────────
  outline: '#4a4a62'              # borders, dividers
  outline-variant: '#2e2e42'      # very subtle borders
  # ── Primary (Bright Indigo/Periwinkle) — actions, active nav, KPI ──
  primary: '#7b8eff'              # bright indigo — pops on dark bg
  on-primary: '#0a1060'
  primary-container: '#2346d5'    # used for FAB, filled buttons
  on-primary-container: '#dde0ff'
  inverse-primary: '#2346d5'
  primary-fixed: '#2d3da8'
  primary-fixed-dim: '#4a5cc8'
  on-primary-fixed: '#e8eaff'
  on-primary-fixed-variant: '#bac3ff'
  # ── Secondary (Muted Blue-Gray) — metadata, labels ──
  secondary: '#8a9099'
  on-secondary: '#1a1e23'
  secondary-container: '#252b32'
  on-secondary-container: '#b8c0c8'
  secondary-fixed: '#2a3038'
  secondary-fixed-dim: '#3a4048'
  on-secondary-fixed: '#c8d0d8'
  on-secondary-fixed-variant: '#8a9099'
  # ── Tertiary (Teal/Cyan) — positive gains, income, success ──
  tertiary: '#4fdbcc'             # bright teal — positive indicator
  on-tertiary: '#00201d'
  tertiary-container: '#005049'
  on-tertiary-container: '#70f8e8'
  tertiary-fixed: '#00625a'
  tertiary-fixed-dim: '#007d73'
  on-tertiary-fixed: '#c5fff6'
  on-tertiary-fixed-variant: '#4fdbcc'
  # ── Error/Danger (Red) — expense/loss/overdue ──
  error: '#ff6b6b'                # bright red for dark mode
  on-error: '#5c0000'
  error-container: '#7a1a1a'
  on-error-container: '#ffdad6'
  # ── Background ────────────────────────────────────────────
  background: '#121218'

  # ── Light Mode Fallback (for screens not yet in dark mode) ──
  # NOTE: These are the ORIGINAL Stitch light palette values.
  # Use as fallback ONLY during development when converting screens.
  light-surface: '#fcf8f9'
  light-surface-container-lowest: '#ffffff'
  light-on-surface: '#1b1b1c'
  light-primary: '#2346d5'
  light-background: '#fcf8f9'

typography:
  display-data:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
    # Use for: net worth hero, portfolio total — ONE per screen max
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
    # Use for: screen titles
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    # Use for: section headings (mobile: 18px/600)
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
    # Use UPPERCASE for section category headers
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    # Use for: bottom nav labels, badge counts
rounded:
  sm: 0.25rem       # 4px
  DEFAULT: 0.5rem   # 8px — buttons, inputs, small cards
  md: 0.75rem       # 12px
  lg: 1rem          # 16px — primary cards and modals
  xl: 1.5rem        # 24px — large hero cards
  full: 9999px      # Pills — chips, FAB, trend badges
spacing:
  container-padding: 16px
  stack-gap-sm: 8px
  stack-gap-md: 16px
  stack-gap-lg: 24px
  card-padding: 16px
  grid-gutter: 12px
---

## Brand & Style

**Meridian** is a high-utility personal life tracker. The design delivers precision, calm, and control — finance, vehicles, tasks, and investments unified at a glance.

**Design mode: DARK FIRST.** All screens are implemented in dark mode. Light mode is deferred to Phase 9 (polish). Every token in this file refers to the dark mode palette.

**Stitch project:** [Meridian on Stitch](https://stitch.withgoogle.com/projects/4997376971246377666) — screens prefixed "Meridian:" are the dark mode canonical designs. Screens without the prefix are legacy light-mode designs; use them as layout reference only and convert colors to dark tokens during implementation.

**Design personality:** Premium / Instrumental. The UI feels like a Bloomberg terminal meets a modern consumer app — data-dense but beautiful, controlled, never cluttered.

---

## Dark Mode Color System

### Why Dark?
The primary usage context is late-night financial review and on-the-go checks. Dark mode reduces eye strain, makes number-heavy dashboards more legible, and gives Meridian a premium, distinctive aesthetic that stands out as a portfolio piece.

### Surface Hierarchy (dark, 6 levels)
```
surface-dim (#0e0e14)          ← Lowest — underneath everything
surface (#121218)              ← App background
surface-container-low (#161620) ← Subtle wells
surface-container (#1e1e2a)    ← Cards (primary card bg)
surface-container-high (#252532) ← Active cards, pressed states  
surface-container-highest (#2d2d3c) ← Top-layer overlays, chips
```

### Semantic Color Coding (enforced, never deviate)
| Meaning | Dark Mode Color | Token | Example |
|---|---|---|---|
| Positive / Gain / Income | Bright Teal `#4fdbcc` | `tertiary` | +P&L, credit, income |
| Negative / Loss / Expense | Bright Red `#ff6b6b` | `error` | Debit, overdue, loss |
| Pending / Neutral | Muted Gray `#8a9099` | `secondary` | Pending status |
| Primary Action / Active | Periwinkle `#7b8eff` | `primary` | Buttons, active nav, KPIs |

**Rule: These 4 semantic roles are locked. No exceptions.**

### Card Styling (dark mode)
```
bg: surface-container (#1e1e2a)
border: 1px outline-variant (#2e2e42)
radius: 16px (rounded-xl)
shadow: 0 4px 20px rgba(0, 0, 0, 0.4)   ← stronger shadow on dark
```

---

## Light Mode Fallback Rule

> [!IMPORTANT]
> During implementation of screens **not yet designed in dark mode**, use the light screen from Stitch as a **layout and component reference only**. Apply the dark mode tokens from this file to all colors. Do NOT implement the light colors from those screens.
>
> Screens still on light mode (legacy, no "Meridian:" prefix in Stitch): Finance Dashboard, Finance Home Dashboard (old), Credit Card Detail (old), Bank Accounts (old), Lent & Borrowed (old), Recurring Expenses (old), Finance Reports (old), Tasks Dashboard (old), Investments Dashboard (old), Card T&C Chat, Expense Confirmation (old), Add Expense Form (old).

---

## Typography

All screens use **Inter** exclusively.

### Rules
- `display-data` — ONE per screen. Net worth on Finance Home, portfolio total on Investments.
- Currency display: main figure in `display-data`, decimal in `body-md` at `secondary` color, as separate spans
- `label-md` + `UPPERCASE` + `tracking-wide` — section category headers ("CREDIT CARDS", "UPCOMING DUES")
- All text on dark bg must meet WCAG AA (4.5:1 contrast minimum)

---

## Layout & Spacing

### Screen Structure
```
┌─────────────────────────┐  ← status bar (system — transparent on dark)
│   Top App Bar (56dp)    │  ← sticky, bg-surface, border-b outline-variant
├─────────────────────────┤
│                         │
│   Scrollable Content    │  ← px-16px, gap-16px between cards, pb-24
│                         │
└─────────────────────────┘
│  Bottom Navigation Bar  │  ← fixed, 56dp, 5 tabs, bg-surface
└─────────────────────────┘
```

### Top App Bar (dark)
- Background: `surface` (`#121218`) with `border-b outline-variant`
- Title: `headline-md` bold, `on-surface` color
- Icon buttons: `primary` (#7b8eff) color, `rounded-full p-2`

### Bottom Navigation (dark)
- Background: `surface` with `border-t outline-variant`
- Active: `primary` (#7b8eff) icon + label
- Inactive: `secondary` (#8a9099) icon + label
- 5 tabs: Finance | Garage | Tasks | Investments | More

---

## Components (Dark Mode Spec)

### Card
```
bg-surface-container          (#1e1e2a)
rounded-xl                    (16px)
border border-outline-variant  (#2e2e42)
shadow: 0 4px 20px rgba(0,0,0,0.4)
p-card-padding                (16px)
```

### Primary Button
```
bg-primary-container (#2346d5)
text-on-primary-container (#dde0ff)
rounded-lg, px-6 py-3
active:scale-95
```

### FAB
```
bg-primary (#7b8eff)
text-on-primary (#0a1060)
w-14 h-14 rounded-full
fixed bottom-20 right-4
shadow-lg (stronger on dark)
```

### Input Field (dark)
```
bg-surface-container-high (#252532)
border border-outline (#4a4a62)
rounded-lg px-4 py-3
text-on-surface (#e4e2f5)
focus:border-primary (#7b8eff) focus:border-2
```
Label: persistent above field, `label-md secondary`

**Date inputs MUST use a native date-picker or calendar picker component — never a free-text field.** Every date-related input (due dates, billing dates, reminder dates, etc.) must display a calendar picker on tap. This ensures valid date entries and consistent UX across all modules.

### Status Chip (dark)
```
rounded-full px-3 py-1 font-label-sm
```
| Status | Background | Text |
|---|---|---|
| Pending | `secondary-container` (#252b32) | `secondary` (#8a9099) |
| Active/Credit/Gain | `tertiary-container` (#005049) | `tertiary` (#4fdbcc) |
| Overdue/Debit/Loss | `error-container` (#7a1a1a) | `error` (#ff6b6b) |
| Settled | `surface-container-high` (#252532) | `on-surface-variant` (#a8a6c0) |

### List Row (dark)
```
flex items-center justify-between
py-3 border-b border-outline-variant (#2e2e42)
min-height: 56dp
```

### Charts (dark mode)
**Line Chart:**
- Stroke: 2px, `primary` (#7b8eff)
- Area fill: primary at 15% opacity gradient → 0%
- Grid: `outline-variant` (#2e2e42), horizontal only

**Bar Chart:**
- Bar color: `primary` (#7b8eff) for current, `surface-container-high` for comparison
- 4px top-radius

**Donut/Pie:**
- Segment colors: `primary`, `tertiary`, `secondary-fixed`, `primary-fixed-dim`, `tertiary-fixed`
- Center bg: `surface-container`

---

## Screens Reference (Current State)

### 🟢 Dark Mode — "Meridian:" screens (implement as-is)
These are the canonical screens to implement. Title starts with "Meridian:" in Stitch.

| # | Screen Title | Screen ID | Module | Phase |
|---|---|---|---|---|
| 1 | Meridian: Finance Home | `58381ce9` | Finance | 1 |
| 2 | Meridian: Add Expense Form | `d7ccc69b` | Finance | 1 |
| 3 | Meridian: Recurring Expenses | `d8377e5a` | Finance | 1 |
| 4 | Meridian: Expense Confirmation | `0defa469` | Finance | 4 |
| 5 | Meridian: Bank Accounts | `5a2de0fa` | Finance | 1 |
| 6 | Meridian: Finance Reports | `f948153e` | Finance | 1 |
| 7 | Meridian: Lent & Borrowed | `91c0f6c3` | Finance | 1 |
| 8 | Meridian: Credit Card Detail | `161fcd4a` | Finance | 1 |
| 9 | Meridian: Tasks Dashboard | `2182c5fd` | Tasks | 3 |
| 10 | Meridian: Garage Dashboard | `81c32b9d` | Garage | 2 |
| 11 | Meridian: Investments Dashboard | `9512ff42` | Equity | 5 |
| 12 | Meridian: Portfolio History | `ce17ede3` | Equity | 5 |
| 13 | Meridian: 2026 Goals Tracker | `0c0a94da` | Personal | 7 |
| 14 | Meridian: Personal Notes | `01927f8f` | Personal | 7 |
| 15 | Meridian: Recipes Library | `9ae1a2ca` | Personal | 7 |
| 16 | Meridian: Diet Plan Tracker | `ea8ee4d1` | Personal | 7 |

### 🟡 Light Mode — Use Layout Only, Convert Colors to Dark Tokens
These exist in Stitch but are pre-rename light screens. Use for layout/component reference; apply dark tokens during implementation.

| # | Screen Title | Screen ID | Module | Phase |
|---|---|---|---|---|
| 17 | Finance Dashboard | `1174127b` | Finance | 1 |
| 18 | Finance Home Dashboard | `f251409b` | Finance | 1 |
| 19 | Credit Card Detail | `32a348f3` | Finance | 1 |
| 20 | Bank Accounts | `dcbc527c` | Finance | 1 |
| 21 | Lent & Borrowed | `64978493` | Finance | 1 |
| 22 | Recurring Expenses | `3d7afd51` | Finance | 1 |
| 23 | Finance Reports | `322593d2` | Finance | 1 |
| 24 | Add Expense Form | `c6f62569` | Finance | 1 |
| 25 | Expense Confirmation | `ea7005ad` | Finance | 4 |
| 26 | Card T&C Chat | `a63955df` | Finance/AI | 6 |
| 27 | Garage Dashboard | `3bdaa732` | Garage | 2 |
| 28 | Vehicle Garage Dashboard | `10e22cae` | Garage | 2 |
| 29 | Fuel Fill Log & Add Form | `1eb6207e` | Garage | 2 |
| 30 | Vehicle Spend Log & Add Form | `2403cf10` | Garage | 2 |
| 31 | Vehicle Reports | `eb82cbe8` | Garage | 2 |
| 32 | Tasks Dashboard | `4a299524` | Tasks | 3 |
| 33 | Task List | `60adc49c` | Tasks | 3 |
| 34 | Task Detail | `b96432fe` | Tasks | 3 |
| 35 | Add/Edit Task Form | `411cbf0e` | Tasks | 3 |
| 36 | Investments Dashboard (v1) | `9563eba7` | Equity | 5 |
| 37 | Investments Dashboard (v2) | `33b4130716` | Equity | 5 |
| 38 | Holdings List | `1f358952` | Equity | 5 |
| 39 | Investment Goals | `44523acd` | Equity | 5 |
| 40 | Portfolio History | `978336dd` | Equity | 5 |
| 41 | AI Portfolio Recommendations | `71f5f4e0` | Equity/AI | 6 |
| 42 | Personal Notes | `9921f462` | Personal | 7 |
| 43 | Recipes Library | `b02a14d2` | Personal | 7 |
| 44 | 2026 Goals Tracker | `3e504c8e` | Personal | 7 |
| 45 | Diet Plan Tracker | `8ce17a82` | Personal | 7 |

---

## Navigation Flow

```
Bottom Tab: Finance
  └─ Meridian: Finance Home (dark)
      ├─ [Cards] → Meridian: Credit Card Detail → T&C Chat
      ├─ [Accounts] → Meridian: Bank Accounts
      ├─ [Lent/Borrow] → Meridian: Lent & Borrowed
      ├─ [Recurring] → Meridian: Recurring Expenses
      ├─ [Reports] → Meridian: Finance Reports
      └─ [FAB +] → Meridian: Add Expense Form
              or
         [SMS tap] → Meridian: Expense Confirmation

Bottom Tab: Garage
  └─ Meridian: Garage Dashboard → Fuel Fill | Vehicle Spend | Reports

Bottom Tab: Tasks
  └─ Meridian: Tasks Dashboard → Task Detail | Add/Edit Task

Bottom Tab: Investments
  └─ Meridian: Investments Dashboard
      ├─ Holdings List
      ├─ Investment Goals
      ├─ Meridian: Portfolio History
      └─ AI Portfolio Recommendations

Bottom Tab: More
  └─ Meridian: 2026 Goals | Meridian: Personal Notes
     | Meridian: Recipes Library | Meridian: Diet Plan Tracker
     | Settings
```

---

## React Native Implementation Notes

### Theme Setup
```tsx
// mobile/src/shared/theme/colors.ts
export const colors = {
  // Dark mode (default — production)
  dark: {
    surface: '#121218',
    surfaceContainer: '#1e1e2a',
    surfaceContainerHigh: '#252532',
    surfaceContainerHighest: '#2d2d3c',
    onSurface: '#e4e2f5',
    onSurfaceVariant: '#a8a6c0',
    primary: '#7b8eff',
    primaryContainer: '#2346d5',
    onPrimary: '#0a1060',
    tertiary: '#4fdbcc',
    tertiaryContainer: '#005049',
    error: '#ff6b6b',
    errorContainer: '#7a1a1a',
    outline: '#4a4a62',
    outlineVariant: '#2e2e42',
    secondary: '#8a9099',
    background: '#121218',
  },
  // Light mode fallback (Phase 9 / dev only)
  light: {
    surface: '#fcf8f9',
    surfaceContainerLowest: '#ffffff',
    onSurface: '#1b1b1c',
    primary: '#2346d5',
    background: '#fcf8f9',
  },
} as const;

// Use dark as default during all Phase 0-8 development
export const theme = colors.dark;
```

### Card Shadow (dark)
```tsx
const cardShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.4,
  shadowRadius: 20,
  elevation: 8,  // Android
};
```
