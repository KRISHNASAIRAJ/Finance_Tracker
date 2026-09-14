/**
 * useLocalAnalytics — privacy-safe, cookieless page-view counter.
 * Stores aggregate counts in localStorage only (no third-party calls,
 * no IPs, no fingerprints). Good enough to answer "is this page used?"
 * without shipping user data anywhere.
 */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const KEY = 'meridian-pv'

interface Counts {
  [path: string]: number
}

function read(): Counts {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Counts
  } catch {
    return {}
  }
}

export function useLocalAnalytics() {
  const location = useLocation()

  useEffect(() => {
    try {
      const counts = read()
      counts[location.pathname] = (counts[location.pathname] ?? 0) + 1
      window.localStorage.setItem(KEY, JSON.stringify(counts))
    } catch {
      /* storage unavailable */
    }
  }, [location.pathname])
}

/** Read the aggregate (for a future settings/debug view). */
export function getPageViewCounts(): Counts {
  return read()
}
