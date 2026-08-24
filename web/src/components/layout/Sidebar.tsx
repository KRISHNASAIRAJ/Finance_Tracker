/**
 * Sidebar — fold.money-inspired left nav with icons + labels.
 */
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
} from 'lucide-react'
import { cn } from '../../lib/utils'

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/finance', icon: Wallet, label: 'Finance' },
  { to: '/garage', icon: Car, label: 'Garage' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/wealth', icon: TrendingUp, label: 'Wealth' },
  { to: '/meals', icon: UtensilsCrossed, label: 'Meals' },
  { to: '/career', icon: Briefcase, label: 'Career' },
  { to: '/diary', icon: BookOpen, label: 'Diary' },
  { to: '/more', icon: MoreHorizontal, label: 'More' },
]

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-white/10 bg-black">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white">
          <span className="text-[10px] font-bold text-black">M</span>
        </div>
        <span className="text-sm font-semibold text-white">Meridian</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80'
              )
            }
          >
            <item.icon className="h-4.5 w-4.5" strokeWidth={1.5} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-4 py-3">
        <p className="text-[11px] text-white/25">Meridian v3</p>
      </div>
    </aside>
  )
}