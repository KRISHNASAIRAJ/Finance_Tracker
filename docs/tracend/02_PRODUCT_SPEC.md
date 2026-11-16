# Product spec: Today, Why, Simulator, Proposals, Ask Meridian, Privacy

## 0. Principles
1. Score + decision + reasons, always together.
2. Compare to the user's own normal.
3. Rule-based first, AI optional.
4. Nothing changes without approval, and every change can be undone.
5. Say what you could not see.
6. Voice: short, plain, no hype. Example: "Tight week. Hold Friends
   spending at Rs 1,500." Avoid jokes and guilt.

## 1. Data the engine reads (existing data only)
sleep logs, habit logs, tasks, transactions, category spend, budget,
bank and wallet balances, minimum balances, card dues, fixed expenses,
lent and borrow due dates.

## 2. Personal normal (baseline)
For each metric keep a rolling window of the last 28 days:
- normal = median, spread = MAD * 1.4826 (floor spread at a small value
  to avoid division by zero)
- Need at least 7 days of data. Below that show "Learning your normal"
  and use simple fixed targets.
Metrics: sleep minutes, daily variable spend, habits done %, tasks done %.
Weekday-aware spend normal: use the same weekday over 8 weeks when there
are at least 4 samples, else the overall normal.

## 3. Day score (0 to 100)
Components, each converted to 0..100 from its z-score:
z = clamp((value - normal) / spread, -2, 2);  part = 50 + 25 * z (good
direction positive; for spend, lower is good so invert).
| Component | Weight | Value |
|---|---|---|
| Sleep | 30% | last night minutes vs normal |
| Money pace | 30% | month spend % vs month elapsed %, and daily spend vs normal |
| Commitments | 20% | tasks due today, bills due in 3 days (more = lower) |
| Habits | 20% | yesterday's habits done % vs normal |
Bands: 70+ "Good", 40-69 "Steady", below 40 "Low".
Show the weights in a "How this is calculated" sheet. Never hide them.
Missing component: drop it and re-weight the rest, and say so.

## 4. Today's call (decision rules, deterministic)
Pick the single highest-priority rule that fires. Each rule has a
template, 2-3 evidence items and a target screen.
1. Cash flow projected below minimum within 14 days ->
   "Tight until <date>. Collect <name> by <date>." Evidence: projection,
   the receivable, the bill. Opens Cash flow.
2. A bill due within 3 days and balance would drop under minimum ->
   "Move money before <bill> on <date>."
3. Month budget pace above 100% of elapsed time ->
   "Over pace. Hold <top category> to Rs <x> today."
4. Slept at least 60 min under normal and spend normal is high ->
   "Short night. Skip unplanned spends today."
5. Overdue urgent task -> "Clear <task> first."
6. Otherwise -> "Steady day. <one-line next due item>."
All thresholds live in one config file, not in screens.

## 5. Screens

### 5.1 Today (top of Home)
```
[ Day score ring 62 "Steady" ]   chip: "vs your normal +4"
Today's call: <headline>
  <one-line reason>
  [evidence chip] [evidence chip] [evidence chip]
  [Why this?]  [Do it / Open]
Rows: Due today, Next bill, Sleep last night, Budget pace
```
Ring sweeps once per session. Tapping the call opens its source.

### 5.2 Why this score? (timeline)
Vertical timeline of yesterday and last night in time order, for example:
18:40 Spent Rs 500 (Prawns) -> 23:10 Slept 6h 12m -> 07:02 Score 38.
Each node shows its effect on the score (+/- points). Ends with the
call. A "Usually" column shows the user's normal for each metric.

### 5.3 What-if simulator (on Cash flow)
Sliders: daily spend (Rs), delay of a receivable (days), one extra
expense (Rs). The chart and the status pill (Safe, Tight, Short) update
live (under 100 ms). Buttons: Reset, Save as scenario. Never save
scenarios as real data.
Add a second simulator on Monthly spend: "If I spend Rs X per day, I end
the month at Rs Y".

### 5.4 Proposals (approval flow)
When the engine suggests a change (category limit, monthly budget, goal
contribution, SIP amount) it creates a Proposal:
- before and after, reason, evidence chips, expected effect
- actions: Approve, Edit, Not now
- on approve: apply the change and save a Version (date, who, before,
  after, reason). History screen lists versions; Undo restores the
  previous one.
Nothing is applied automatically. Ever.

### 5.5 Coverage map (week)
A grid of the week's categories: bills paid, goals funded, habits done,
meals logged, sleep logged. Cells show done, partial, missing. "What the
week covers and what it skips."

### 5.6 Money goal setup (3 steps)
1. Pick a goal (emergency fund, a purchase, a SIP target), amount, date.
2. Meridian reads your last months and asks at most 3 questions.
3. It proposes a monthly amount with its reason and the proposals flow
   asks for approval.

### 5.7 Ask Meridian (optional, behind consent)
Chat with suggestion chips ("Why is today tight?", "How did I spend
last week?", "Can I afford X?").
Every answer shows: the numbers used (evidence), a "What I could not
see" line (for example cash spends not logged, wallet loads excluded),
and a Follow-up chip. If AI is off or offline, chips fall back to the
rule-based explanation.

### 5.8 Privacy and AI
Switch: AI features (off by default). First use shows a consent sheet
that names the provider and lists exactly what data is sent. Buttons:
Export everything, Delete account and data, Turn AI off. Note: "The app
works without AI."

## 6. Data model additions (names are suggestions)
- Baseline(metric, window_days, median, spread, updated_at, sample_n)
- DayScore(date, score, band, components_json, weights_json)
- Call(date, rule_id, headline, reason, evidence_json, target_route)
- Scenario(id, type, inputs_json, result_json)  [local only]
- Proposal(id, kind, before_json, after_json, reason, evidence_json,
  status[pending, approved, declined, undone], created_at, decided_at)
- Version(id, entity, entity_id, before_json, after_json, reason,
  approved_at)
- AiConsent(provider, scope_json, granted_at, revoked_at)

## 7. Edge cases
- Fewer than 7 days of data: show "Learning your normal".
- No sleep log: drop sleep from the score and state it.
- Same day, conflicting rules: highest priority wins, others appear
  under "Also worth a look".
- Offline: everything except Ask Meridian works.
- Timezones and day boundaries use the device local day.

## 8. Acceptance checks
- Score, call and evidence are always shown together.
- Weights and thresholds are visible and come from one config.
- No proposal changes data without Approve. Undo works.
- Simulator updates in under 100 ms and never writes real data.
- AI never receives data before consent; provider is named.
- Everything but chat works with airplane mode on.
- Unit tests cover baselines, score, rules and proposal versioning.
