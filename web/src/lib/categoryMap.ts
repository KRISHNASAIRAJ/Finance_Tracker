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
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export interface Category {
  name: string
  icon: LucideIcon
  color: string
}

export const EXPENSE_CATEGORIES: Category[] = [
  { name: 'Food & Dining', icon: UtensilsCrossed, color: '#FF4D66' },
  { name: 'Grocery', icon: ShoppingBag, color: '#4DA3FF' },
  { name: 'Fuel', icon: Fuel, color: '#FF4D66' },
  { name: 'Vehicle Maintenance', icon: Wrench, color: '#3EE6B0' },
  { name: 'Travel', icon: Plane, color: '#9B8CFF' },
  { name: 'Shopping', icon: ShoppingBag, color: '#FFD0D6' },
  { name: 'Bills & Recharge', icon: Receipt, color: '#4DA3FF' },
  { name: 'Rent', icon: Home, color: '#4DA3FF' },
  { name: 'EMI', icon: Repeat, color: '#9B8CFF' },
  { name: 'Entertainment', icon: Tv, color: '#FF4D66' },
  { name: 'OTT', icon: Tv, color: '#9B8CFF' },
  { name: 'Youtube Premium', icon: MonitorPlay, color: '#EB0028' },
  { name: 'Education', icon: GraduationCap, color: '#4DA3FF' },
  { name: 'Medical', icon: Heart, color: '#FF4D66' },
  { name: 'Health & Wellness', icon: Heart, color: '#4DA3FF' },
  { name: 'Insurance', icon: ShieldCheck, color: '#9B8CFF' },
  { name: 'SIP', icon: TrendingUp, color: '#4DA3FF' },
  { name: 'Equity Investment', icon: BarChart3, color: '#FF4D66' },
  { name: 'Card Annual Charges', icon: CreditCard, color: '#FFD0D6' },
  { name: 'Interest', icon: Calculator, color: '#FF4D66' },
  { name: 'Family', icon: Users, color: '#FF4D66' },
  { name: 'Friends', icon: Users, color: '#4DA3FF' },
  { name: 'Cash Withdrawal', icon: Wallet, color: '#9B8CFF' },
  { name: 'Wallet Loads', icon: Wallet, color: '#4DA3FF' },
  { name: 'Professional Service', icon: Briefcase, color: '#FFD0D6' },
  { name: 'Others', icon: MoreHorizontal, color: '#9B8CFF' },
]

export const INCOME_CATEGORIES: Category[] = [
  { name: 'Salary', icon: PiggyBank, color: '#4DA3FF' },
  { name: 'Freelance', icon: Briefcase, color: '#FF4D66' },
  { name: 'Investment', icon: TrendingUp, color: '#4DA3FF' },
  { name: 'Others', icon: MoreHorizontal, color: '#9B8CFF' },
]

export function getCategory(name: string): Category {
  const n = name.toLowerCase().trim()
  const found = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].find(
    (c) => c.name.toLowerCase() === n
  )
  return found ?? { name, icon: Receipt, color: '#9B8CFF' }
}

export function getCategoryColor(name: string): string {
  return getCategory(name).color
}

export function getCategoryIcon(name: string): LucideIcon {
  return getCategory(name).icon
}