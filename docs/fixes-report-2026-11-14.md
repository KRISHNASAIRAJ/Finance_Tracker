# Meridian — fix report (2026-11-14)

All changes made after the v2 reskin. Split into what is **pushed** (CI-verified) and what is **uncommitted** (awaiting your go-ahead).

## B. Already pushed (CI green)

| Commit | Fix |
|---|---|
| `3e56774` | Finance home: week-spend bars grow from baseline (shared `BarChart` bug — bars drew off-canvas), expense donut renders (Animated.View inside `<Svg>` was invalid), budget gauge value centered in the arc, CC utilization bar only shown when card limits exist (semantic mint/amber/red). |
| `91cf2f1` | Home: DUE TODAY card stacked under SLEEP in a right column, both cards stretched to the habits card height, footers pinned bottom. |
| `3c10a65` | Monthly Spend: red **+** FAB restored (Screen gained a `floating` overlay layer; it had been anchored to a zero-height wrapper and had vanished). |
| `5f643c5` | Screens s17–s32 reskinned, grouped recent transactions, wallet-load-free spend totals, floating **+** for New expense (Finance tab) and New task (Tasks tab), Vehicle Spend on the s7 layout, second FAB split. |
| `cc9bd14` | PLAN.md feature log. |
| `271eace` | **Launch-crash fix**: loading screen no longer animates an SVG `transform` string (numeric `cy` on the circle instead); SVG-bound opacity animations moved to the JS driver; native splash now shows the new sun-over-horizon vector mark on `#0A0A0C`; launch overlay wrapped in an error boundary so it can never crash the app again. |

## A. Uncommitted (this batch — not pushed, awaiting your go-ahead)

**Root cause of several device bugs:** `PressScale` applied its `style` to the inner `Animated.View`, never to the outer `Pressable` — so any `flex`/`position:absolute`/`width` on it was dead. Fixed by adding an outer `wrapStyle` prop (`PressScale`) and moving all layout to it; visual styling stays on the inner view (press animation unchanged).

| # | Screen / component | Fix |
|---|---|---|
| 1 | Add fuel fill (s27) | PAID VIA segmented row: segments get `flex:1` on the outer wrapper — "Cash" no longer collapses into a red dot and UPI / Card / HP Pay were legible |
| 2 | All transactions (s18) | Category chips rendered as empty pills (single Text child contributed 0 width in the horizontal scroll view); chips now `flexDirection: row` — labels visible, selection works |
| 3 | Garage dashboard (s3) | Per-fill efficiency bars all grey — latest fill bar is now red (mock s3); past fills keep the dim track colour |
| 4 | Finance home (s2) | WALLETS tile now shows **this month's wallet loads** (₹40k) instead of the flat wallet balance (₹2.7k); caption changed to "WALLET LOAD"; tap target → PayzappWallet (unchanged) |
| 5 | Finance home (s2) | RECENT TRANSACTIONS capped at 5 (was 8); "View all" still opens the uncapped All-transactions list (344 records, grouped, searchable) |
| 6 | Finance home / Monthly Spend / Tasks / Garage (tab bar) | Floating **+** buttons had a **zero-height touch target** (size/position on the inner view, Pressable 0×0) — moved all four FABs to `wrapStyle` — first tap now opens the form immediately |
| 7 | Tasks dashboard (s4) | Active/Upcoming segmented control: outer wrapper carries `flex:1`, red pill fills its half (was a collapsing circle over "Upcoming"); clears the day selection when switching tabs |
| 8 | Tasks dashboard (s4) | **Week strip dates are now tappable** — tapping a day filters the list to that day's tasks; tap again (or the "Clear ×" pill, or a tab) to clear; selected chip renders in `mc.redDim` with red-soft text |
| 9 | Vehicle Spend | Quick-add Cancel/Save buttons get outer `flex:1` / `flex:1.4` — they distribute the row correctly |
| 10 | Loans & FDs (s30) | Outstanding-adjust "− Reduce / + Add" buttons get outer `flex:1` |
| 11 | Credit Cards (s23) | Edit/Add card sheet Cancel/Save buttons get outer `flex:1` / `flex:1.4` |
| 12 | Task edit screen (s20) | DUE date/time pills get outer `flex:1.35` / `flex:1` |
| 13 | Transactions list (shared `CategoryIcon`, `ExpandableTransactionCard`) | All category glyphs switched from outline → flat solid **OxygenOS-style** set (`categoryMap.ts`); icon tile radius → 13 (v2 tile language) |
| 14 | `PressScale` (shared) | New optional `wrapStyle` prop for the outer `Pressable` — **this unblocks every fix above** |

### OxygenOS icon mapping (transactions)

Food & Dining → `restaurant` · Grocery → `basket` · Fuel → `gas-station` (MaterialCommunityIcons) · Vehicle Maintenance → `build` · Travel → `airplane` · Shopping → `bag` · Bills & Recharge → `flash` · Rent → `home` · EMI → `repeat` · Entertainment → `film` · OTT → `tv` · Youtube Premium → `play` · Education → `school` · Medical → `medkit` · Health & Wellness → `fitness` · Insurance → `shield-checkmark` · SIP → `trending-up` · Equity Investment → `bar-chart` · Card Annual Charges → `card` · Interest → `calculator` · Family → `heart` · Friends → `people` · Cash Withdrawal → `cash` · Wallet Loads → `wallet` · Professional Service → `briefcase` · Others → `ellipsis-horizontal` · Salary → `arrow-down-circle` · Freelance → `briefcase` · Investment → `trending-up`

*If you want the literal OnePlus icons (solid category-coloured squircle + white glyph) instead of tinted tile + coloured glyph, say so — it's a one-file change in `ExpandableTransactionCard.tsx`.*

## Verification (uncommitted batch)

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| ESLint `--max-warnings 80` | 0 errors (41 warnings — all pre-existing) |
| Unit tests | **281/281** |
| E2E boot test | **9/9** (mounts the whole app incl. the loading screen) |

## Open items / your calls

1. **Wallet tile semantics** — I read "the 40k loaded amount" as *this month's* wallet loads (same figure as Payzapp → "Loaded this month"). If you meant all-time, say so.
2. **"Vehicle chip name"** — still unresolved; every chip renders the vehicle name correctly on my side. What did you see on device?
3. **Push or not** — the batch above is local-only. Tell me when to push (CI will build the APK with all of it).
4. **Launch animation** — implemented from the text spec (`meridian_loading_screen.html` was never attached). If anything deviates, tell me per step (timings/colours/logo).
