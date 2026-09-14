/**
 * CookieBanner — GDPR-friendly notice. Meridian sets no tracking cookies;
 * the banner informs and links to the privacy policy. Choice is remembered
 * in localStorage.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const KEY = 'meridian-cookie-ack'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(KEY)) setVisible(true)
    } catch {
      /* private mode */
    }
  }, [])

  const accept = () => {
    try {
      window.localStorage.setItem(KEY, '1')
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-2xl border border-white/12 bg-[#14141C]/95 p-4 shadow-2xl backdrop-blur-md sm:inset-x-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-xs leading-relaxed text-white/60">
          Meridian uses no advertising or tracking cookies — only your sign-in session.
          We keep it that way.{' '}
          <Link to="/privacy" className="text-[#9BA5FF] hover:underline">Privacy policy</Link>
        </p>
        <button
          onClick={accept}
          className="shrink-0 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-white/90"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
