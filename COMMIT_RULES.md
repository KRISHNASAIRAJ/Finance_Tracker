# Commit Rules — Meridian App

> All contributors (including AI agents) **MUST** follow these rules when committing to this repository.

---

## Branch Naming

| Type | Pattern | Example |
|---|---|---|
| Feature | `feat/<short-description>` | `feat/garage-next-service` |
| Bug fix | `fix/<short-description>` | `fix/credit-card-arrow-nav` |
| Refactor | `refactor/<scope>` | `refactor/category-colors` |
| DevOps | `ci/<task>` | `ci/auto-install-script` |
| Hotfix | `hotfix/<issue>` | `hotfix/crashfix-ios` |

Always branch off `main`. Never commit directly to `main`.

---

## Commit Message Format

```
<type>(<scope>): <short summary>

[optional body — what changed and why]
[optional: closes #issue-number]
```

### Types

| Tag | When to use |
|---|---|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `refactor` | Code change with no new features or fixes |
| `style` | UI / CSS / StyleSheet changes only |
| `chore` | Dependency updates, tooling, config |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `ci` | CI/CD workflow changes |

### Scope Examples

`finance`, `garage`, `navigation`, `store`, `auth`, `notifications`, `widget`, `deps`

### Examples

```
feat(finance): add 25 expense categories with icon grid in AddExpenseScreen

- Replaced 4 flat text chips with 25 icon+label chips
- Auto-detection rules updated for all new categories
- Closes #34

fix(garage): remove duplicate closing brace causing TS compile error

refactor(store): add editCard action and bump persist cache key to v9

chore(deps): bump expo to ~54.0.0
```

---

## Pull Request Rules

1. **Title** must follow the commit message format above.
2. **Description** must include:
   - What changed
   - Why it changed
   - How to test
3. Squash merge only — no merge commits.
4. Delete the branch after merge.
5. CI must pass (TypeScript check) before merging.

---

## AI Agent Rules

When an AI agent (Antigravity, Claude Code, Copilot, etc.) makes commits:
- Commit message **must** include `[AI]` prefix: `feat(finance): [AI] add interactive category filter in reports`
- Body **must** describe the intent in 1–3 sentences.
- Never commit secrets, `.env` files, or API keys.
- Bump Zustand persist key (`meridian-finance-storage-vN`) whenever the store schema changes.

---

## Files Never to Commit

```
.env
.env.*
!.env.example
android/app/google-services.json
ios/GoogleService-Info.plist
node_modules/
.expo/
```
