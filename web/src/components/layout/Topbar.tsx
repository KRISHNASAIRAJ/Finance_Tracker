/**
 * Topbar — app header with back navigation, page title, search, logout.
 */
import { ArrowLeft, LogOut, Search } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const TOP_LEVEL = new Set([
  '/', '/finance', '/garage', '/tasks', '/wealth', '/meals', '/career', '/diary', '/more',
])

export function Topbar({ title }: { title?: string }) {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const isSubPage = !TOP_LEVEL.has(location.pathname)

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      // Fallback: go to the parent module
      const seg = location.pathname.split('/').filter(Boolean)
      navigate(seg.length > 1 ? `/${seg[0]}` : '/')
    }
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-white/10 bg-black px-6">
      <div className="flex items-center gap-3">
        {isSubPage && (
          <button
            onClick={goBack}
            className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            title="Go back"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
        )}
        <h1 className="text-base font-semibold text-white">{title ?? 'Dashboard'}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/30">
          <Search className="h-4 w-4" />
          <span>Search (Ctrl+K)</span>
        </div>
        {user && (
          <div className="flex items-center gap-2 text-sm text-white/50">
            <span className="hidden sm:inline">{user.email}</span>
            <button
              onClick={signOut}
              className="rounded-lg p-1.5 transition-colors hover:bg-white/10 hover:text-white"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
