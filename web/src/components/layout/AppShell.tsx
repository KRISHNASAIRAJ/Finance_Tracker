/**
 * AppShell — layout wrapper with sidebar + topbar.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useAuth } from '../../hooks/useAuth'
import { useRealtimeSync } from '../../hooks/useRealtimeSync'

const TITLES: Record<string, string> = {
  '/': 'Home',
  '/finance': 'Finance',
  '/garage': 'Garage',
  '/tasks': 'Tasks',
  '/wealth': 'Wealth',
  '/meals': 'Meals',
  '/career': 'Career',
  '/diary': 'Diary',
  '/more': 'More',
}

export function AppShell() {
  const location = useLocation()
  const { user } = useAuth()
  useRealtimeSync(user?.id ?? '')
  const title = TITLES[location.pathname] ?? 'Meridian'
  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <div className="pl-56">
        <Topbar title={title} />
        <main className="mx-auto max-w-6xl px-6 py-8">
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
    </div>
  )
}