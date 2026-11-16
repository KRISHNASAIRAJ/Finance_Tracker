/**
 * Sidebar — fold.money-inspired left nav with icons + labels.
 */
import { motion } from 'framer-motion'
import { NavLink } from 'react-router-dom'
import {
  Home,
  Wallet,
  Car,
  CheckSquare,
  TrendingUp,
  MoreHorizontal,
  UtensilsCrossed,
  Briefcase,
  BookOpen,
  Moon,
  ListChecks,
  Flag,
} from 'lucide-react'
import { cn } from '../../lib/utils'

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/habits', icon: ListChecks, label: 'Habits' },
  { to: '/finance', icon: Wallet, label: 'Finance' },
  { to: '/garage', icon: Car, label: 'Garage' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/wealth', icon: TrendingUp, label: 'Wealth' },
  { to: '/meals', icon: UtensilsCrossed, label: 'Meals' },
  { to: '/sleep', icon: Moon, label: 'Sleep' },
  { to: '/career', icon: Briefcase, label: 'Career' },
  { to: '/career/goals', icon: Flag, label: 'Career Goals' },
  { to: '/diary', icon: BookOpen, label: 'Diary' },
  { to: '/more', icon: MoreHorizontal, label: 'More' },
]

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-line bg-canvas max-lg:hidden">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-ink">
          <span className="text-[10px] font-bold text-canvas">M</span>
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-canvas bg-tertiary" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-ink">Meridian</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}>
            {({ isActive }) => (
              <motion.span
                className={cn(
                  'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'text-white' : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                )}
                whileTap={{ scale: 0.97 }}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-active-pill"
                    className="absolute inset-0 rounded-xl bg-white/10"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <item.icon className="relative h-4.5 w-4.5" strokeWidth={1.5} />
                <span className="relative">{item.label}</span>
              </motion.span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-line px-4 py-3">
        <p className="section-label">Meridian · web</p>
      </div>
    </aside>
  )
}