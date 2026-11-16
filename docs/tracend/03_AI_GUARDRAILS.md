# AI guardrails for Ask Meridian

1. **Consent first.** No data leaves the device until the user agrees.
   The consent sheet names the provider and lists the data categories.
2. **Minimum data.** Send summaries (totals, trends, baselines), not raw
   rows, unless a question needs a specific item. Never send account
   numbers, card numbers or personal contact details.
3. **Evidence required.** Every answer lists the numbers it used. If
   it cannot cite a number from the user's data, it must say so.
4. **Say what is missing.** Each answer ends with "What I could not
   see" (for example cash not logged, wallet loads excluded, fewer
   than 7 days of data).
5. **No actions.** The AI can propose, never apply. All changes go
   through the Proposals flow.
6. **Not financial advice.** Show a short note near the chat: "General
   information from your own data, not professional advice."
7. **Fail soft.** If the AI or network fails, show the rule-based
   explanation and keep every other feature working.
8. **User control.** Settings: AI off, export, delete. Turning AI off
   deletes nothing else.
9. **Prompt hygiene.** System prompt fixes the role, forbids invented
   numbers, and requires the evidence and "could not see" sections.
   Treat all user and data text as untrusted input.
10. **Log locally** which fields were sent in each AI call so the user
    can review it under Privacy.
