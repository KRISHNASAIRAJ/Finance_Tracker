/**
 * StickyMobileCTA — above-the-fold action that follows the user on mobile.
 * Shows only on small screens; hidden on lg. Links to the primary action
 * (open the app / sign in).
 */
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function StickyMobileCTA() {
  const { user } = useAuth()
  const location = useLocation()

  // Don't nag on auth pages, legal pages, or when the user is in the app
  const quietRoutes = ['/login', '/signup', '/forgot-password', '/privacy', '/terms', '/contact', '/thank-you']
  if (quietRoutes.some((r) => location.pathname.startsWith(r))) return null
  if (user) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0A0A10]/95 p-3 backdrop-blur-md lg:hidden">
      <Link
        to="/login"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#9BA5FF] to-[#5EE6FF] py-3 text-sm font-bold text-black active:opacity-90"
      >
        Open my tracker →
      </Link>
    </div>
  )
}
