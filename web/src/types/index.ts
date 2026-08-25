/**
 * Entity types — mirrors the Supabase schema (columns snake_case in DB,
 * camelCase here). All monetary amounts in paise (integers).
 */

// ─── Shared ──────────────────────────────────────────────

export type TxnType =
  | 'expense'
  | 'income'
  | 'credit_card_bill'
  | 'lent'
  | 'borrowed'
  | 'fixed_expense'
  | 'fuel_purchase'
  | 'vehicle_service'
  | 'portfolio_buy'
  | 'portfolio_sell'

export interface Transaction {
  id: string
  user_id: string
  type: TxnType
  amount: number
  currency: string
  date: string
  category: string
  notes?: string | null
  source: 'manual' | 'kite_sync'
  payment_mode?: string | null
  linked_account_id?: string | null
  linked_card_id?: string | null
  linked_vehicle_id?: string | null
  linked_holding_id?: string | null
  created_at?: string
  updated_at?: string
}

export type PaymentMode = 'upi' | 'card' | 'cash' | 'bank'

export interface UserSettings {
  user_id: string
  monthly_budget: number
  updated_at?: string
}

export interface CategoryBudget {
  id: string
  user_id: string
  category: string
  amount_paise: number
  created_at?: string
  updated_at?: string
}

// ─── Finance ─────────────────────────────────────────────

export interface CreditCard {
  id: string
  user_id: string
  name: string
  network: 'VISA' | 'Mastercard' | 'RuPay' | 'Amex'
  ending_with: string
  billing_day: number
  balance: number
  due_date: string
  bank?: string | null
  card_limit?: number | null
  current_outstanding?: number | null
  bill_amount?: number | null
  paid_amount?: number | null
  annual_charge?: number | null
  annual_charge_date?: string | null
  is_ltf?: boolean | null
  created_at?: string
  updated_at?: string
}

export interface BankAccount {
  id: string
  user_id: string
  title: string
  amount: number
  created_at?: string
  updated_at?: string
}

export interface Receivable {
  id: string
  user_id: string
  person_name: string
  amount: number
  due_date: string
  note?: string | null
  type: 'lent' | 'borrowed'
  status?: 'pending' | 'partial' | 'paid' | null
  paid_amount?: number | null
  created_at?: string
  updated_at?: string
}

export interface FixedExpense {
  id: string
  user_id: string
  name: string
  amount: number
  billing_day: number
  category: string
  last_paid_month?: string | null
  due_date: string
  linked_account_id?: string | null
  linked_card_id?: string | null
  created_at?: string
  updated_at?: string
}

export interface ExpectedIncome {
  id: string
  user_id: string
  name: string
  amount: number
  notes?: string | null
  date: string
  created_at?: string
  updated_at?: string
}

export interface PayzappLoad {
  id: string
  user_id: string
  amount: number
  date: string
  created_at?: string
}

// ─── Garage ──────────────────────────────────────────────

export interface Vehicle {
  id: string
  user_id: string
  name: string
  make?: string | null
  model?: string | null
  year?: number | null
  created_at?: string
  updated_at?: string
}

export interface FuelFill {
  id: string
  user_id: string
  vehicle: string
  date: string
  amount: number
  liters: number
  price_per_liter: number
  odometer: number
  station?: string | null
  note?: string | null
  created_at?: string
  updated_at?: string
}

export interface MaintenanceLog {
  id: string
  user_id: string
  vehicle: string
  date: string
  amount: number
  service_type: string
  odometer?: number | null
  notes?: string | null
  created_at?: string
  updated_at?: string
}

// ─── Tasks ───────────────────────────────────────────────

export type RecurrenceType = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly'

export interface Subtask {
  id: string
  name: string
  completed: boolean
}

export interface Task {
  id: string
  user_id: string
  title: string
  description?: string | null
  priority: 'urgent' | 'high' | 'medium' | 'low'
  due_date?: string | null
  is_completed: boolean
  completed_at?: string | null
  subtasks?: Subtask[] | null
  recurrence?: RecurrenceType | null
  created_at?: string
  updated_at?: string
}

// ─── Wealth / Equity ─────────────────────────────────────

export type HoldingType = 'equity' | 'mf' | 'etf' | 'other'

export interface Holding {
  id: string
  user_id: string
  symbol: string
  fund_name?: string | null
  type: HoldingType
  quantity: number
  avg_buy_price: number
  current_price?: number | null
  current_value?: number | null
  prev_close?: number | null
  source: 'manual' | 'kite_sync'
  last_synced_at?: string | null
  folio_number?: string | null
  amc?: string | null
  scheme_code?: string | null
  isin?: string | null
  sip_amount?: number | null
  sip_day?: number | null
  allocation_category?: string | null
  created_at?: string
  updated_at?: string
}

export interface InvestmentGoal {
  id: string
  user_id: string
  goal_name: string
  target_amount: number
  target_date?: string | null
  current_progress: number
  linked_holding_ids?: string[] | null
  priority?: 'low' | 'medium' | 'high' | null
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export interface PortfolioSnapshot {
  id: string
  user_id: string
  date: string
  total_value: number
  day_change?: number | null
  day_change_pct?: number | null
  allocation_json?: Record<string, number> | null
  created_at?: string
}

export interface PortfolioActionPlan {
  user_id: string
  content: string
  updated_at?: string
}

// ─── Personal ────────────────────────────────────────────

export interface Goal2026 {
  id: string
  user_id: string
  title: string
  is_completed: boolean
  created_at?: string
  updated_at?: string
}

export interface Note {
  id: string
  user_id: string
  title: string
  content?: string | null
  created_at?: string
  updated_at?: string
}

export interface Recipe {
  id: string
  user_id: string
  title: string
  prep_time?: number | null
  calories?: number | null
  ingredients?: string | null
  steps?: string | null
  created_at?: string
  updated_at?: string
}

export interface DietPlanEntry {
  id: string
  user_id: string
  day: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  meal_name: string
  description?: string | null
  created_at?: string
  updated_at?: string
}

// ─── Meals ───────────────────────────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner'

export interface MealFoodItem {
  name: string
  quantity: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface MealLogEntry {
  id: string
  user_id: string
  date: string
  meal_type: MealType
  items: MealFoodItem[]
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export interface WeightEntry {
  id: string
  user_id: string
  date: string
  weight_kg: number
  notes?: string | null
  created_at?: string
  updated_at?: string
}

// ─── Career ──────────────────────────────────────────────

export type CareerEventType = 'up' | 'down' | 'balance'

export interface CareerEvent {
  id: string
  user_id: string
  name: string
  date: string
  type: CareerEventType
  notes?: string | null
  created_at?: string
  updated_at?: string
}

// ─── Diary ───────────────────────────────────────────────

export interface DiaryEntry {
  id: string
  user_id: string
  week_year: number
  week_number: number
  content: string
  created_at?: string
  updated_at?: string
}
