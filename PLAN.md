# Meridian — Feature Implementation Plan

> Status: DONE (implemented on v4)
> Branch: v4

---

## 0. ✅ TODO — sleep, wallets and widgets (v4, this batch)

> **This file is the source of truth.** If a session is interrupted, read §0 first,
> then the section of the feature you were working on. A ✅ means it is done and
> verified; a ⬜ means it is still to do.

### Batch 12 — the sleep tracker fix + device feedback (2026-11-14 / 2026-11-15, not yet on device)

> Everything below is committed to `v4` but NOT device-verified yet — install
> the new CI APK and confirm the list under **Batch 12 — on the device**.

- [x] **The `?` marks are gone (`CreditCardsScreen.tsx`)** — the file had
      corrupted (`U+FFFD`) bytes baked in: the `TOTAL DUE` rupee sign, the
      "Largest:" line separator and every card number slot showed `?`.
      All are proper `₹` / `·` / `••••` again. A repo-wide scan (mobile src,
      web src, android src) finds no `U+FFFD` anywhere else.
- [x] **Category icons are OxygenOS-style** — every expense/income category
      glyph is now from the flat solid MaterialCommunityIcons set (fuel:
      `gas-station`, dining: `silverware-fork-knife`, bills:
      `lightning-bolt`, …). The icon/color contract of `categoryMap.ts` is
      unchanged, so all call sites (Add transaction chips, transaction rows,
      category budgets) render the new set.
- [x] **The wallet-load card moved into Bank accounts** — the Finance screen
      no longer shows anything about wallet loads; the Bank accounts screen
      has a `PAYZAPP WALLET LOADS` row (loads this month + month-to-date
      total, opens the Payzapp loads screen). BANK / LENT / FIXED are now a
      single equal-width row on the Finance screen.
- [x] **The clock clock popup** — the time readout no longer swallows the
      dial: tapping the hour or the minute picks which unit moves (it turns
      red), and dragging the dial sets it. A plain tap on the dial sets the
      value under the finger (it never did before — the overlay ate the
      touch). Explicit **AM / PM** pills sit under the time.
- [x] **The sleep tracker now actually records with the screen off** — the
      accelerometer used before delivered zero samples in deep sleep. The
      service now asks for the **wake-up accelerometer** (`getDefaultSensor(TYPE_ACCELEROMETER, true)` —
      the same accelerometer in wake-up mode, API 21+) and only holds a partial wake
      lock when the device has no wake-up variant.
      *Root cause of "it's not tracking".*
- [x] **Last night's sleep is logged without opening the sleep screen** —
      the inferred session is auto-saved on every app boot and every
      foreground (`modules/sleep/autoSave.ts`), not only when the Sleep
      screen is open. Short nights and pending-gap nights are skipped;
      one night = one record (same `isSameNight` dedup as everywhere).
- [x] **Sleep-only 2x2 widget shows DEEP / LIGHT / AWAKE** — the REM pill is
      gone; three violet lanes (DEEP `#7E6CF0`, LIGHT `#B4A8FF`,
      AWAKE `#FF5B6A`) are drawn from the same motion timeline as the
      Clock + Sleep widget. Payload unchanged (stages were already pushed).
- [x] **"STILL FOR" counts up from seconds** — a 1 s tick shows `42s`, then
      `5m`, then `2h 15m` (was: minute resolution only, `—` for the first
      minute).
- [x] **The "Medium is best with the phone under a pillow…" hint under
      SENSITIVITY is gone.**
- [x] **ExpenseConfirmationScreen redesigned** — thermal-receipt printer
      choreography from the reference: paper emerges in 26 stepped frames
      over 2.6 s (jitter + haptic per step), LOGGED stamp slams at −3° at
      t≈3.0 s, mint LED + `RECEIPT READY`, red "Back to spends" button and
      "Add another" slide up at t≈3.3 s, tap the printer to reprint,
      reduced-motion safe. Amount / category / method come from the saved
      transaction.
- [x] Tests: `autoSave.test.ts` (4) — settled night logs once, in-progress
      night skipped, ambiguous gap waits, disabled tracker does nothing.
      Full suite green (tsc / ESLint / 285 unit / 9 e2e).

### Batch 12 — on the device

- [ ] Install the new APK, then sleep with the phone on the mattress
      tonight — check in the morning that the **sleep entry exists** without
      opening the sleep screen (check the widget too: duration + stage bars).
- [ ] **Sleep-only widget** shows the three stage lanes.
- [ ] **"STILL FOR"** counts up from seconds while tracking.
- [ ] **Clock**: tap the hour or the minute, drag the hand, tap the
      `AM` / `PM` pills.
- [ ] **Credit cards**: the `TOTAL DUE` amount, the `Largest:` line and the
      stack cards show `₹` / `••••` — no `?` anywhere.
- [ ] **Finance screen**: exactly BANK / LENT / FIXED in one row; nothing
      about wallet loads; wallet loads appear inside **Bank accounts**.
- [ ] **Add transaction** screen: categories show the flat solid glyphs.

### Batch 13 — pipeline annotations + realtime weather in the widget (2026-11-15, not yet on device)

> Everything below is uncommitted — say the word and it goes out. Nothing has
> been pushed and the pipeline has NOT been triggered.

- [x] **The CI "1 error" annotation is gone** — the failing
      `expo-doctor` check ("app config fields that may not be synced in a
      non-CNG project") was caused by the `plugins` array in `app.json`
      (expo-location). The committed `android/` folder never prebuilds, and
      the manifest already carries the location permissions, so the config
      was dead — it is removed. `expo-doctor@1.21.8` is now a pinned
      devDependency (CI no longer downloads an unpinned one on the fly —
      the `npm warn` is gone too). **18/18 checks pass locally.**
      The `continue-on-error: true` on the Expo Doctor step is removed — it
      is a real gate now, like tsc and ESLint.
- [x] **The web deployment is out of the pipeline** — the
      `deploy-web` (Netlify, `meridian365.netlify.app`) job is deleted from
      `build-apk.yml` (the site stays live as-is, just not auto-updated).
      The workflow is renamed `Build & Deploy (APK + Web)` → `Build APK`.
      The web app code is untouched.
- [x] **The widget weather is realtime now** (Clock & Sleep 2×2):
      - the JS pushes the GPS fix (~1 km rounded) with every app open /
        foreground together with the fresh Open-Meteo reading —
        the widget now prefers the **fresher of** the JS reading and its own
        fetch, whichever is newer;
      - the widget itself re-reads Open-Meteo from the stored GPS fix on the
        existing 10-minute refresh alarm (throttled to one call per 20 min,
        5 s timeout, off the main thread, failure keeps the last reading) —
        so the temperature is live even when the app is closed for days;
      - the `24°` placeholder default can no longer reach SharedPreferences
        (only real fetches are stored).
- [ ] **On the device**: open the app once (lets the widget learn the GPS
      fix), then check the TEMP cell shows the current temperature — and
      keeps updating while the app stays closed.
- [ ] Confirm the GitHub run for this batch has **no red annotations**.

### Batch 3 — shipped (CI run #85 green, 2026-11-12)

- [x] **Keep in touch (people)** — a per-person cadence list (Weekly / Monthly /
      45 days / Custom N days), a **daily 10:00 AM digest** notification, the
      More-menu + drawer entry. A new person becomes due after one full interval.
      → `modules/people/` (cadence maths + store + sync + screen), migration
      `0049_people.sql`, `schedulePeopleDigest()` in the notification service.
- [x] **Weather (GPS + Open-Meteo)** — free, no API key. The live temperature in
      the **top-right of the Clock & Sleep widget** and a **home-screen card**.
      → `services/weather.ts` (+ `expo-location`), the widget payload gained the
      weather fields, `widget_sun`/`widget_rain` drawables.
- [x] **OxygenOS widget restyle** — the two sleep widgets in OnePlus
      red/white/black (#EB0028). The **animated Stats carousel stays unchanged**.
      → `values/widget_colors.xml`, the shell/pill/cloud drawables, both layouts.
- [x] **HP Pay wallet + the fuel payment mode** — "HP Pay" is a standard wallet
      (mobile + web) and the fuel form asks how the fill was paid; a fill paid
      from HP Pay moves the wallet balance (add / edit / delete).
- [x] **The fuel edit inconsistency is fixed** — a fuel fill and its
      `fuel_purchase` transaction are now linked by `linked_fuel_fill_id`
      (the old date+amount match broke as soon as one was edited) and the sync
      runs both ways: editing the transaction moves the fill (and the price per
      liter is recomputed), deleting one deletes the other.
- [x] **CI:** the migration step now runs `supabase db push --include-all
      --remote --yes` — the runner has no terminal, so the interactive
      confirmation aborted the job as soon as there was something to apply.

### Batch 4 — the device feedback (2026-11-12)

- [x] **The sleep tracker is NIGHT ONLY** — it only runs inside the night
      window (21:30 → 09:30 by default). During the day the service does not
      run at all: **no "Sleep tracking" notification**, no sensor, no battery
      drain. The user-facing feedback is the **notch banner** ("😴 Sleep
      tracking on"), and it only appears when the tracking actually starts —
      at 21:30.
      → `SleepMotionScheduler.kt` (new: the window maths + the exact alarm that
      opens the window), the gate in `SleepMotionService` / `SleepMotionModule`
      / `SleepMotionBootReceiver`, `ACTION_START` in `SleepMotionAlarmReceiver`,
      the app re-arms the tracker on every open (`App.tsx`).
- [x] **The location no longer takes 3+ minutes** — the order is now
      *last known position (instant) → a fresh fix with a 10 s timeout → the
      position cached 30 minutes ago*. The network call has an 8 s timeout too.
      The widget is painted with the cached weather right away and refreshed in
      the background, so a slow GPS can never hold the widget up.
      → `services/weather.ts`, `services/sleepWidget.ts`.
- [x] **The red sleep bar fills the widget** — the pill is now
      `layout_weight="1"` (it grows into the free space, so there is no empty
      gap below it), the island is bigger (68×23dp) and the timeline bars
      (REM 1, REM 2, dots) are **stacked instead of overlapping**.
- [x] **The date carries the month** ("Thu 12 Nov") and the clock uses the
      OnePlus (system) font at medium weight with tight letter spacing.
- [x] **All the widgets are fixed 2×2** (`targetCellWidth/Height=2`,
      `resizeMode="none"`) and **nothing overlaps**.
- [x] **The Stats widget follows the OxygenOS palette too** — the black shell,
      white values, muted labels and the OnePlus red for the negative numbers.
      **The carousel animation is exactly as it was.**

### Batch 5 — shipped (CI run #89 green, 2026-11-12)

- [x] **The weather refreshes** — the reading is reused for **3 hours** and is
      refreshed **every time the app is opened** (and every time it comes back
      to the foreground) → the widget shows the newest reading.
      → `services/weather.ts` (`FRESH_MS` = 3 h), `App.tsx` (`refreshWeather()`),
      the home card refreshes on focus.
- [x] **No duplicate sleep records** — one **night** = one record. A shared
      `isSameNight()` helper (the ranges overlap, or they start less than 60
      minutes apart) is used in `addEntry`, in the local cleanup when the
      store hydrates, in the cloud pull and on the web.
      → `modules/sleep/sleepNights.ts` (+ `web/src/lib/sleepNights.ts`),
      migration `0051_sleep_dedup.sql` (clears the rows already stored).
- [x] **Deleting a sleep record asks first** — the dashboard's edit modal now
      shows a confirmation (the history screen and the web already did).
- [x] **The Clock + Sleep widget is neat and justified** — the date and the
      time are flush left, the weather and the **battery** flush right, the
      seconds sit on the time's baseline, one font family for every number.
      The **battery icon** is the Android 12+ pill shape (a grey outline with
      the OnePlus red fill showing the real level) next to the percentage.
- [x] **The wake-ups stand vertically above the REM bars** in the Clock + Sleep
      widget — a small rotated label (`2 WAKES`), hidden when there are none.
- [x] **The Stats widget labels are OnePlus red** (the values stay white, the
      animation is untouched).

### Batch 6 — the widget cleanup (2026-11-12)

- [x] **The vertical "2 WAKES" label is gone** from the Clock + Sleep widget.
- [x] **The battery is gone** — no icon, no percentage (the `widget_battery`
      drawable and the `BatteryManager` read were removed with it).
- [x] **The weather is gone from the widget** — it "wasn't working", so the
      Clock + Sleep widget is now purely the clock + the last night. The
      weather payload fields are gone from the widget bridge too. **The
      home-screen weather card stays** (it is a separate surface).
- [x] **The Stats widget colours are reversed** — the small labels are now
      **white** and the big numbers are the OnePlus **red `#EB0028`** (the
      direction is carried by the `+`/`-` sign and by "NET LENT" / "NET
      DEBIT"). The carousel animation is untouched.

### Batch 7 — shipped (CI run #92 green, 2026-11-12)

- [x] **The time picker is a round clock** — a 256 dp OnePlus dial with the 12
      numbers, a white hour hand and a red minute hand. **Drag or tap** to set
      the value: the **hour** first, then the **minutes**. The centre shows the
      whole time (the unit being edited is red) with a tappable AM/PM pill.
      **Every minute** — the old 5-minute steps are gone.
- [x] **The pickers use the OnePlus OxygenOS palette** — black card, white
      type, the OnePlus red `#EB0028` as the single accent. New
      `shared/theme/oneplus.ts`.
- [x] **The calendar opens as a centred popup in that palette** — the selected
      day in red, today ringed in red, the month/year/month drill-down and the
      `YYYY-MM-DD` input kept.
- [x] **The date + time picker is one popup with two tabs** — `DATE` (the
      calendar) and `TIME` (the round clock), one **Apply** button.
- [x] **All three pickers are shared** → the change lands on **19 screens**
      at once (no screen changes, the props are unchanged).
- [x] **The red sleep bar gets a bold night ribbon** — a white bar spanning
      the whole night (bedtime → wake time) with the two REM windows **cut
      out of it in the OnePlus red**, so they read as gaps. The thin dotted
      line is gone.
- [x] **Tests:** `shared/components/__tests__/clockMath.test.ts` (14) — the
      angle ⇄ hour/minute maths.

### 📝 Noted for later (not implemented)

- [ ] **The whole app UI in the OnePlus OxygenOS theme** (red / white / black)
      and the **Roboto** font everywhere. The theme is already black/white
      ("Glass Noir") in `shared/theme/tracend.ts` — this is a token-level
      pass over the shared components, not a rewrite.
- [ ] **The logo in the OnePlus OxygenOS style** (a geometric white "M" on the
      OnePlus red over black, replacing the current crystal "M").

### Batch 8 — shipped (CI run #94 green, 2026-11-12)

- [x] **The ribbon is gone — the dotted timeline is back** (and smaller: the
      dots 2 dp, the REM bars 2.5 dp in the dark ink, stacked at 6 / 9.5 dp).
- [x] **The date and the time are centred**, and the day digits are coloured:
      the **first digit of a double-digit day is OnePlus red**, the second
      **white**, a single-digit day **white**. The date is written by the
      provider (a `SpannableString`) with a **midnight refresh** so it rolls
      over on its own.
- [x] **AM/PM on the clock** — its own `TextClock` (`format="a"`), so it
      follows the 12/24-hour system setting.
- [x] **The red bar is smaller** with a small (10 dp) gap underneath it.
- [x] **The Stats widget's tasks card** — the card that showed "TASKS LEFT 2"
      now shows the count plus the **nearest 2 open tasks** (ascending by date,
      the overdue ones first), each with a **circle to tick it off**. Tapping
      the circle deep-links to `meridian://task-complete/<id>` → the app marks
      the task done, toasts and goes back; tapping the name opens the task.
- [x] **The tasks card dwells ~6 s** (it sits in the flipper twice) while
      every other card keeps its 3 s.
- [x] **The weather card is gone from the home screen** — along with the
      `expo-location` plugin and the location permissions in `app.json`.
      *Root cause of "the weather never worked": the CI builds the committed
      `AndroidManifest.xml` (it does **not** run `expo prebuild`), and that
      manifest never had `ACCESS_FINE_LOCATION` — so the GPS was refused.*

### Batch 9 — shipped (CI run #95 green, 2026-11-13)

- [x] **The hours are red** — the Clock + Sleep clock is now two live
      `TextClock`s: the **hours (`hh`) in the OnePlus red**, the **minutes
      (`mm`) in white**, a static `:` between them, then the seconds and the
      AM/PM. The time shrank **26 sp → 23 sp**, the date grew **10 sp → 11 sp**.
- [x] **The SLEEP caption moved into the red bar's cut-out** (the top-left
      notch the pill's shape leaves) — it sits on the black shell next to the
      duration island; the island narrowed 68 → 62 dp to make room and the
      freed row became the gap below the bar (10 → 24 dp).
- [x] **The sleep tracker starts again at night** — two real bugs:
      - the committed manifest only had `SCHEDULE_EXACT_ALARM`, which **Android
        13+ does not grant by default** → the exact alarm threw and the
        inexact fallback could be delayed for hours. **`USE_EXACT_ALARM`** is
        now declared (granted automatically).
      - when the background foreground-service start was refused, the retry
        armed the alarm for **tomorrow** → the whole night was lost. It now
        **retries every 10 minutes** until the window closes, and a start that
        fires before the window opens retries instead of skipping the night.
      - plus a self-heal in the app: inside the night window the sleep screen
        restarts the tracker if the service died (at most once a minute).

### Batch 10 — shipped (CI run #97 green, 2026-11-13)

- [x] **Tapping the Clock & Sleep widget opens the phone's OWN clock app**
      instead of Meridian. The lookup is explicit and reliable: the known
      clock packages (`com.android.deskclock` — the one OnePlus ships —
      `com.oneplus.deskclock`, `com.google.android.deskclock`, …) via their
      launcher intent, then any launcher activity whose package looks like a
      clock, then the `clock://` scheme. When the phone has no clock app the
      tap falls back to Meridian's sleep screen, so it is never dead.
- [x] **The whole widget is one target** (the red bar included) — tapping
      anywhere on it opens the device's clock.
- [x] The manifest gained the `<queries>` entries (the launcher activities
      and the known clock packages) that Android 11+ package visibility needs.
- [x] **Fixed after the first attempt** (the tap did nothing): the implicit
      `clock://` resolution was replaced by an **explicit** lookup — the known
      clock packages via their launcher intent → any launcher activity whose
      package looks like a clock → the `clock://` scheme. The result is cached.
      (The red bar had also been swallowing the tap — it opened Meridian.)

### Batch 11 — the widget redesign: the stage chart + the stats row (2026-11-13)

The Clock + Sleep widget rebuilt to the new mockup (the date and the clock
exactly as they were). Everything is scaled to the **2×2** cell.

- [x] **The SLEEP block** — the red `#E8002A` shape with the cut-out at the
      top left (the SLEEP caption sits in it) and the island on the right
      holding the **duration** and the **sleep score**.
- [x] **The stage chart** — 3 lanes: **DEEP** (a thick rounded bar in
      `#9E0020`), **LIGHT** (a thick rounded bar in `#FF3355`) and **AWAKE** (a
      dotted line at 40 % — black over the red — with the awake segments in
      `#9E0020`). The lane labels are on the left, the bed/wake times
      (`11:40p` / `5:30a`) under the chart.
- [x] **The stages come from the real motion timeline** — a new
      `sleepStages.ts`: a minute with sustained movement is **AWAKE**, a still
      run of ≥ 20 min is **DEEP**, the rest is **LIGHT** (+ tests).
- [x] **The sleep score (0–100)** — a new `sleepScore.ts`: the duration vs.
      the target (50 points), the deep-sleep share (30) and the wake-ups (20).
- [x] **The stats row — 3 slots**: **ALARM** (the next alarm, red; a grey
      `--` when there is none), **BATT** (the battery %, white) and **TEMP**
      (the temperature, white), split by 1 dp `#2A2A2A` dividers.
- [x] **The temperature** — Open-Meteo + the GPS. The location permission is
      now in the **committed** `AndroidManifest.xml` (the CI builds that file
      as it is — it does not run `expo prebuild` — which is why the weather
      never worked before). The reading is cached for **4 hours**.
- [x] **The widget redraws every 10 minutes** (so the battery % and the
      temperature stay fresh); the clock itself ticks on its own.
- [x] **Meridian pushes the sleep data to KWGT** — a new native bridge sends
      the payload as the broadcast `com.meridian.sleep.WIDGET_DATA` (the extra
      `data`), so a KWGT preset can show the same night.

#### The KWGT formulas (every value, bar and label)

| Element | Formula |
|---|---|
| **Date** | `[size=30][color=#8A8A8A]$df(EEE)$[/color][size=30][color=#E8002A] $df(d)$[/color][size=30][color=#FFFFFF] $df(MMM)$[/color]` |
| **Clock** | `[size=56][color=#E8002A]$df(hh)$[/color][size=56][color=#FFFFFF]:$df(mm)$[/color][size=28][color=#8A8A8A]$df(ss) $df(a)$[/color]` |
| **Duration** | `[size=26][color=#0B0B0B]$var(sleep_dur)$[/color]` |
| **Score** | `[size=15][color=#0B0B0B]Score $var(sleep_score)$[/color]` |
| **Lane labels** | `[size=13][color=#0B0B0B]DEEP[/color]` · `LIGHT` · `AWAKE` |
| **Deep bar** (shape) | `x="$var(track_x)$ + $var(deep1_start)$ * $var(track_w)$"` · `w="$var(deep1_len)$ * $var(track_w)$"` · `h="12"` · `r="6"` · `bg="#9E0020"` |
| **Light bar** (shape) | the same maths, `bg="#FF3355"` |
| **Awake track** (shape) | `h="2"` · `bg="#66000000"` (black at 40 % over the red) |
| **Awake segment** (shape) | `bg="#9E0020"`, the same x/w maths |
| **Bed / wake** | `[size=16][color=#0B0B0B]$var(bed_time)$[/color]` (left) · `[size=16][color=#0B0B0B]$var(wake_time)$[/color]` (right) |
| **ALARM** (the system alarm) | `[size=16][b]$if(si(alarmon) = 1, [color=#E8002A]$df("h:mm a", si(alarmd))$[color], [color=#8A8A8A]--[color])$[/size]` |
| **ALARM** (the app's own smart alarm) | `[size=16][b]$if($var(alarm_time)$ != '', [color=#E8002A]$var(alarm_time)$[color], [color=#8A8A8A]--[color])$[/size]` |
| **BATT** | `[size=32][color=#FFFFFF]$bi(level)$%[/color]` |
| **TEMP** | `[size=32][color=#FFFFFF]$wi(temp)$[/color]` |
| **Stat labels** | `[size=18][color=#8A8A8A][ls=1]ALARM[/ls][/color]` · `BATT` · `TEMP` |
| **Dividers** | shape `w="1"` `h="56"` `bg="#2A2A2A"` |
| **The data from Meridian** | `$br(com.meridian.sleep.WIDGET_DATA)$` → the JSON extra `data` (the duration, the score, the bed/wake, the stage bars) |

**The variable contract:** `sleep_dur`, `sleep_score`, `bed_time`, `wake_time`,
`alarm_time`, `track_x`, `track_w` and per segment `deep1_start/deep1_len`,
`deep2_start/deep2_len`, `light1_start/light1_len`, `light2_start/light2_len`,
`awake1_start/awake1_len` — each `_start`/`_len` as a **0…1 fraction of the
night** ✓.

### Batch 3 — on the device

- [ ] Install the new APK (`apk-release` from run #89) — `expo-location` is a
      **new native module**, so an OTA update cannot add it.
- [ ] Check: the widget in the OxygenOS palette with the weather in the top
      right, the home weather card, the Keep in Touch list + the 10 AM digest,
      and the HP Pay fuel flow.
- [ ] Check the batch-4 fixes: **no "Sleep tracking" notification during the
      day** (the tracker only runs 21:30 → 09:30), the weather appears
      **instantly** (no 3-minute wait), the red bar fills the widget, the date
      shows the month, and all the widgets are 2×2 without overlaps.
- [ ] Check the batch-5 fixes: the weather **refreshes when the app is opened**,
      the sleep list has **no duplicates** (and the duplicates that were there
      are gone), deleting a sleep record **asks first**, the clock is
      **justified** with the **battery** under the weather, the **wake-ups
      stand vertically** above the bars, and the Stats labels are **red**.

### Batch 2 — done (shipped in build #82, verified on device)

- [x] **Wallets are their own section** in the Balance Summary (mobile + web) and
      live in the same section as the bank accounts on the Bank Accounts screen
      (mobile + web). Wallet balances count towards the liquid balance **and**
      the net worth.
- [x] **Shared wallet editor** (`WalletBalanceEditor`) used by both mobile screens.
- [x] **Drawer cleanup** — Habits / Finance / Garage / Tasks / Wealth removed
      from the drawer (they are in the bottom tab bar).
- [x] **Sleep screen re-layout** — "LAST NIGHT" on top, the automatic tracking
      card next, "Going to bed" below it, a compact history with a
      **View all (n)** button and a new **All Sleep Logs** page.
- [x] **One-tap "Log last night"** (the habit-style action for the previous
      night only, using the user's own 7-night average and a 7:00 AM wake time).
- [x] **Notch-style sleep notification** — the detected night shows as a brief
      heads-up banner (`sleep-detected` channel, silent, `setTimeoutAfter`).
- [x] **Pillow-friendly motion detection** — the native tracker counts the
      *sustained* movement seconds of every minute, so a bump under the pillow
      is not a wake-up. **Medium sensitivity is the right setting for a phone
      under a pillow.**
- [x] **Interruption rules** — a gap of up to 5 min is a normal interruption
      (a quick phone check), a gap of 5–10 min is asked about in the morning
      ("long interruption or did your sleep end there?" + how long were you
      up), a gap of more than 10 min ends the night there.
- [x] **5-star rating** for the last night.
- [x] **Widgets** — the four quick-action widgets (Add Expense / Add Fuel /
      Add Task / Bedtime) are gone; every widget is 2x2. The **Clock & Sleep**
      widget is hardened and a new **sleep-only 2x2** widget shows the compact
      last night and refreshes every day at **9:00 AM**.
- [x] **"Enable morning auto-detect" removed** — the usage-access auto-detect
      (and its native module + permission) is deleted; the accelerometer
      tracker does the job.
- [x] **Live "STILL FOR"** — the tracker status is polled every 5 s (the sensor
      period) and the readout uses the native `stillSince` timestamp.
- [x] **The widget error is fixed** — Android only allows the view classes
      annotated with `@RemoteViews.RemoteView` inside a widget layout, so the
      plain `<View>` spacers broke both sleep widgets ("An error occurred when
      loading widget").
- [x] **The card bill stays paid** — the web "Pay bill" never rolled the due
      date, and a cloud write that hit no row was dropped silently. Both fixed
      (plus the 31st-billing-day clamp and the persist-key migration).

### Batch 2 — verified on device (2026-11-12, build #82)

- [x] The **Clock & Sleep** and the **sleep-only** widget load again.
- [x] The **green sleep bar** fits the 2x2 cell (26dp pill, 54dp island) and
      the REM timeline sits at the bottom of the pill.
- [x] The **"Tracking your sleep"** notification is quiet and dismissible; the
      tracking feedback is a brief, soundless heads-up banner in the notch area.
- [x] The **card bill** stays paid after an app update.

---

## 1. ✅ Nutrition Trend — Month Selector

**Problem:** The nutrition trend graph only shows 7D and the current month (30D).
Last month's data is invisible.

**Files:** `mobile/src/modules/meals/screens/MealLoggerScreen.tsx`

**Changes:**
- Add `graphMonth` state (`YYYY-MM`, defaults to current month).
- In month mode, show `‹ Jun 2026 ›` arrows to navigate months + a label.
- `monthOverview` becomes a function of `graphMonth` — builds days from the 1st to
  the last day of that month. Current month caps at today; past months show full month.
- Derive navigable months from existing `entries`.
- Added a month picker bottom sheet (tap the month label).

---

## 2. ✅ Quick Meals (from Recipes Library)

**Problem:** Every meal must be typed manually or photo-analyzed. No one-tap presets.

**Plan:**
- Sourced from the **Recipes Library** (`usePersonalStore.recipes`) instead of a
  separate saved-meals concept.
- `QuickMealsScreen` lists recipes — tap → confirmation modal with meal type
  picker, editable macros (cal/protein/carbs/fat), and optional "Estimate macros
  with AI" button.
- Entry point: "Quick Meals" tile in the LOG MEAL bottom sheet.

**Files:**
- `mobile/src/modules/meals/screens/QuickMealsScreen.tsx` (new)
- `mobile/src/modules/meals/screens/MealLoggerScreen.tsx`
- `mobile/src/navigation/RootNavigator.tsx`

---

## 3. ✅ Meal Chat — Add/Delete/Modify with Confirmation

**Problem:** No way to tell the AI to change existing logged meals.

**Plan:**
- New `MealChatScreen` with chat UI + quick prompts + proposed changes card.
- Edge Function `ai-meal-log` extended with `manageMode` — receives today's full
  log context + user request, returns structured `proposedChanges` (add/delete/modify).
- Show a **review card** with all proposed changes. **Confirm** applies all via
  store (addEntry/editEntry/deleteEntry); Discard cancels.
- Entry point: "Meal Chat" tile in the LOG MEAL bottom sheet.

**Files:**
- `supabase/functions/ai-meal-log/index.ts` (manage mode added, deployed)
- `mobile/src/services/aiServices.ts` (analyzeMealManage)
- `mobile/src/modules/meals/screens/MealChatScreen.tsx` (new)
- `mobile/src/modules/meals/screens/MealLoggerScreen.tsx`

---

## 4. ✅ Net Worth + Loans Card in Wealth

**Problem:** Wealth shows only portfolio value; loans exist in the store but are
invisible. Net worth (investments − loans) is not shown.

**Plan:**
- **Net Worth** added as the 4th meta row item in the hero card.
- **Loans card** below the hero: each loan as a row (name + amount + edit/delete),
  with total-loans and net worth summary.
- `LoansManagerScreen` (new) for add/edit/delete loans.
- Registered in `InvestmentsStackParamList` + navigator.

**Files:**
- `mobile/src/modules/equity/screens/InvestmentsDashboardScreen.tsx`
- `mobile/src/modules/equity/screens/LoansManagerScreen.tsx` (new)
- `mobile/src/navigation/RootNavigator.tsx`

---

## 5. 🔲 Habit Tracker (Planned)

**Problem:** No habit tracking (daily streaks, consistency) — useful for building
healthy routines that complement the diet/exercise plan.

**Design:** Glassy dark card UI (white/black glass, same colour coding as the
rest of the app).

**Screens:**
- `HabitsDashboardScreen` — list of habits with today's checkboxes, weekly
  streak view, and a summary card at top (total streaks, completion rate).
- `AddEditHabitScreen` — name, frequency (daily/weekly), optional reminder time,
  optional linked meal type (e.g. "Take protein shake" → auto-log a quick meal).
- Each habit: `id`, `name`, `frequency`, `reminderTime`, `linkedMealId`,
  `createdAt`.
- Check-ins: `habit_logs` table (date, habit_id, completed bool).
- Glass card design: semi-transparent dark surface with subtle border, accent
  colour for the streak indicator, white text for the habit name.

**Data:**
- Local store (zustand persisted) + optional Supabase sync via `habit_logs` table.
- No new migration needed initially — store locally only.

**Files:**
- `mobile/src/modules/habits/` (new module)
- `mobile/src/modules/habits/store.ts`
- `mobile/src/modules/habits/screens/HabitsDashboardScreen.tsx`
- `mobile/src/modules/habits/screens/AddEditHabitScreen.tsx`
- `mobile/src/navigation/RootNavigator.tsx` (add to MoreStack)

---

## 6. ✅ Sidebar + MoreMenu Polish

- Sidebar trigger visible on all 4 tab home screens (not on MoreStack).
- Hydration-aware gating: no 5s delay on app launch.
- Gradient trigger pill with indigo→teal glow.
- MoreMenu sections now have staggered fade/slide entrance animation on focus.
- Redundant "Cloud Synced" / "Sync Now" tiles removed (card covers them).
- Section label renamed to "ACCOUNT" with just Sign In / Logout grid.

## 7. ✅ Sync Hardening

- `FIELD_ALIASES` extended to cover ALL enqueued entities (loans, notes, goals,
  recipes, diet_plans, fuel_fills, maintenance_logs, vehicles, meal_logs,
  weight_logs, career_events, weekly_diary).
- `ON_CONFLICT_TARGET` per-entity for vehicles (user_id+name) and user_settings
  (user_id).
- `expected_incomes.id` migrated from UUID to TEXT (migration 0032).
- `category_budgets` table repair migration (0033 — table was missing).
- Edge function `ai-meal-log` deployed with manage mode.

## 8. ✅ Sleep Tracker (v4)

- **Startup crash fix (regression from 2370e6a):** `DrawerMenu` used
  `useNavigationState` outside any navigator — throws in React Navigation v7.
  Extracted shared `navigationRef` (`src/navigation/navigationRef.ts`); DrawerMenu
  now subscribes via `navigationRef.addListener('state')` with poll fallback.
  App.tsx re-exports the shared ref.
- **Schema:** migration `0037_sleep_logs.sql` — sleep_logs (start/end timestamptz,
  quality 1–5, interruptions, source manual/auto) + RLS + realtime publication.
- **Mobile module** (`src/modules/sleep/`): Zustand store (weightStore pattern,
  offline-first via sync queue; reminderTime local-only), Dashboard with one-tap
  bed/wake session (survives app kill via AsyncStorage), manual log/edit modal
  with strict time parsing (rejects rolled-over dates like Feb 31), 7-night
  duration chart, AI insight card, bedtime reminder quick-select (10:30/11/11:30
  PM + Off), `sleep-reminders` notification channel, wired into MoreStack +
  MoreMenu + deep links.
- **Usage-access auto-detect (Digital Wellbeing-style):** native
  `SleepDetectModule` (Kotlin, UsageStatsManager — passive query on screen open,
  zero battery) + `PACKAGE_USAGE_STATS` manifest permission + guarded JS bridge
  (never throws; hides card when unavailable). Morning "Detected last night"
  card with Save/Dismiss.
- **AI:** `ai-sleep-insight` edge function (Groq gpt-oss-120b, 20/day limit,
  caller-supplied nights, no medical advice) + mobile + web UI.
- **Web mirror:** `/sleep` page (TrendLine chart, CRUD table, AI insight),
  sidebar/topbar/AppShell routes, realtime sync via existing all-tables channel.
- **Tests:** mobile 40/40 (store CRUD, duration helpers, strict date parsing,
  detect-wrapper graceful degradation, app-boot e2e); web 17/17 + build green.
---

## 9. Habit Tracker + New Home + Career Goals (v4)

- **New primary Home tab** (`src/modules/home/screens/MainHomeScreen.tsx`):
  daily quote (deterministic IST day rotation), habit progress bar + quick
  tick dots with streak badges, 2 stress-release techniques (left-nostril &
  belly breathing), 6 growth principles. Finance dashboard is now the second
  tab ("Finance"); Home is first in tab bar + drawer.
- **Sidebar fix (regression):** hamburger trigger no longer depends on
  navigation-state listener timing at cold start. Each tab dashboard renders
  its own `DrawerTrigger` (shared component) � deterministic visibility.
  DrawerMenu keeps the left-edge swipe strip; active-route tracking now maps
  MainHome/FinanceHome separately.
- **Habit Tracker module** (`src/modules/habits/`): 10 canonical habits
  (sleep 6�7h, cook meals, fruit, no junk, 3L water, sleep by 11, chia seeds,
  learn 1 topic, read 1 page, plan tomorrow), Notion-style tick boxes, daily
  completion %, 10-segment progress blocks, per-habit streaks (?? at 3+),
  monthly overview grid (day columns � habit rows) with month average and
  month navigation. Offline-first store (one row per day, deterministic ids,
  upsert on user_id+log_date) via central sync queue.
- **Schema:** migration `0038_habit_logs.sql` � habit_logs (user_id, log_date
  IST day, habits JSON, notes) UNIQUE(user_id, log_date) + RLS + realtime.
- **Career Goals screen** (`src/modules/habits/screens/CareerGoalsScreen.tsx`):
  2025?2031 roadmap timeline (net worth ?80.7K ? ?12L, equity/MF portfolio
  targets per year, Project 2029 Phase M, Project Green 2 acres, Mission
  Hometown Base) with focus-year banner.
- **9 AM morning brief notification:** next 7 days scheduled in the
  `morning-brief` channel � today's quote + habits nudge, deep-links to Home.
- **Drawer:** new entries � Habit Tracker, Sleep Tracker, Career Goals;
  Home + Finance both in the primary row.
- **Web mirror:** `/habits` (tick boxes + monthly grid) and `/career/goals`
  pages, HomePage hero (quote + habit progress + stress + principles), habit
  hooks (upsert on user_id,log_date), sidebar entries, realtime auto-covers
  habit_logs via the schema-wide channel.
- **IST day math fixed:** istDayKey/dayOfYearIST now use pure UTC+5:30 offset
  math (correct from any runtime timezone � device or CI runner).
- **Tests:** mobile 70/70 (habits utils, store toggle semantics, dailyContent
  determinism, boot e2e); web 17/17, lint/typecheck/build green.

---

## 10. Home v2 + Telos Sidebar + Apple Notes + Web Ship-List (v4)

- **Home screen v2:** sleep info card (last night + 7-night avg + nights
  count, deep-links to Sleep Tracker), AI finance commentary card
  (Groq `ai-finance-comment` edge fn � 20/day cap, caller-supplied month
  spend context incl. category breakdown, top day, biggest txn, last-month
  delta; 6h client cache + manual refresh), growth principles now an
  auto-rotating side-by-side carousel (5s, fade+slide, dot indicators),
  stress techniques side-by-side.
- **Sidebar redesign (Telos-inspired):** warm aurora gradient panel, habit
  progress ring in header (% of 10 habits today), "bricks of progress" strip
  ("build your city, one brick at a time"), SPACES/TOOLBELT/SYSTEM sections,
  per-row gradient accent bars, footer brand bar.
- **Apple-Notes-style Notes (mobile + web):** folders view (All iCloud /
  custom / Notes / Recently Deleted with counts), pinned notes float to top,
  full-screen editor with autosave on back (no Save button), live search,
  move-to-folder, Recently Deleted with Recover / Delete forever,
  long-press folder rename. Migration 0039 adds notes.folder/pinned/deleted_at.
- **Web ship-list (20 items):** custom 404, per-page meta title/description/
  OG/Twitter via SEO component + canonical, favicon set + apple-touch-icon,
  robots.txt (auth content noindex, public pages allowed), sitemap.xml,
  Open Graph image (SVG), cookie banner (no tracking cookies policy),
  privacy-safe local analytics (localStorage page-view counter), sticky
  mobile CTA (post-login hidden), Thank You page, Privacy Policy, Terms,
  Contact page (validated form + mailto, no backend endpoint), mobile
  breakpoints (sidebar hidden < lg, responsive paddings), loading states
  (Skeletons) + form error states throughout.
- **Verification:** mobile 70/70 tests, tsc clean, eslint 0 errors; web
  typecheck/lint/17 tests/build green; migrations 0038+0039 pushed;
  ai-finance-comment deployed.

---

## 11. Rework + Sidebar + Notification Dupes + Fixed Expenses 2027 + Share Sheet + Receive Flow (v4)

> **Status:** 11b–11h shipped in `e5ee575`. 11a shipped too —
> `docs/db-schema.md` 0044 entry, offers store tests, equity NaN-guard +
> loans ± adjust tests (`modules/equity/__tests__/store.test.ts`) and
> fixed-expense seed-v4 tests (`modules/finance/__tests__/seedV4.test.ts`).

### 11a. Rework the last 11 commits (2026-10-17) properly
- **PLAN.md backfill:** document the 11 shipped commits (offers module
  mobile + web mirror + `0043_offers.sql`, equity NaN-guards +
  `0044_holdings_missing_sync_count.sql`, loans ± adjust, drawer trim to
  meals/sleep/buylist/notes/offers, dinner slot 21:30→20:30) as feature-log
  entries — currently PLAN.md ends at §10 with none of them.
- **docs/db-schema.md:** add `missing_sync_count` (0044) — holdings.sync
  ops that returned "not found" get counted so silent sync drops surface
  in UI; also verify the offers table block matches 0043 exactly.
- **Missing tests:** offers module (store create/delete + FIELD_ALIASES
  sync-queue mapping + expiry reminder refresh), equity NaN guards
  (malformed price rows must not NaN the dashboard), loans ± adjust math,
  fixed-expense seed v4 (see 11d).
- **`transactions` spine check:** offers are non-spend annotations (no
  transactions write) — document that decision in ARCHITECTURE.md.

### 11b. Sidebar (drawer) redesign — direction TBD, options
- Current: Telos-style aurora panel, habit ring header, bricks strip,
  5 tool rows + Settings/Logout — **no primary tabs in the drawer at all**
  (ACTIVE_MAP exists but Home/Finance/Garage/Tasks/Wealth are missing).
- Option A (recommended): fold.money/web-Sidebar style flat nav — all
  modules in one list (Home, Finance, Garage, Tasks, Wealth, Meals, Sleep,
  Career, Diary, Buy List, Offers, Notes) + Settings/Logout footer, active
  pill, no gradient bricks. Matches the web AppShell 1:1.
- Option B: keep Telos aurora shell but add a SPACES section with the 5
  primary tabs above TOOLBELT.
- Decision needed from user before implementing.

### 11c. Notifications pop twice 5–7 min apart
- **Root-cause analysis:** system reminder fires at slot time
  (e.g. "Breakfast Time" 9:00) AND `dietNotifications.
  checkMealReminderNotifications` adds an in-app "Missed Breakfast" at
  slot+5 min (9:00→9:05, 14:15→14:20, 18:30→18:35, 20:30→20:35) — the
  5-minute offset matches the reported 5–7 min gap exactly.
- **Fixes:**
  1. Gate the missed-meal nudge behind the new meal-reminder toggle (11e)
     and push its threshold from slot+5 → slot+45 min so it can never
     feel like a duplicate pop of the scheduled reminder.
  2. `scheduleAllReminders`: add a 45s single-flight cooldown (skip if a
     run completed <45s ago) in addition to the `isScheduling` guard.
  3. Add `dedupKey` to every `scheduleLocal` call that lacks one
     (card 2d/due/overdue×4/AMC×3, fixed-expense dues, receivables,
     wallet, buy/grocery lists) so any re-run can't stack copies.
  4. Drop redundant mount-time triggers: remove `scheduleAllReminders()`
     from FinanceHomeScreen + TasksDashboardScreen mounts and
     `scheduleMealReminders()` from MealLoggerScreen focus — keep App.tsx
     boot + explicit change points (task add/edit/delete, sleep reminder
     change, meal toggle change).
  5. Unify `MEAL_SLOTS` into one shared constant (export from
     notificationService, import in dietNotifications) to end the
     keep-in-sync comment drift.

### 11d. Fixed expenses — 2027 changes (one-time seed v4, `seedFixedExpenseFixesV4`)
- Keep: Rent ₹10,400 (1st), Electricity Bill ₹500 (1st), Parag Parikh
  Flexi Cap (1st, amount unchanged).
- Change effective 2027-01-01: HDFC Mid Cap → ₹500 and HDFC Small Cap →
  ₹500 (amounts stored in paise = 50000). Implemented as an
  effective-dated boot rule: seed writes a pending rule
  (`meridian-fixed-expense-schedule-v4` in AsyncStorage with
  effective_date=2027-01-01); on every app boot, if today ≥ effective date
  and the rule is pending, set the scheduled amounts + clear flag. UI
  shows a "changes on 1 Jan 2027" hint on affected rows until applied.
- Scheduled rule (2027-01-01): HDFC Mid Cap → ₹500 (50000), HDFC Small Cap
  → ₹500 (50000), Motilal Oswal Green ₹500 → ₹1,000 (100000) —
  Motilal row is matched/created now at its current ₹500. (The planned
  "changes on 1 Jan 2027" row hint was dropped on user request — the
  schedule applies silently at boot.)
- Add: Invesco Flexi Cap SIP ₹1,000/month (100000 paise), billingDay 1,
  category Investments, added now but due reminders suppressed until
  2027-01 (lastPaidMonth pre-set to 2026-12; dueDate 2027-01-01) so it
  "starts from Jan 1st".
- Remove: Emergency Fund SIP (₹120, last-day) — delete the row now and
  enqueue the cloud delete (fixed_expenses sync).
- ORDER in FixedExpensesScreen gains 'invesco' before 'midcap'.

### 11e. Meal-logging reminder toggle inside Meal Logger
- New persisted `mealRemindersEnabled` (default ON) in the meal store
  (AsyncStorage-persisted, syncs nothing new).
- Toggle UI: switch row in MealLoggerScreen header ("Meal reminders").
- scheduleAllReminders skips all 4 meal slots when OFF; the missed-meal
  nudge (11c) is also gated by it. Toggling calls scheduleAllReminders
  once (cancel-all + reschedule without meal slots).

### 11f. Lent & Borrow — native share sheet instead of clipboard copy
- Replace `Clipboard.setStringAsync` in copyGroupDetails (LentBorrowedScreen)
  with React Native `Share.share({ message })` — the Android share sheet
  offers WhatsApp, Instagram, Telegram, etc. Keep clipboard as a silent
  fallback only if the share sheet is unavailable. Web mirror
  (LentBorrowedPage) keeps its copy button (navigator.clipboard) since the
  web has no share sheet everywhere.

### 11g. Receive flow for the Lent & Borrowed feature (default button on expansion)
- **Every lent entry card** (LentBorrowedScreen receivables) shows a
  "Receive" button when the card is expanded.
- Tap → modal: enter amount received (₹, integers in paise).
- On confirm, walk that borrower's/group's outstanding lent entries
  ascending by date: fully-covered entries get removed; the first
  partially-covered entry is reduced by the remainder; the screen then
  shows remaining entries with adjusted amounts.
- **Log:** each receive is appended to a receive log (amount, date, per-
  entry breakdown) persisted in an AsyncStorage-backed store; NOT shown
  inline — accessible via a "Log" option inside the Receive modal. The
  receive write also goes through the existing sync queue so the adjusted
  lent entries stay consistent with the cloud.
- Scope confirmed by user: applies ONLY to the Lent & Borrowed feature
  (not general expense transactions).

### 11h. Credit card pay — allow ₹0 when due is ₹0 + auto-roll due date
- Bug: when a card's remaining due is ₹0, the Pay sheet rejects entering 0
  ("invalid") so the user can never clear/confirm a paid-off bill.
- Fix: allow 0 as a valid payment amount. When the remaining due reaches 0
  (payment applied or 0 submitted on an already-clear bill), advance the
  card's billing/due date to the same day next month so the cycle keeps
  moving without a stale overdue state.

### Verification checklist
- mobile: npm run typecheck, npm run lint, npm test (new tests green),
  npm run android manual pass: drawer nav, one reminder per slot, Receive
  flow end-to-end, share sheet, toggle.
- web: typecheck/lint/test/build (LentBorrowedPage + OffersPage untouched
  behavior).
- Migration: none required (no new tables; fixed-expense changes go
  through the existing sync queue upsert/delete).

## 12. Backfill — 2026-10-17 batch (v4)

Feature-log entries for the 11 commits shipped on 2026-10-17 (PLAN.md was
quiet during that batch; recorded here chronologically).

- **8afc650 fix(sync):** serialize sync-queue `enqueue` calls and await the
  in-flight flush when a garage pull finishes — two writers can no longer
  interleave on the queue file, and the last mutation is never left
  unflushed.
- **8272751 feat(garage):** new fuel-fill form defaults the price to the
  vehicle's last fill price (still editable), removing the most common
  retype.
- **b4f707b feat(sleep):** live-ticking Bedtime home-screen widget showing
  the elapsed session; a session whose bedtime passed while the device was
  off is treated as lost so the widget never shows a runaway "hours
  asleep" value.
- **f05f4e7 fix(tasks):** completing a task cancels its due-time reminder
  instead of letting it fire for a finished task.
- **1e844a9 fix(meals):** dinner slot moved 21:30 → 20:30 and morning-brief
  re-timed to de-stagger from nearby reminders; `cancelAll` hardened so a
  partial cancel failure cannot strand duplicate reminders.
- **a3e18e4 + dac889e feat/fix(notifications):** weekly podcast reminder
  (Fridays 8 PM IST) was added and then removed after reconsideration;
  both shipped and recorded for completeness.
- **926fba7 feat(wealth):** Loans screen gains quick +/− outstanding
  adjust buttons (`adjustLoanAmount`, clamped at 0) for part-payments and
  top-ups without opening the edit form.
- **a5f2cba feat(offers):** Offers module (mobile + web mirror +
  `0043_offers.sql`) — coupon codes, merchant discounts and expiry
  reminders via the shared reminder scheduler; non-spend annotations (no
  `transactions` write — documented in ARCHITECTURE.md §3.1).
- **9c9a8b0 refactor(nav):** drawer trimmed to the five most-used tools
  (later superseded by the flat-nav drawer in §11b, `e5ee575`).
- **9a21698 fix(equity):** two-strike Kite sync reconciliation — sync ops
  that cannot find their holding twice get reconciled instead of retrying
  forever, plus NaN guards so malformed rows cannot poison the dashboard;
  new `holdings.missing_sync_count` column
  (`0044_holdings_missing_sync_count.sql`).

## 13. Compact Stats Widget (v4)

The home-screen "Report" quick-action tile (static icon + label, tap →
combined report) becomes a 2×2 auto-scrolling stats carousel.

- **Cards (7, one visible at a time):** MONTHLY SPEND (₹, pink), CC BILLS
  (₹, amber), BANK BALANCE (₹, blue), NET LENT / NET DEBIT (₹, green when
  lent, red when net borrowed), TASKS LEFT (count, purple; green ✓ at
  zero), NET WEALTH (₹, teal), MARKET TODAY (day change ₹ + % with the
  portfolio's net value below it — green for a gain, red for a loss; the
  change % uses the same formula as the Wealth dashboard's day-change
  card: change ÷ (value − change)).
- **Auto-scroll:** the cards live in a `ViewFlipper`
  (`android:flipInterval="3000"`, `android:autoStart="true"`,
  `android:inAnimation="@anim/widget_fade_in"` /
  `android:outAnimation="@anim/widget_fade_out"`) — the launcher flips and
  fades them every 3 seconds with no timers and no battery cost, and it
  keeps running while the app is closed. `ViewFlipper` is a
  RemoteViews-supported layout, so this stays inside the widget sandbox.
  - Framework detail: AOSP `ViewFlipper` only calls `startFlipping()` from
    `onAttachedToWindow()` when `mAutoStart` is true — `flipInterval` alone
    never starts the rotation, so `android:autoStart="true"` is required.
  - The public XML attributes are `android:inAnimation` /
    `android:outAnimation` (the older `android:animation` /
    `android:animationOut` names are not public API and fail AAPT
    resource linking).
- **Tap targets:** every card has its own PendingIntent → deep link:
  `meridian://monthly-spend`, `meridian://credit-cards`,
  `meridian://bank-accounts`, `meridian://lent-borrowed`,
  `meridian://tasks`, `meridian://wealth` (all handled in App.tsx →
  FinanceTab / TasksTab / InvestmentsTab).
- **Data flow:** JS `services/statsWidget.ts` — `computeWidgetStats`
  (pure, tested) reads the finance/tasks/equity/garage stores: monthly
  spend uses **the exact rule of the in-app Monthly Spend screen**
  (transactions of type `expense`/`vehicle_service` in the current month,
  minus fixed expenses and the Rent/SIP/Investments/Housing/Wallet-Load
  categories, plus this month's garage fuel fills); cc bills = **Σ card
  balance** — the same rule as the Credit Cards screen per-card due, the
  Balance Summary card-outstanding total, the net-worth formula and the
  web Credit Cards page (`balance ?? current_outstanding`). The gross
  statement (`billAmount`) is deliberately not used because it ignores
  payments already made against the bill; bank balance = Σ accounts; net
  lent = Σ outstanding lent − Σ outstanding borrowed; tasks = open tasks
  due today or overdue; net worth = holdings + FDs − loans; market today =
  `getTodayPnL()` (holdings × (price − prev close)) with the portfolio
  value from `getPortfolioValue()`. Snapshot JSON
  → `NativeModules.StatsWidgetBridge.setStats` → SharedPreferences
  (`meridian_stats_widget`) → native redraw (same pattern as the Bedtime
  widget).
- **Refresh:** App.tsx boot (plus a 2.5s retry, because the persisted
  stores hydrate asynchronously), after every foreground sync, and when the
  app goes to the background. Missing rows degrade to `—` — never blocks
  on app state.
- **Native:** `widgets/StatsWidget.kt` (parses JSON with org.json,
  formats ₹ as `₹845`/`₹1.2k`; net lent flips label NET LENT → NET DEBIT
  and colour; tasks 0 → green "✓"; placeholders `—` when data is
  missing), `StatsWidgetBridgeModule`, `StatsWidgetPackage` registered in
  MainApplication; the old `CombinedReportWidget` class and its provider
  xml are removed (manifest receiver → `.widgets.StatsWidget`).
- **Refresh:** App.tsx boot + after every foreground sync completes.
  Missing rows degrade to `—` — never blocks on app state.
- **Tests:** `services/__tests__/statsWidget.test.ts` (9) — monthly
  outflow-only spend, malformed-row resilience, card bill fallback,
  account sums, lent/borrowed netting (incl. negative net), IST task
  filter, non-finite net worth.

## 14. Asset Allocation consistency + repo cleanup (v4)

- **Bug:** the Wealth tab's ASSET ALLOCATION donut built its legend from
  *every* holding, so a leftover row (sold out, zero quantity, malformed
  numbers) still produced a phantom slice — "Gold" / "Equity" categories
  the user does not actually hold. The web dashboard already filtered
  `value > 0`, so mobile and web disagreed (the inconsistency).
- **Fix:** one shared rule, now in `modules/equity/store.ts`:
  - `allocationCategoryOf(holding)` — an explicit category wins (trimmed
    and validated against `ALLOCATION_CATEGORIES`), otherwise the holding
    type decides (mf → Mutual Funds, etf → ETF, equity → Equity, other →
    Other). Unknown category strings are ignored instead of creating a
    bogus bucket.
  - `holdingValueOf(holding)` — value guarded against non-finite numbers.
  - `allocationBuckets(holdings)` — only holdings worth something are
    bucketed, so nothing empty can ever show up as a slice.
  - The dashboard donut, the list tabs (Equity / Mutual Funds) and the
    Portfolio Breakdown drill-down all read from these helpers, so the
    donut and the lists can never disagree. The web app mirrors the same
    rule (`allocCategoryOf` + `value > 0` filter) — one behaviour on both
    platforms.
- **Tests:** `modules/equity/__tests__/store.test.ts` — category
  fallbacks, explicit/trimmed/unknown categories, zero-value rows skipped,
  bucketing + percentages.
- **Repo cleanup:**
  - Removed 3 dead files with zero references: `shared/components/SoftScrollView.tsx`,
    `shared/components/SyncPulse.tsx`, `shared/hooks/useSpeechToText.ts`.
  - Removed the now-unused `CombinedReportWidget` (replaced by StatsWidget)
    and its provider xml.
  - Cleared 62 lint warnings across 28 files (unused imports, unused
    locals/args, empty catch blocks). CI lints the whole tree with
    `--max-warnings 80`; the repo now reports 12 warnings (all
    intentional `console` diagnostics) instead of 74.

## 22. Day change for mutual funds (v4)

The day's gain only covered equity — mutual funds never contributed because
they had no `prev_close`.

- **Root cause:** `refresh-portfolio-prices` only priced a fund when
  `holdings.scheme_code` was set. Every fund that stores its **ISIN** in
  `symbol` (with no scheme code) fell through to the Yahoo equity feed, which
  has no quote for a fund → the holding was never refreshed and never got a
  `prev_close`. Live check: 5 of 6 holdings failed, only the equity one
  updated.
- **Fix:** the edge function now resolves a fund's AMFI scheme code from the
  scheme code, the scheme name (search) **or the ISIN** — the ISIN is looked
  up in the official AMFI NAV list (`amfiindia.com/spages/NAVAll.txt`, both the
  payout and the reinvestment ISIN columns). The NAV history then comes from
  mfapi.in, where the previous entry is the previous trading day's NAV — the
  day change of a fund is NAV to NAV. The response now also reports the price
  and prev_close per holding.
- **Result (verified live):** 6/6 holdings refresh, every holding carries a
  prev_close, so the day change covers equity **and** mutual funds.
- **UI:** the Wealth dashboard's "DAY CHANGE" now shows the split
  (`Equity ±₹… · MF ±₹…`) on mobile and web — stocks and funds price on
  different clocks, so one opaque number hid the difference.
- **Tests:** `modules/equity/__tests__/store.test.ts` — the day P&L split into
  equity / mutual funds / other, and the guards for holdings without a usable
  prev_close.

## 21. Clock + Sleep home-screen widget (2x2) (v4)

A 2x2 home-screen widget that mirrors the reference design: the date
("Saturday 17"), a live clock with seconds ("09:34 53"), the last night of
sleep inside a neon-green pill and a weather line.

- **Layout:** `res/layout/widget_clock_sleep.xml` — the clock parts are
  `TextClock` views, so the widget keeps itself up to date (the seconds tick
  every second) without any periodic work. The sleep pill
  (`drawable/widget_sleep_pill.xml`) is a layer-list: a rounded body plus the
  raised "island" on the right that carries the duration ("8H 42M"). Inside it
  a dotted timeline (`widget_sleep_dots.xml`) carries the two REM windows
  (`widget_sleep_rem_bar.xml`).
- **Native:** `widgets/ClockSleepWidget.kt` (provider) +
  `ClockSleepWidgetBridgeModule.kt` / `ClockSleepWidgetPackage.kt` (JS bridge).
  The REM segments are positioned by padding a full-width progress bar, so the
  segment lands exactly on the timeline on every launcher.
- **Data:** `services/sleepWidget.ts` pushes the last night (duration, bedtime,
  wake time and the two REM windows derived from the sleep cycle) to the
  widget; the widget refreshes whenever a sleep entry is logged and on app
  foreground. The weather line is a static "19 °C" placeholder until a weather
  API is wired into the same payload.
- **Tests:** `modules/sleep/__tests__/sleepWidget.test.ts` (5) — the latest
  night is picked, the duration and both REM windows are derived correctly.

## 20. Automatic sleep tracker (accelerometer + smart alarm) (v4)

Sleep tracking that works like the "Automatic Sleep Tracker" Android apps:
the phone itself is the sensor, so **no watch is needed**. It sits *alongside*
the existing manual one-tap session and the usage-stats auto-detect.

- **Native service** (`mobile/android/.../sleep/`):
  - `SleepMotionService` — a foreground service (`specialUse` type) that
    samples the accelerometer every 5 s, all night (screen off, app closed) and
    stores one bucket per minute with the peak movement. Movement = the
    distance from 1 g plus any orientation change (picking the phone up or
    turning it over).
  - `SleepMotionStore` — SharedPreferences persistence of the config, the
    timeline (36 h retention) and the alarm state, so the tracker survives
    app kills and reboots (`SleepMotionBootReceiver`).
  - `SleepMotionConfig` — settings (sensitivity, night window, wake window,
    alarm mode, snooze). The movement thresholds are mirrored in TypeScript so
    JS and native always agree.
  - `SleepMotionModule` / `SleepMotionPackage` — the RN bridge
    (start / stop / setConfig / getStatus / getBuckets / clearBuckets /
    stopAlarm), registered in `MainApplication`.
- **Inference (TypeScript, unit tested)** —
  `modules/sleep/sleepInference.ts`: `inferSleepSession()` turns the timeline
  into a sleep session — still stretches separated by a short awake gap stay in
  one block, the block is clipped to the night window, the bedtime is the
  moment the phone was put down and the wake time the moment it was picked up
  (end of the main sleep stretch), plus the night wake-ups and a confidence
  score.
- **Smart alarm** — inside the wake window the alarm rings on the first sign of
  movement (light sleep) or at an exact time, with **Stop** and
  **Snooze N min** buttons on the notification, alarm-volume audio and
  vibration.
- **UI** (Sleep Tracker screen): "Automatic tracking" card with the on/off
  switch, live status (tracking / still for Xh Ym), sensitivity, night window
  and smart-alarm settings (time pickers), plus a "Detected automatically"
  card with Save / Dismiss. Detected sessions are saved automatically
  (toggle) as `source = 'auto-motion'`.
- **Tests:** `modules/sleep/__tests__/sleepInference.test.ts` (11) — thresholds,
  midnight-wrapping windows, a normal night, night wake-ups, sensitivity
  behaviour, the wake time at the end of the main stretch, stillness streaks.
- **Permissions:** `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE`.

## 19. Pill Reminder with Skip / Remind-in-30-min actions (v4, not yet pushed)

A medication (pill) reminder module, opened from the More menu, whose
notification panel carries two action buttons — the way MyTherapy does it.

- **Data:** new `medications` table (migration `0048_medications.sql`:
  name, dosage, `times` JSONB of daily "HH:MM" doses, notes, active) with
  RLS + realtime. Mobile store `modules/medications/store.ts`
  (AsyncStorage-persisted, every write pushed through the sync queue) and
  `useMedicationsSync` for the cloud pull/push.
- **Screen:** More menu → **Pill Reminder** (`PillReminderScreen`): list of
  medicines with dose-time pills, pause/resume, edit, delete, "Sync from
  cloud"; add/edit modal with name, dosage, times ("08:00, 20:00") and
  notes.
- **Reminders:** `services/medicationReminders.ts` schedules one local
  notification per dose for the next 2 days (re-armed on boot and whenever a
  medicine changes). Skipped doses are not scheduled again that day
  (`skipDose`, day-scoped keys).
- **Notification actions:** a notification category `medication-reminder`
  with two buttons — **⏭ Skip** (marks the dose skipped for the day) and
  **⏰ Remind in 30 min** (re-schedules the same dose 30 minutes later).
  The category is registered in `notificationService.setupChannels`, the
  buttons work both in the foreground (`setupNotificationHandler` now
  forwards the action identifier + notification id) and with the app closed
  (background task `meridian-medication-action` registered through
  `Notifications.registerTaskAsync`).
- **Tests:** `modules/medications/__tests__/medications.test.ts` (17) —
  dose-time parsing/validation, next-occurrence maths, skip bookkeeping,
  scheduling rules (active only, skipped doses skipped, category attached)
  and both action handlers.

## 18. Credit card reward points (v4, not yet pushed)

Reward points per card, with the ₹ value derived from the card's reward
program.

- **Rules** (`modules/finance/cardRewards.ts`, mirrored in
  `web/src/lib/cardRewards.ts`): IDFC (FIRST) style cards are **4 points =
  ₹1**; **cashback cards are direct cashback (1 pt = ₹1)**; every other
  card defaults to 1 pt = ₹1. The rule is matched on the card name/bank.
- **Data:** new `credit_cards.points` column (migration
  `0047_credit_card_points.sql`, applied to the hosted project) + a
  `points` field on the mobile `CreditCard` type, the web `CreditCard`
  type, and the sync payload/pull mapping.
- **Mobile:** every card in the Credit Cards list shows its points and the
  reward value (`12,400 pts · ₹3,100 rewards`; cashback cards show
  `· ₹8,200 cashback`). The card detail screen has a **Reward Points**
  block (points, reward value, rate) with a pencil editor to set the
  points collected.
- **Web:** the card grid shows the points + reward value; the card detail
  page has a "Reward points" stat; the add/edit forms have a "Reward
  points" field with the live rate hint.
- **Tests:** `modules/finance/__tests__/cardRewards.test.ts` (8) — rule
  matching (IDFC / cashback / default / by bank), point valuation, invalid
  input handling, rounding.

## 17. Wallets section (Balance Summary) (v4)

- **New entity `wallets`** (migration `0046_wallets.sql`): `id`, `user_id`,
  `name`, `amount` (paise) + RLS ("User owns wallets") and realtime
  publication, so mobile and web mirror each other instantly.
- **Store:** finance store gains `wallets`, `seedWallets()` (idempotent),
  `setWalletAmount()` (never negative / non-finite) and `deleteWallet()`;
  edits go through the central sync queue (`wallets` entity) and the cloud
  pull merges them like every other entity.
- **Wallets live inside the Bank Balances section** — not as a separate
  section or card. The wallet rows are appended under the bank account
  rows in the same section (mobile: Balance Summary → "Bank Balances",
  which now opens expanded by default; web: the "Bank balances" card).
  Wallet balances are cash, so they count towards the section total and
  the net worth (no minimum-balance rule applies to them).
  Wallet balance is never shown as a standalone card (not on the home
  screen and not on the stats widget).
- **Standard providers** seeded on first open (stable ids so balances
  follow the row across devices): Amazon Pay, PhonePe, Zepto, Blinkit,
  BigBasket — editable in `WALLET_PROVIDERS` (mobile
  `modules/finance/store.ts`, web `hooks/data/useWallets.ts`). Rows for
  providers that leave the catalog (PayPal, Airtel Thanks) are pruned
  automatically, locally and in the cloud (`RETIRED_WALLET_IDS`).
- **Migration note:** the `wallets` table uses `gen_random_uuid()::TEXT`
  (not `uuid_generate_v4()` — the uuid-ossp extension is not enabled on
  the hosted project) and adds the table to the realtime publication in a
  best-effort block so a publication error can never block the migration.
- **Tests:** `modules/finance/__tests__/wallets.test.ts` (5) — seeding is
  idempotent, balances update in paise, negative/NaN amounts are rejected,
  deletion, and the provider list.

## 16. Notification hygiene: service spam + market-sync watchdog + MF SIP naming (v4)

- **Vehicle service reminder was spamming.** The trigger was a rolling
  "now + 60 min" with a constant dedup key (`service_<vehicle>`), so every
  app open re-armed it and a due service could notify every hour (and a
  delivered notification is no longer in the scheduled list, so the dedup
  scan could not stop it either). It now fires **once per day per vehicle**
  at 9:00 AM (today if still ahead, otherwise tomorrow) with a day-keyed
  dedup (`service_<vehicle>_<YYYY-MM-DD>`).
- **Market-sync watchdog** (`services/marketSyncWatchdog.ts`) — one
  notification per day when the market data has not synced since the
  previous trading day:
  - **Never on Saturday or Sunday** (market holidays).
  - **At most one notification per calendar day** — day-keyed dedup key plus
    a persisted "already notified" marker, so repeated app opens never
    stack copies.
  - Kite freshness uses `holdings.last_synced_at` (set by
    `kite-holdings-sync`); MF/ETF NAV freshness uses `holdings.updated_at`
    (set by `refresh-portfolio-prices`). A holding counts as fresh when it
    was synced on or after the **previous trading day** — mutual fund NAV
    for a day is published the next morning, so "today's NAV missing" is
    normal and never triggers the warning.
  - Runs on app boot and on every foreground; tapping the notification
    opens the Wealth dashboard (new `InvestmentsDashboard` tap target).
  - Holdings rows now carry `lastSyncedAt` / `updatedAt` in the mobile
    store (mapped in `useEquitySync`).
- **Mutual funds are SIPs due on the 1st**:
  - `holdingDisplayName()` appends " (SIP)" to mutual fund names in the
    holdings list, dashboard preview and portfolio breakdown (mirrored in
    the web app's holdings list).
  - `MF_SIP_DAY = 1` — the SIP day defaults to the 1st for every MF row
    (mobile pull mapping + web holding form), and migration
    `0045_mf_sip_day.sql` backfills existing MF rows to `sip_day = 1`.
- **Tests:** `services/__tests__/marketSyncWatchdog.test.ts` (11) — weekend
  skip, previous-trading-day maths, Kite/MF freshness rules, one
  notification per day; `modules/equity/__tests__/store.test.ts` — the
  " (SIP)" name rule.

## 15. Widget CC BILLS + snapshot date order (v4)
- **CC BILLS (widget):** the widget summed the gross statement
  (`billAmount`, ignoring `paidAmount`) and preferred a stale
  `currentOutstanding`, so the number did not match anything in the app.
  It now uses the app's single rule — **Σ card balance** (Credit Cards
  screen per-card due, Balance Summary card outstanding, net worth, web
  Credit Cards page). Three new tests cover balance priority, the
  partly-paid bill case and the `balance`-missing fallback.
- **Snapshot dates order:** Portfolio History's "SNAPSHOT DATES" list was
  built from the chart array (chronological, oldest first) while "View All"
  (SnapshotDates) listed newest first. The list now shows the newest dates
  first — same order as the full list — while the chart itself stays
  chronological and tapping a row still highlights the right chart point
  (the list rows carry the original chart index).

## 29. Quiet sleep tracking + compact widgets (v4)

- **The "Tracking your sleep" notification is no longer a shade notification.**
  Android requires a foreground service to show one, so it stays — but the
  channel is at the lowest importance (silent, no badge), the notification is
  not ongoing (it can be swiped away and does not come back until the service
  restarts) and it has no timestamp. The user-facing feedback is now a
  **brief heads-up banner in the notch area** ("Sleep tracking on") that
  removes itself after 10 s — the same treatment as the detected-night banner.
- **The green sleep bar fits the 2x2 cell now.** The pill was 46dp tall with a
  78dp "island" — wider than the widget. It is now 26dp tall with a 54dp
  island, the clock is 25sp, the paddings are 8dp and the REM time labels
  (which did not fit) are gone — the REM windows stay on the timeline. The
  sleep-only widget got the same treatment.
- **The night window is 21:30 → 09:30** (it was 21:00 → 12:00) in both the TS
  and the native config. Installs that still carry the old default are
  migrated by the sleep store (`meridian-sleep-storage` v2) — a window the user
  never changed themselves.

## 28. Card bill payments + cloud sync hardening (v4)

- **The web "Pay bill" left the bill standing.** It only wrote `paid_amount`
  and `current_outstanding`, so the card kept its old (past) `due_date` and its
  old `bill_amount` — the mobile app pulled that state and kept showing the
  bill as due. It now clears the card the same way the mobile app does: the
  due date rolls to the next billing day and the bill amount, the paid amount
  and the balance go back to zero. The bill payment transaction is written
  with the same shape as on mobile (`linked_card_id`, "Credit Card Bill").
- **A billing day of 31 skipped a month** — `new Date(year, month, 31)` rolls
  over to the 3rd of March. The roll is now clamped to the last day of the
  month (31 Jan → 28 Feb) in both apps (`nextCardDueDate`).
- **An UPDATE that matches no row is now an error.** PostgREST reports no
  error when an update hits 0 rows, so a payment for a card the cloud did not
  know yet was silently dropped and the next pull restored the old state. The
  sync queue now falls back to an upsert when the update hit 0 rows (the card
  writes carry the full row, so the upsert has every NOT NULL column).
- **The persist-key bump no longer wipes local data.** The finance store moved
  to `meridian-finance-storage-v15` for the `wallets` rows, but the storage
  falls back to the previous key and the migration carries the state forward —
  an app update must never throw away a local edit that has not been pushed
  yet.
- **Tests:** `services/__tests__/syncQueueCloud.test.ts` (3) — the upsert
  fallback, the normal update path and a failing write staying queued;
  `modules/finance/__tests__/cardBill.test.ts` (6) and
  `web/src/lib/__tests__/cardBill.test.ts` (5) — the due-date roll.

## 23. Sleep-only 2x2 widget + the 9:00 AM refresh (v4)

- **One sleep widget, 2x2:** the four quick-action widgets (Add Expense, Add
  Fuel, Add Task, Bedtime) are removed — the last night of sleep is what the
  home screen should carry. Every widget in the app is 2x2 now (Stats, Clock &
  Sleep, Sleep).
- **New widget** (`widgets/SleepStatsWidget.kt` +
  `res/layout/widget_sleep_stats.xml`): the compact last night — the duration,
  the bedtime → wake time, the wake-ups and the 5-star rating, with the two
  REM windows marked on the dotted timeline inside the green pill.
- **Daily refresh at 9:00 AM** (`SleepWidgetScheduler` +
  `SleepWidgetAlarmReceiver`): an inexact repeating alarm redraws the sleep
  widgets every morning (the alarm is re-armed on boot and whenever the widget
  is drawn). The data itself is pushed from JS (`services/sleepWidget.ts` →
  both widget bridges).
- **Clock & Sleep hardened:** the provider never crashes the launcher any more
  (a failed render falls back to a plain clock), and the risky
  `previewLayout` / `updatePeriodMillis` attributes are gone.
- **The real cause of "An error occurred when loading widget":** Android only
  allows the view classes annotated with `@RemoteViews.RemoteView` inside a
  widget layout — a plain `<View>` is **not** one of them, so the launcher
  refused to inflate both sleep widgets. The spacers and the timeline are
  `TextView`s now (the Stats widget never used a plain `<View>` and always
  worked).

## 24. Pillow-friendly sleep detection + the interruption rules (v4)

- **Sustained movement:** the native tracker now records, next to the peak
  movement of the minute, the number of **seconds of sustained movement**
  (`MotionBucket.movingSeconds`). A minute only counts as awake when the
  movement was sustained (20 s on medium sensitivity, 30 s on low, 12 s on
  high) — a bump of the mattress under a pillow is no longer a wake-up.
  **Medium sensitivity is the right setting for a phone under a pillow.**
- **The wake time** now follows the wake window: a movement inside the wake
  window is the wake-up, an earlier movement is a short interruption and the
  night goes on (it then lasts until the end of the wake window).
- **Interruption rules:** a gap of up to **5 minutes** is a normal interruption
  (a quick phone check counts), a gap of **5–10 minutes** is ambiguous — in
  the morning the app asks "was that a long interruption, or did your sleep
  end there?" and, for a long interruption, asks how long the user was up and
  takes that time out of the sleep. A gap of **more than 10 minutes** ends the
  night right there.
- **Tests:** `modules/sleep/__tests__/sleepInference.test.ts` (25) — the pillow
  rules, the interruption classification, the pending-gap question and both
  answers.

## 25. Sleep screen v3 (v4)

- The order is now: **LAST NIGHT** (hero) → the detected night → the
  automatic tracking card → **Going to bed** → the chart / insight / settings →
  the compact history. The line "Uses the motion sensor — no watch needed" is
  gone.
- **Compact history** (the last 5 nights, one line each) with a **View all (n)**
  button that opens the new **All Sleep Logs** page (`SleepHistoryScreen`) with
  the summary (nights, average, total), every log and the edit modal.
- **"Log last night"** — the habit-style one-tap action for the previous night
  only: the length comes from the user's own 7-night average (7 hours without
  history) and the wake time is 7:00 AM.
- **Rate your sleep out of 5** — a star row under the last night (saved on the
  entry, also shown on the sleep widget).

## 26. Wallets in their own section (v4)

- The Balance Summary now has a **Wallets** section next to the Bank Balances
  (mobile + web) and the Bank Accounts screen shows the wallets in the same
  section as the accounts (mobile + web). The wallet rows are tappable and use
  the shared `WalletBalanceEditor` (mobile).
- Wallet balances are cash: they count towards the liquid balance **and** the
  net worth (`getTotalBalance()` = accounts + wallets), and the hero card
  splits the chips into **Banks** and **Wallets**.

## 27. Drawer cleanup + auto-detect removal (v4)

- The drawer no longer repeats Habits / Finance / Garage / Tasks / Wealth —
  they are in the bottom tab bar.
- The usage-access auto-detect ("Enable morning auto-detect") is removed
  together with its native module (`SleepDetectModule`), the
  `PACKAGE_USAGE_STATS` permission and the JS bridge — the accelerometer
  tracker does the job now.



## 31. Keep in touch (people) — weekly / monthly / 45 days / custom (v4)

A list of the people you want to stay in touch with, each with their own
cadence, and ONE daily digest notification (not one notification per person).

- **Cadences** (`modules/people/peopleCadence.ts`, pure + unit tested):
  `weekly` (+7 days) · `monthly` (+1 **calendar** month, clamped to the month
  end — 31 Jan → 28/29 Feb, never 3 March) · `days_45` (+45 days) · `custom`
  (+N days). The next due date is the last contact + the interval; **a person
  who was never contacted becomes due after one full interval** (the list never
  starts with a wall of overdue names).
- **Data:** migration `0049_people.sql` → `people(id, user_id, name, phone,
  email, notes, cadence, interval_days, last_contacted_at, next_due_at,
  sort_order, …)` + RLS + realtime.
- **Module:** `modules/people/` — the cadence maths, the Zustand store
  (`meridian-people-storage-v1`, every write through the sync queue), the cloud
  pull (`usePeopleSync`, the pending-edit protection) and `PeopleScreen`
  (Due now / Coming up / Later, "Mark contacted", add + edit).
- **Reminder:** ONE notification at **10:00 AM IST** listing everyone who is due
  that day (`schedulePeopleDigest()` in the notification service, the
  `people_digest` channel, a day-scoped dedup key). It is re-armed whenever the
  list changes and by `scheduleAllReminders()` on every app open. Tapping it
  opens the list through the `meridian://people` deep link.
- **Entry points:** the More menu and the drawer (no web page, no home card).
- **Tests:** `peopleCadence.test.ts` (13) + `peopleStore.test.ts` (6).

## 30. Weather — GPS + Open-Meteo (v4)

The live weather for your location. Open-Meteo is free, needs **no API key and
no account**, and the coordinates are rounded to ~1 km before they leave the
phone.

- **Location:** `expo-location` (the permission plugin in `app.json` →
  `ACCESS_COARSE/FINE_LOCATION`), `Balanced` accuracy.
- **Service** (`services/weather.ts`): GPS → `api.open-meteo.com/v1/forecast`
  → the current temperature, feels-like, humidity, the WMO condition, the daily
  low/high and the rain chance. Cached for an hour; the fallback chain is
  *fresh GPS → the cached reading (up to a day) → a manually picked city
  (Open-Meteo geocoding) → nothing*.
- **Surfaces:** the **top-right of the Clock & Sleep widget** (the icon + the
  temperature, with the condition under the clock) and a **home-screen card**.
- **Tests:** `services/__tests__/weather.test.ts` (3) — the WMO code mapping.

## 29. OxygenOS widget restyle (v4)

The two sleep widgets now use the OnePlus palette: a black canvas, white type
and the OnePlus red `#EB0028` as the single accent (the sleep pill, the rating
stars, the weather icon). **The animated Stats carousel is untouched** — its
rainbow values and its own shell stay as they are.

- `values/widget_colors.xml` — the palette
- `widget_clock_sleep_bg` (the black shell), `widget_sleep_pill` (red),
  `widget_cloud` (red) + the new `widget_sun` / `widget_rain`
- `widget_clock_sleep.xml` — the **weather moved to the top row**, next to the
  date; `widget_sleep_stats.xml` — the rating stars turn red

## 28. HP Pay + the fuel payment mode (v4)

- **HP Pay** is a standard wallet next to Amazon Pay / PhonePe / Zepto /
  Blinkit / BigBasket (mobile + web).
- The **fuel form asks how the fill was paid** (Cash / UPI / Card / HP Pay).
  A fill paid from HP Pay **moves the wallet balance** — and an edit or a
  delete moves it back.
- **The fuel edit inconsistency is fixed:** a fuel fill and its
  `fuel_purchase` transaction are two views of the same purchase, so they are
  linked by the new `transactions.linked_fuel_fill_id` column (the old
  date+amount match broke as soon as one of them was edited). The sync now
  runs **both ways**: editing the transaction moves the fill (and the price per
  liter is recomputed from the liters), deleting one deletes the other — the
  mileage and the spend can never disagree.
- Migration `0050_fuel_payment_mode.sql` (`fuel_fills.payment_mode` +
  `transactions.linked_fuel_fill_id`).


## 32. Night-only sleep tracking + the widget/layout fixes (v4)

The device feedback from batch 3, fixed.

### The sleep tracker is NIGHT ONLY

The tracker used to run (and show its "Sleep tracking" notification) all day.
Now it only runs **inside the night window** — 21:30 → 09:30 by default, and
the window itself is editable on the sleep screen.

- **`SleepMotionScheduler.kt`** (new) — the window maths
  (`isInNightWindow`, `nextWindowStart`) and the **exact alarm** that opens the
  window. The alarm survives Doze (`setExactAndAllowWhileIdle`) and falls back
  to an inexact alarm if Android revokes the exact-alarm permission.
- **`SleepMotionService`** — the gate: outside the window the service stops
  itself, removes the notification and arms the next night. Inside the window
  it samples the accelerometer; when the window closes it stops and re-arms.
- **`SleepMotionModule.start()`** — during the day the service is **never
  started** (so there is no notification at all); the alarm is armed instead.
  `stop()` cancels the alarm.
- **`SleepMotionBootReceiver`** — after a reboot during the day it arms the
  alarm instead of starting the tracker.
- **`SleepMotionAlarmReceiver`** — the new `ACTION_START` starts the tracker
  when the window opens (and re-arms it if the window moved).
- **`App.tsx`** — the app re-arms the tracker on every open (during the day it
  just schedules tonight, inside the window it (re)starts it).
- The **notch banner** ("😴 Sleep tracking on") is the user-facing feedback and
  it now only appears when the tracking actually starts — at 21:30. The
  foreground-service notification is silent (`IMPORTANCE_MIN`) and hidden on
  the lock screen (`VISIBILITY_SECRET`).
- The sleep screen shows **"Starts 9:30 PM"** during the day.

### The location is instant

`expo-location` was taking **3+ minutes** (a fresh GPS fix indoors). The new
order in `services/weather.ts`:

1. the **last known position** (instant, no GPS lock),
2. a fresh fix, but **never longer than 10 s**,
3. the position **cached 30 minutes ago**,

plus an 8 s timeout on the network call. The permission is only requested when
it has not been granted yet. The widget is painted with the cached weather
**immediately** and refreshed in the background (`services/sleepWidget.ts`), so
a slow GPS can never hold the widget (or the app) up.

### The widgets

- The **red sleep bar fills the widget** — the pill is `layout_weight="1"`, so
  it grows into the free space; there is no empty gap below it. The island is
  bigger (68×23dp) and the duration is 12sp.
- **Nothing overlaps** — the two REM bars and the dotted timeline are stacked
  (REM 1 → REM 2 → dots) instead of sharing one anchor point.
- The **date carries the month** ("Thu 12 Nov") and the clock uses the OnePlus
  (system) font at medium weight with tight letter spacing.
- **All the widgets are a fixed 2×2** (`targetCellWidth/Height="2"`,
  `resizeMode="none"`) — they can no longer be resized into another shape.
- The **Stats widget follows the OxygenOS palette** too (the black shell, white
  values, muted labels, the OnePlus red for the negative numbers) — **the
  carousel animation is untouched**.

### Tests

`mobile/src/modules/sleep/__tests__/sleepMotion.test.ts` (8) — the night
window maths. Total: 242 unit tests (27 suites) + 9 e2e.


## 33. The weather refresh, the sleep de-dup and the widget polish (v4)

The second round of device feedback.

### The weather refreshes

The weather was frozen: `pushSleepWidget()` only ran when a sleep entry
changed and the cached reading was reused for an hour.

- `services/weather.ts` — the reading is now reused for **3 hours**
  (`FRESH_MS`).
- `App.tsx` — a new `refreshWeather()` runs **every time the app is opened**
  and **every time it comes back to the foreground**: it fetches the reading
  (only when it is stale) and repaints the widget.
- The home-screen weather card refreshes on **focus**, not only on mount.
- The GPS itself was already made instant in §32 (last known position first,
  a 10 s timeout, the position cached for 30 minutes).

### One night = one sleep record

The same night ended up in the log two or three times (the motion tracker
detects it, the user logs it by hand, the quick log adds it).

- **`modules/sleep/sleepNights.ts`** — `isSameNight(a, b)`: the two sessions
  are the same night when their ranges **overlap** or when they start less
  than **60 minutes** apart. A nap in the afternoon and the night that follows
  stay separate, and a night that was genuinely split by a long wake-up also
  stays two records.
- **`sleep/store.ts`** — `addEntry` uses it (the second record for a night is
  **skipped**), and the store drops the duplicates that are already on the
  device when it hydrates.
- **`personal/hooks/usePersonalSync.ts`** — the cloud pull skips a row that
  belongs to a night we already have (it used to compare the row id only).
- **`web/src/lib/sleepNights.ts`** — the same helper for the web; saving a
  night that is already logged updates it instead of adding a copy.
- **Migration `0051_sleep_dedup.sql`** — deletes the rows in the cloud that
  overlap by at least 30 minutes or that start less than 60 minutes apart.

### The delete confirmation

The dashboard's edit modal deleted a night straight away. It now asks
("Delete this sleep record?"). The history screen and the web already asked.

### The widgets

- **Clock + Sleep** — the typography is justified: the date and the time are
  flush **left**, the weather and the battery flush **right**, and the seconds
  sit on the **time's baseline**. One font family (`sans-serif-medium`) for
  every number, the small labels in the muted grey.
- **The battery** — the Android 12+ pill shape (`widget_battery.xml`): a grey
  outline with the terminal nub and the **OnePlus red fill showing the real
  level**. It is a `ProgressBar` drawable (the same trick the REM timeline
  uses) and the percentage sits next to it. The level is read with
  `BatteryManager.getIntProperty(BATTERY_PROPERTY_CAPACITY)` — no permission.
- **The wake-ups** — a small **rotated (−90°)** label (`2 WAKES`) stands in
  the top left of the red bar, directly above the REM timeline. It is hidden
  when there were no wake-ups. The rotation is set in the layout *and* from
  the code, so it works on every launcher.
- The red bar still **fills all the free space** (the clock shrank to 22 sp
  and the weather condition moved out of the widget to make room).
- **Stats** — the seven card labels are now the OnePlus **red `#EB0028`**, the
  values stay **white**, and the carousel animation is untouched.

### Tests

`mobile/src/modules/sleep/__tests__/sleepNights.test.ts` (9). Total: 252 unit
tests (28 suites) + 9 e2e.

### The stats carousel + AM/PM caps (2026-11-13)

- **Stats widget** — the 5-screen carousel (CARD BILLS, BANK BALANCE, LENT,
  MY WEALTH, TASKS) with compact-money rows, colour-coded split-bar
  percentages and today's change in green; the page dots mark the active
  screen.
- **AM/PM in caps** in the clock and the sleep widget's alarm / bed / wake
  labels.
- **No overlap** — 11 sp rows at 8 dp padding, the stats columns rebalanced
  (alarm 1.4, battery and temperature 0.8).
- **Track width fixed** — `TRACK_INSET_DP` 30 → 44 in ClockSleepWidget and
  the split bar now measures its real pixel width.
- Total: 285 unit tests (31 suites) + 9 e2e. Pushed as `42ba114` (CI run
  #101 in progress).

## 34. The Meridian v2 UI reskin (s1–s32) + launch loading screen (v4, 2026-11-14)

The whole app restyled to the flat Meridian v2 reference — visuals only, no
data, state or navigation changes. Colour by meaning (red attention, amber
near-limit, mint good/gain, sky bank money, violet sleep & investments).

- **Theme tokens** — `mc` / `mr` / `mtx` / `mm` semantic tokens
  (`shared/theme/meridian.ts`); tracend and oneplus repointed onto them.
- **Component kit** — `shared/components/meridian/` (Card, Label, Chip,
  ListRow, TopBar, BarChart, Ring, ProgressBar, SemicircleGauge, StackedShareBar,
  TimelineItem, Screen with a `floating` overlay slot and forwardRef for
  scroll-to, Fab, PressScale, Rise, EmptyState…). `react-native-svg` +
  core `Animated` only — no new dependencies; every animation respects
  reduce motion.
- **16 first-pass screens** (Home, Finance, Garage, Tasks, Wealth, Drawer,
  Service history, Fuel fills, Wallet loads, Fixed expenses, Lent and borrow,
  Bank accounts, Cards, Monthly spend, Sleep, Habit tracker) + bottom-nav
  pill and side drawer (DAILY/GROW/SHOP).
- **16 second-pass screens** (#5f643c5) — All transactions (s18: search,
  category chips, month summary + budget pill, day groups), task details
  (s19) and edit task (s20), add lent/borrow and edit-balance sheets (s21,
  s23), card detail (s22), expense distribution (s24: donut + tap-to-filter
  rows), balance summary (s25: allocation bar + banks/lent/cards trio),
  notifications (s26: TODAY/EARLIER sections), log fuel fill (s27) and log
  service (s28), portfolio breakdown (s29: holdings with pick-to-scroll
  donut), loans & FDs (s30), utilities menu (s31: semantic 4-col grid +
  v2 sync card), buy list (s32: completion ring hero, collapsible
  COMPLETED). Vehicle Spend uses the service-history layout (s7).
- **Fixes while restyling**: week bars and category donut render final
  state before animating; wallet loads excluded from every spend total
  (week chart, month bars, category bars, all transaction totals);
  UTF-8/mojibake cleanup (`Â·`, `â€”`); RECENT TRANSACTIONS grouped by day
  with day totals; Floating "+" buttons for new task and new expense
  (pinned above the tab bar, via the Screen `floating` layer); inline
  bar-chart bars grow from the baseline; budget gauge value centered in
  the arc; CC utilization bar only shows when card limits are set.
- **Launch loading screen** (`shared/components/LoadingScreen.tsx`) —
  `#0A0A0C` canvas; red half-circle sun rising behind a white horizon
  with a white meridian line and two grey reflection lines; the line
  draws top→bottom (0.7s), horizon expands from center (0.6s), sun rises
  (0.9s), "MERIDIAN" fades up with letter-spacing 16→7 (0.9s), reflections
  fade in, then a looping 3dp red indeterminate bar + "Getting things
  ready" until the app is ready. Minimum display 1.8s; reduce motion
  jumps to the final frame. Android native splash background matched to
  `#0A0A0C`.
- Verification: tsc clean, ESLint 0 errors, 281 unit tests green.

