## Decision-first layer (add to AGENTS.md)
- Product docs live in docs/tracend/. They are the source of truth for
  Today, Why, Simulator, Proposals, Coverage map, Ask Meridian, Privacy.
- Engine first: baselines, score and rules are pure functions with unit
  tests. Screens only display their output.
- Every recommendation shows score, decision and evidence together.
- No automatic changes to user data. Changes go through Proposals and
  are versioned with Undo.
- AI is optional and consent-gated; the app must work with AI off and
  offline. Never send data before consent.
- Do not copy wording, branding or images from external sites.
- New features sit behind feature flags and do not alter existing logic.
