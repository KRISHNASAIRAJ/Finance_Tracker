# BOUNDARIES.md — Hard Constraints & Off-Limits Rules
## Personal Tracker App · Krishna's Tracker

> **These are non-negotiable constraints.** Any AI agent or developer working on this project must treat every item in this file as a hard stop.  
> If you think you have a reason to violate a boundary, **stop and ask the human first**.

---

## 🚫 Section 1: Data Handling — Absolute Prohibitions

### 1.1 Financial Data
- **NEVER** send raw bank account numbers, full credit card numbers, or CVVs to any external API including Claude
- **NEVER** log financial transaction amounts, account balances, or card details to console in production builds
- **NEVER** store monetary amounts as floating-point numbers — always use integers (paise). Violation causes rounding errors in financial summaries
- **NEVER** expose a user's net worth, account balances, or full transaction history in API responses that don't require authentication
- **NEVER** include financial data in crash reports, analytics events, or error logs

### 1.3 Authentication & Tokens
- **NEVER** store JWT tokens or Supabase keys in `AsyncStorage` — use `react-native-keychain` (Android Keystore / iOS Secure Enclave backed)
- **NEVER** commit `.env` files, API keys, or secrets to the repository
- **NEVER** log auth tokens anywhere — not in debug, not in error handlers
- **NEVER** return JWT tokens in API response bodies that might be cached by proxy layers

### 1.4 Card T&C Documents
- **NEVER** send an entire uploaded T&C PDF as a single prompt to Claude — always use chunking + RAG retrieval
- **NEVER** store card T&C document contents in the mobile app's filesystem (Supabase Storage only)
- **NEVER** share retrieved T&C chunks across different users (this is a single-user app, but design defensively)

---

## 🚫 Section 2: Architecture — Do Not Break These

### 2.1 The Transactions Spine
- **NEVER** create a new spend/transaction table that bypasses the `transactions` table
- **NEVER** delete records from `transactions` — use soft deletes or status flags
- **NEVER** change the `transactions.type` enum values without: (a) an Alembic migration, (b) updating `ARCHITECTURE.md`, (c) updating all downstream queries

### 2.2 Module Isolation
- **NEVER** let one module directly query another module's tables — go through the shared `transactions` table or a shared service
- **NEVER** import module-specific stores (Zustand) into other modules — use the shared event bus or props
- **NEVER** hardcode another module's navigation route strings — use the centralized navigation constants file

### 2.3 Offline-First Integrity
- **NEVER** delete from SQLite local cache until the server confirms the delete
- **NEVER** skip optimistic updates — the user must never see the app "freeze" waiting for a network call on manual CRUD
- **NEVER** use `setTimeout`/`setInterval` for notification scheduling — use WorkManager/AlarmManager

### 2.4 Database Migrations
- **NEVER** edit the PostgreSQL schema directly in production — always use Alembic migrations
- **NEVER** make a destructive migration (DROP COLUMN, DROP TABLE) without a rollback migration
- **NEVER** run `alembic downgrade base` in production without explicit human approval

---

## 🚫 Section 3: AI / Claude API — Strict Scoping

### 3.1 Permitted Claude API Use Cases (v1)
The Claude API may **only** be called for these exact purposes:

| ✅ Permitted | Description |
|---|---|---|
| Card T&C Q&A | RAG-grounded answers from the user's uploaded T&C document |
| Portfolio recommendations | High-level suggestions from aggregated portfolio data |

### 3.2 Prohibited Claude API Uses
- **NEVER** use Claude for financial advice, tax recommendations, or investment decisions presented as authoritative
- **NEVER** use Claude to process raw account numbers, card numbers, or PAN/Aadhaar data
- **NEVER** use Claude for general-purpose chat unrelated to the three permitted use cases
- **NEVER** call Claude from the mobile app directly — all Claude API calls must go through the backend
- **NEVER** cache Claude responses containing financial data in the mobile local DB
- **NEVER** stream Claude responses without sanitizing the output for PII before displaying

### 3.3 Mandatory Disclaimers
Every AI response displayed to the user MUST include one of:
- Card T&C: *"Based on the document you uploaded — verify with your bank for current terms."*
- Portfolio: *"For informational purposes only. This is not investment advice."*

---

## 🚫 Section 4: Third-Party APIs — Access Controls

### 4.1 Kite Connect / Kite MCP (Zerodha)
- **NEVER** implement Kite integration (Phase 5) without first confirming current API pricing on the Zerodha developer console
- **NEVER** store Kite API credentials in the mobile app — backend only
- **NEVER** auto-execute trades via Kite API — read-only access for holdings sync

### 4.2 Firebase Cloud Messaging
- **NEVER** include financial data (balances, amounts) in FCM notification payloads — include only a summary string and a data trigger ID
- **NEVER** use FCM for task reminders — use local notifications (task reminders must be private, not routed through Google's servers)

---

## 🚫 Section 5: Platform & Deployment Constraints

### 5.1 iOS
- **NEVER** build or test iOS-specific features in v1 — iOS is explicitly deferred (PRD Section 2)
- **NEVER** use iOS-only APIs (`HealthKit`, `CoreTelephony`, `iMessage APIs`) in cross-platform shared code

### 5.2 App Store / Public Distribution
- **NEVER** prepare this app for public Google Play or Apple App Store submission — it is a personal sideloaded app only (this determines which permissions are acceptable)

### 5.3 Multi-User
- **NEVER** design schemas or APIs to support multiple users in v1 — single user only (PRD Section 2)
- **NEVER** add user_id foreign keys to tables without updating `ARCHITECTURE.md` and the team (this would be a major scope change)

---

## 🚫 Section 6: Code Quality Gates

- **NEVER** merge code that breaks TypeScript strict mode checks
- **NEVER** merge code that drops test coverage below 60% on the backend service layer
- **NEVER** introduce a new direct dependency on Crashlytics with financial data, or any analytics SDK that sends user financial data offsite
- **NEVER** disable ESLint rules globally — fix the code, don't suppress the rule
- **NEVER** use `any` type in TypeScript except in explicitly marked legacy adapter files

---

## ⚠️ Section 7: Soft Warnings (Avoid Unless Justified)

These aren't absolute prohibitions but require a comment in code explaining why:
- Bypassing TanStack Query cache for a network call
- Adding a new Zustand store instead of extending an existing one
- Making a synchronous API call that could block the UI thread
- Adding a new PostgreSQL table that doesn't link to `transactions`
- Storing user preference data in the backend DB instead of device storage

---

## 📋 Boundary Change Process

If you believe a boundary in this file must be changed:

1. **Stop work** on the feature requiring the change
2. **Document** why the boundary needs to change in a new ADR file under `ADR/`
3. **Get explicit human approval** from the project owner before proceeding
4. **Update this file** and `ARCHITECTURE.md` after approval
5. **Note the change** in `SAFETY.md` if it has safety/privacy implications
