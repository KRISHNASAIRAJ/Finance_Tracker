/**
 * AppShell — layout wrapper with sidebar + topbar.
 */
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
          <Outlet />
        </main>
      </div>
    </div>
  )
}