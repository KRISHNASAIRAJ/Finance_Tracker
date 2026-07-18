-- Migration 0001: Initial schema (all 14 tables, matching existing SQLAlchemy models)
-- Ported from backend/app/models/ — column names preserved for mobile compatibility
-- All IDs are TEXT (UUID v4 strings), amounts are INTEGER (paise)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. users
CREATE TABLE users (
    id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    supabase_id     TEXT UNIQUE,
    name            TEXT NOT NULL,
    email           TEXT UNIQUE,
    dob             TEXT,
    gender          TEXT,
    goals           TEXT,
    is_onboarded    BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. transactions (unified spine — ADR-002)
CREATE TABLE transactions (
    id                  TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id             TEXT NOT NULL,
    type                TEXT NOT NULL,
    amount              INTEGER NOT NULL,
    currency            TEXT DEFAULT 'INR',
    date                TEXT NOT NULL,
    category            TEXT NOT NULL,
    notes               TEXT,
    source              TEXT DEFAULT 'manual',
    linked_card_id      TEXT,
    linked_vehicle_id   TEXT,
    linked_holding_id   TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_linked_card ON transactions(linked_card_id);

-- 3. credit_cards
CREATE TABLE credit_cards (
    id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id         TEXT NOT NULL,
    name            TEXT NOT NULL,
    network         TEXT NOT NULL,
    ending_with     TEXT NOT NULL,
    billing_day     INTEGER NOT NULL,
    balance         INTEGER DEFAULT 0,
    due_date        TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_cards_user_id ON credit_cards(user_id);

-- 4. bank_accounts
CREATE TABLE bank_accounts (
    id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id         TEXT NOT NULL,
    title           TEXT NOT NULL,
    amount          INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_accounts_user_id ON bank_accounts(user_id);

-- 5. receivables (lent/borrowed)
CREATE TABLE receivables (
    id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id         TEXT NOT NULL,
    person_name     TEXT NOT NULL,
    amount          INTEGER NOT NULL,
    due_date        TEXT NOT NULL,
    note            TEXT,
    type            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_receivables_user_id ON receivables(user_id);

-- 6. fixed_expenses
CREATE TABLE fixed_expenses (
    id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id         TEXT NOT NULL,
    name            TEXT NOT NULL,
    amount          INTEGER NOT NULL,
    billing_day     INTEGER NOT NULL,
    category        TEXT NOT NULL,
    last_paid_month TEXT,
    due_date        TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fixed_expenses_user_id ON fixed_expenses(user_id);

-- 7. payzapp_loads
CREATE TABLE payzapp_loads (
    id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id         TEXT NOT NULL,
    amount          INTEGER NOT NULL,
    date            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payzapp_loads_user_id ON payzapp_loads(user_id);

-- 8. fuel_fills
CREATE TABLE fuel_fills (
    id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id         TEXT NOT NULL,
    vehicle         TEXT NOT NULL,
    date            TEXT NOT NULL,
    amount          INTEGER NOT NULL,
    liters          NUMERIC(8,2) NOT NULL,
    price_per_liter INTEGER NOT NULL,
    odometer        INTEGER NOT NULL,
    station         TEXT,
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fuel_fills_user_id ON fuel_fills(user_id);
CREATE INDEX idx_fuel_fills_vehicle ON fuel_fills(vehicle);

-- 9. maintenance_logs
CREATE TABLE maintenance_logs (
    id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id         TEXT NOT NULL,
    vehicle         TEXT NOT NULL,
    date            TEXT NOT NULL,
    amount          INTEGER NOT NULL,
    service_type    TEXT NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_maintenance_logs_user_id ON maintenance_logs(user_id);
CREATE INDEX idx_maintenance_logs_vehicle ON maintenance_logs(vehicle);

-- 10. tasks
CREATE TABLE tasks (
    id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id         TEXT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    priority        TEXT DEFAULT 'medium',
    due_date        TEXT,
    is_completed    BOOLEAN DEFAULT FALSE,
    subtasks        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_is_completed ON tasks(is_completed);

-- 11. notes
CREATE TABLE notes (
    id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id         TEXT NOT NULL,
    title           TEXT NOT NULL,
    content         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notes_user_id ON notes(user_id);

-- 12. goals
CREATE TABLE goals (
    id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id         TEXT NOT NULL,
    title           TEXT NOT NULL,
    is_completed    BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_goals_user_id ON goals(user_id);

-- 13. recipes
CREATE TABLE recipes (
    id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id         TEXT NOT NULL,
    title           TEXT NOT NULL,
    prep_time       INTEGER,
    calories        INTEGER,
    ingredients     TEXT,
    steps           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipes_user_id ON recipes(user_id);

-- 14. diet_plans
CREATE TABLE diet_plans (
    id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id         TEXT NOT NULL,
    day             TEXT NOT NULL,
    meal_type       TEXT NOT NULL,
    meal_name       TEXT NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diet_plans_user_id ON diet_plans(user_id);
