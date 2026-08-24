/**
 * Category map — ported from mobile src/shared/categoryMap.ts
 * Uses lucide-react icons on web.
 */
import {
  UtensilsCrossed,
  ShoppingBag,
  Fuel,
  Plane,
  Receipt,
  Home,
  Repeat,
  Tv,
  MonitorPlay,
  GraduationCap,
  Heart,
  TrendingUp,
  BarChart3,
  CreditCard,
  Calculator,
  Users,
  Wallet,
  Briefcase,
  MoreHorizontal,
  ShieldCheck,
  PiggyBank,
  type LucideIcon,
} from 'lucide-react'

export interface Category {
  name: string
  icon: LucideIcon
  color: string
}

export const EXPENSE_CATEGORIES: Category[] = [
  { name: 'Food & Dining', icon: UtensilsCrossed, color: '#ffb2b9' },
  { name: 'Grocery', icon: ShoppingBag, color: '#5ee6ff' },
  { name: 'Fuel', icon: Fuel, color: '#ea6479' },
  { name: 'Travel', icon: Plane, color: '#d0bcff' },
  { name: 'Shopping', icon: ShoppingBag, color: '#ffdadc' },
  { name: 'Bills & Recharge', icon: Receipt, color: '#00cbe6' },
  { name: 'Rent', icon: Home, color: '#38bdf8' },
  { name: 'EMI', icon: Repeat, color: '#a78bfa' },
  { name: 'Entertainment', icon: Tv, color: '#f472b6' },
  { name: 'OTT', icon: Tv, color: '#e879f9' },
  { name: 'Youtube Premium', icon: MonitorPlay, color: '#ef4444' },
  { name: 'Education', icon: GraduationCap, color: '#22d3ee' },
  { name: 'Medical', icon: Heart, color: '#ffb2b9' },
  { name: 'Health & Wellness', icon: Heart, color: '#5ee6ff' },
  { name: 'Insurance', icon: ShieldCheck, color: '#d0bcff' },
  { name: 'SIP', icon: TrendingUp, color: '#00cbe6' },
  { name: 'Equity Investment', icon: BarChart3, color: '#ea6479' },
  { name: 'Card Annual Charges', icon: CreditCard, color: '#ffdadc' },
  { name: 'Interest', icon: Calculator, color: '#ffb2b9' },
  { name: 'Family', icon: Users, color: '#ea6479' },
  { name: 'Friends', icon: Users, color: '#5ee6ff' },
  { name: 'Cash Withdrawal', icon: Wallet, color: '#d0bcff' },
  { name: 'Wallet Loads', icon: Wallet, color: '#00cbe6' },
  { name: 'Professional Service', icon: Briefcase, color: '#ffdadc' },
  { name: 'Others', icon: MoreHorizontal, color: '#a78bfa' },
]

export const INCOME_CATEGORIES: Category[] = [
  { name: 'Salary', icon: PiggyBank, color: '#5ee6ff' },
  { name: 'Freelance', icon: Briefcase, color: '#ffb2b9' },
  { name: 'Investment', icon: TrendingUp, color: '#00cbe6' },
  { name: 'Others', icon: MoreHorizontal, color: '#d0bcff' },
]

export function getCategory(name: string): Category {
  const n = name.toLowerCase().trim()
  const found = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].find(
    (c) => c.name.toLowerCase() === n
  )
  return found ?? { name, icon: Receipt, color: '#a78bfa' }
}

export function getCategoryColor(name: string): string {
  return getCategory(name).color
}

export function getCategoryIcon(name: string): LucideIcon {
  return getCategory(name).icon
}