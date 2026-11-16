# Tracend-inspired upgrade for Meridian: pack overview

Goal: bring the best UX ideas of https://tracend.pages.dev/ into Meridian
without copying its brand, wording or imagery.
Source note: these docs are based on the text of Tracend's public page.
The page's visual styling was not available, so the look stays Meridian's
own design system (black, red #EB0028, mint, sky, amber, violet).

## Give the agent these files, in this order
1. AGENTS.md (your existing one) + AGENTS_ADDENDUM.md (this pack)
2. 01_UX_PATTERNS.md        (what we borrow and why)
3. 02_PRODUCT_SPEC.md       (screens, behaviour, data, formulas)
4. 03_AI_GUARDRAILS.md      (consent, evidence, safety rules)
5. 04_AGENT_PROMPT.md       (Plan prompt, then Build prompts per tier)
6. Existing design references:
   - meridian_all_screens.html, meridian_screens_17_32.html,
     meridian_cashflow_weekly.html, meridian_add_transaction.html
   - motion_pack/ (MOTION_SPEC.md, motion_tokens.json)

## Also attach from your repo (paste if the agent cannot read the repo)
- Data models for: transactions, bank accounts, cards, lent/borrow,
  fixed expenses, habits and habit logs, sleep logs, tasks, goals.
- The repository/DAO layer and the navigation setup.
- The theme/tokens file and the shared components folder.
- Where AI features (if any) call an API today, and which provider.
- Your stack and versions (language, UI framework, DB, build tool).

## Order of work
Tier A engine -> Tier B Today + Why -> Tier C Simulator + Proposals ->
Tier D Ask Meridian + Privacy. Ship each tier behind a feature flag.
