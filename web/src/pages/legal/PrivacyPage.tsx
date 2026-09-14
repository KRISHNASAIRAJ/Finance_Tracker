import { Link } from 'react-router-dom'
import { SEO } from '../../components/SEO'

export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-10">
      <SEO
        title="Privacy Policy"
        description="How Meridian stores, syncs, and protects your personal data — Supabase-hosted, RLS-isolated, no third-party trackers."
        path="/privacy"
      />
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Privacy Policy</h1>
        <p className="text-sm text-white/40">Last updated: September 2026</p>
      </div>

      <div className="space-y-8 text-sm leading-relaxed text-white/70">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">What Meridian stores</h2>
          <p>
            Meridian is a personal life tracker. It stores the data you enter: transactions,
            tasks, vehicle logs, investment holdings, meals, sleep and habit logs, notes, and
            diary entries. All data is scoped to your account via Postgres Row-Level Security —
            no other user, and no anonymous visitor, can read it.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">Where data lives</h2>
          <p>
            Data is stored in a Supabase (PostgreSQL) database in the cloud and cached locally
            on your devices for offline use. Your edits sync through an encrypted (HTTPS)
            connection when you come online.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">AI features</h2>
          <p>
            Optional AI insights (sleep, finance notes, meal analysis) send a small snapshot of
            your own data to a Groq-hosted model via a serverless function. Data is processed
            transiently to produce the insight and is not used to train models. You can avoid
            AI features entirely — everything else works without them.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">Cookies &amp; tracking</h2>
          <p>
            Meridian uses no advertising cookies, no third-party analytics trackers, and no
            fingerprinting. The only local storage is your session token (to keep you signed
            in) and your app preferences.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">Your control</h2>
          <p>
            You can export or delete your data at any time from Settings inside the app.
            Deleting your account removes all rows owned by your user id.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">Contact</h2>
          <p>
            Questions about this policy? Reach out from the{' '}
            <Link to="/contact" className="text-[#9BA5FF] hover:underline">contact page</Link>.
          </p>
        </section>
      </div>

      <div className="pt-4 text-center">
        <Link to="/" className="text-sm text-white/40 hover:text-white">← Back to Meridian</Link>
      </div>
    </div>
  )
}
