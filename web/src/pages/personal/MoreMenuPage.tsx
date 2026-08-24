import { Link } from 'react-router-dom'
import { FileBarChart2, StickyNote, Target, ChefHat, Salad } from 'lucide-react'
import { PageHeader } from '../../components/ui/Shared'
import { cn } from '../../lib/utils'

const LINKS = [
  { to: '/more/report', icon: FileBarChart2, title: 'Combined Report', subtitle: 'Net worth, allocation & monthly spend' },
  { to: '/more/notes', icon: StickyNote, title: 'Personal Notes', subtitle: 'Quick thoughts & reminders' },
  { to: '/more/goals', icon: Target, title: 'Goals 2026', subtitle: 'Track yearly goals' },
  { to: '/more/recipes', icon: ChefHat, title: 'Recipes', subtitle: 'Your recipe collection' },
  { to: '/more/diet', icon: Salad, title: 'Diet Viewer', subtitle: 'Weekly meal plan' },
]

export function MoreMenuPage() {
  return (
    <div className="fade-up space-y-5">
      <PageHeader title="More" subtitle="Personal tools, reports and trackers" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {LINKS.map(({ to, icon: Icon, title, subtitle }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              'group rounded-2xl border border-white/10 bg-[#101010] p-5',
              'transition-colors hover:border-white/25'
            )}
          >
            <Icon className="h-5 w-5 text-[#9BA5FF] transition-colors group-hover:text-white" />
            <p className="mt-3 text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 text-xs text-white/50">{subtitle}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
