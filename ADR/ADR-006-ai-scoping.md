# ADR-006: AI API Scoping — Two Use Cases Only in v1
## Status: Accepted · Date: 2026-07-17

## Context
The Claude API has ongoing token costs and privacy implications. Without explicit scoping, "add AI to everything" becomes a common request that inflates costs and creates privacy surface area.

## Decision
**In v1, Claude API is permitted for EXACTLY two purposes: Card T&C Q&A (RAG) and Portfolio recommendations. Both are backend-only.**

## Rationale
- **Cost control**: Unbounded AI features on a personal app can cost $50-200/month unexpectedly
- **Privacy**: Every prompt is a potential data leak vector — minimize attack surface
- **Quality**: Scoped prompts with tight system instructions outperform general chat on specific tasks
- **Compliance**: Investment advice regulations require clear disclaimers — easier to enforce with bounded use cases

## What This Excludes (Explicitly)
- General AI chat assistant for the app
- AI-generated expense categories (use a hardcoded list instead)
- AI task prioritization suggestions
- AI-generated diet/recipe suggestions
- Natural language queries over transaction history

## Consequences
- Any new AI feature proposal must go through the gate process in SAFETY.md Section 10
- The `backend/app/ai/` directory has exactly two service files in v1
- Rate limits are enforced per use case (see SAFETY.md Section 6)
