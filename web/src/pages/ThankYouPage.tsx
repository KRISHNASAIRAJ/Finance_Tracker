import { SEO } from '../components/SEO'

export function ThankYouPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <SEO
        title="Thank you"
        description="Message received — thank you for reaching out to Meridian."
        path="/thank-you"
        noIndex
      />
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#59D6C7] to-[#9BA5FF]">
        <svg className="h-8 w-8 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
          <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white">Thank you 🙌</h1>
        <p className="max-w-sm text-sm text-white/45">
          Your message is in. You'll hear back soon — meanwhile, your tracker is waiting.
        </p>
      </div>
      <a
        href="/"
        className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
      >
        Back to Meridian
      </a>
    </div>
  )
}
