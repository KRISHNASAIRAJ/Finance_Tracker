# Prompts for the coding agent (OpenCode: Plan mode, then Build mode)

## Prompt 1: Plan mode (no edits)
```
Read @AGENTS.md, @AGENTS_ADDENDUM.md, @docs/tracend/01_UX_PATTERNS.md,
@docs/tracend/02_PRODUCT_SPEC.md, @docs/tracend/03_AI_GUARDRAILS.md
and the design references in @docs/design/.
TASK: add a decision-first layer to my existing Meridian app (Today
card, Why timeline, What-if simulator, Proposals with versions, Coverage
map, Ask Meridian behind consent, Privacy screen). Do not change
existing logic, data models, navigation or screens, except where
stated. New code must be additive and behind feature flags.

Do not edit anything. Output:
1. My stack and how data is stored, from the code.
2. A map from each metric in the spec to an existing data source, and
   a list of data I do not have yet.
3. The new modules and files you will create, and the exact existing
   files you must touch (keep this list small).
4. The tier plan A to D with risks and tests for each.
5. Gaps or conflicts between the spec and my code.
6. At most 3 questions.
```

## Prompt 2: Build Tier A (engine only, no UI)
```
Approved. Implement Tier A: baselines, day score, rule engine and
config, as pure, unit-tested functions with no UI. All thresholds
and weights come from one config file. Add unit tests for: baseline
median and spread, fewer than 7 days, missing components re-weighted,
each decision rule, weekday-aware spend normal. Run build, lint and
tests and report. Wait for my OK before Tier B.
```

## Prompt 3: Build Tier B
```
Implement Tier B behind a feature flag: Today card at the top of Home
and the Why this score? timeline, using the existing Meridian design
system and the motion rules in @docs/motion/. Evidence chips open the
source screens. Show weights in a "How this is calculated" sheet.
Never hardcode numbers; use real data. Run build, lint, tests. Stop.
```

## Prompt 4: Build Tier C
```
Implement Tier C: the What-if simulator (Cash flow and Monthly spend),
the Proposals flow with Approve, Edit, Not now, Versions and Undo, and
the Coverage map. Simulator is local only and never writes real data.
Applying a proposal must go through the existing repository methods.
Add tests for versioning and undo. Run build, lint, tests. Stop.
```

## Prompt 5: Build Tier D
```
Implement Tier D: Privacy and AI screen, consent sheet, an AiProvider
interface with one implementation (the provider I name), and Ask
Meridian following @docs/tracend/03_AI_GUARDRAILS.md. The app must work
fully with AI off. Log which fields were sent. Run build, lint, tests.
```

## Rules for every step
- Small diffs, additive code, feature flags, no new dependencies unless
  I approve.
- Original wording only. Do not reuse text from tracend.pages.dev.
- Report changed files and results after each step.
