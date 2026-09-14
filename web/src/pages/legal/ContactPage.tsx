import { useState, type FormEvent } from 'react'
import { SEO } from '../../components/SEO'

export function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    // Form error states (ship-list)
    if (!name.trim()) return setError('Please enter your name.')
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Please enter a valid email address.')
    if (message.trim().length < 10) return setError('Message should be at least 10 characters.')
    setError(null)
    setSending(true)
    try {
      // mailto fallback — no backend endpoint to abuse on free tier
      window.location.href = `mailto:meridian.app.contact@gmail.com?subject=${encodeURIComponent(
        `Meridian contact — ${name.trim()}`
      )}&body=${encodeURIComponent(`${message.trim()}\n\nReply to: ${email.trim()}`)}`
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-8 py-10">
      <SEO
        title="Contact"
        description="Reach the Meridian team — bug reports, feature ideas, or questions about your data."
        path="/contact"
      />
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Get in touch</h1>
        <p className="text-sm text-white/45">Bug reports, feature ideas, data questions — all welcome.</p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6" noValidate>
        <div>
          <label htmlFor="name" className="mb-1.5 block text-xs font-semibold text-white/50">Name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#9BA5FF]/60 invalid:border-[#FF887D]/60"
            placeholder="Your name"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-white/50">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#9BA5FF]/60"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="message" className="mb-1.5 block text-xs font-semibold text-white/50">Message</label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-32 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#9BA5FF]/60"
            placeholder="What's on your mind?"
          />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-[#FF887D]/10 px-3 py-2 text-xs font-medium text-[#FF887D]">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={sending}
          className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
        >
          {sending ? 'Opening your mail app…' : 'Send message'}
        </button>
        <p className="text-center text-[11px] text-white/30">
          Opens your email app — nothing is stored on our servers.
        </p>
      </form>
    </div>
  )
}
