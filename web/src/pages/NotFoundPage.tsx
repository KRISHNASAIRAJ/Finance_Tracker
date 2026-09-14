import { Link } from 'react-router-dom'
import { SEO } from '../components/SEO'

export function NotFoundPage() {
  return (
    <>
      <SEO
        title="Page not found"
        description="The page you were looking for doesn't exist in Meridian."
        noIndex
      />
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#9BA5FF] to-[#5EE6FF]">
          <span className="text-2xl font-extrabold text-black">404</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">This page drifted off course</h1>
          <p className="max-w-sm text-sm text-white/45">
            The link may be old, or the page may have moved. Your data is safe — head back
            to your dashboard.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Back to Home
          </Link>
          <Link
            to="/more"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
          >
            All modules
          </Link>
        </div>
      </div>
    </>
  )
}
