import { Link } from 'react-router-dom'
import { SEO } from '../../components/SEO'

export function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-10">
      <SEO
        title="Terms of Service"
        description="Terms for using Meridian — a personal-use life tracker. Provided as-is, your data is yours, be kind to the free tiers."
        path="/terms"
      />
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Terms of Service</h1>
        <p className="text-sm text-white/40">Last updated: September 2026</p>
      </div>

      <div className="space-y-8 text-sm leading-relaxed text-white/70">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">1. What Meridian is</h2>
          <p>
            Meridian is a personal-use life tracker (finance, garage, tasks, wealth, meals,
            sleep, habits, notes, career). It is built and operated for personal use; there is
            no service-level agreement.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">2. Your data, your rights</h2>
          <p>
            All content you create belongs to you. You may export or delete it at any time from
            Settings. We never sell, share, or mine your data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">3. Acceptable use</h2>
          <p>
            Meridian runs on free-tier infrastructure. Do not use it for spam, automated bulk
            writes, or any illegal activity. Abuse may lead to suspension without notice.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">4. AI features</h2>
          <p>
            AI insights are informational only — they are not financial, medical, or legal
            advice. Verify anything important before acting on it.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">5. No warranty</h2>
          <p>
            Meridian is provided "as is" and "as available". While we take data integrity
            seriously (offline queue, signed sync, daily backups), we cannot guarantee
            uninterrupted availability or absolute data loss prevention. Keep your own exports
            for anything irreplaceable.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">6. Changes</h2>
          <p>
            These terms may be updated as the app evolves. Material changes will be surfaced in
            the app. Continued use after an update means acceptance.
          </p>
        </section>
      </div>

      <div className="pt-4 text-center">
        <Link to="/" className="text-sm text-white/40 hover:text-white">← Back to Meridian</Link>
      </div>
    </div>
  )
}
