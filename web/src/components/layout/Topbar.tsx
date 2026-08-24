/**
 * Topbar — app header with page title, search, logout.
 */
import { LogOut, Search } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

export function Topbar({ title }: { title?: string }) {
  const { user, signOut } = useAuth()

  return (
    <header className="flex h-14 items-center justify-between border-b border-white/10 bg-black px-6">
      <h1 className="text-base font-semibold text-white">{title ?? 'Dashboard'}</h1>
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