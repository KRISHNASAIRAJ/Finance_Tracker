/**
 * AppShell — layout wrapper with sidebar + topbar.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { StickyMobileCTA } from './StickyMobileCTA'
import { useAuth } from '../../hooks/useAuth'
import { useRealtimeSync } from '../../hooks/useRealtimeSync'
import { useLocalAnalytics } from '../../hooks/useLocalAnalytics'
import { SEO } from '../SEO'

const TITLES: Record<string, string> = {
  '/': 'Home',
  '/habits': 'Habit Tracker',
  '/finance': 'Finance',
  '/garage': 'Garage',
  '/tasks': 'Tasks',
  '/wealth': 'Wealth',
  '/meals': 'Meals',
  '/sleep': 'Sleep',
  '/career': 'Career',
  '/career/goals': 'Career Goals',
  '/diary': 'Diary',
  '/more': 'More',
  '/more/notes': 'Notes',
}

const DESCRIPTIONS: Record<string, string> = {
  '/': 'Daily quote, habit progress, sleep, and AI money notes — your whole life at a glance.',
  '/habits': 'Tick your 10 daily habits, track streaks, and see the monthly overview grid.',
  '/finance': 'Net worth, budgets, transactions, cards, and spending reports.',
  '/garage': 'Fuel fills, mileage, and service logs for every vehicle you own.',
  '/tasks': 'Tasks with priorities, recurrence, and reminders.',
  '/wealth': 'Investments, FDs, loans, and net-worth tracking with live prices.',
  '/meals': 'Meal logging with AI photo analysis, nutrition trends, and weight tracking.',
  '/sleep': 'Sleep sessions, 7-night trends, and AI insights.',
  '/career': 'Career events and milestones timeline.',
  '/career/goals': '2025–2031 roadmap: net worth, portfolio, and life missions.',
  '/diary': 'Weekly diary with prompts and reflections.',
  '/more': 'All Meridian modules in one place.',
  '/more/notes': 'Apple-style notes with folders, pins, and recently deleted.',
}

export function AppShell() {
  const location = useLocation()
  const { user } = useAuth()
  useRealtimeSync(user?.id ?? '')
  useLocalAnalytics()
  const title = TITLES[location.pathname] ?? 'Meridian'
  return (
    <div className="min-h-screen bg-black">
      <SEO
        title={title}
        description={DESCRIPTIONS[location.pathname] ?? 'Personal life tracker — finance, habits, sleep, wealth, and more.'}
        path={location.pathname}
        noIndex
      />
      <Sidebar />
      <div className="pl-0 lg:pl-56">
        <Topbar title={title} />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <StickyMobileCTA />
    </div>
  )
}
