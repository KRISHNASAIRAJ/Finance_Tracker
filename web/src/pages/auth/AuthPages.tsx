/**
 * Auth pages — Login, Signup, Forgot Password (Supabase email+password).
 */
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm fade-up">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
            <span className="text-sm font-bold text-black">M</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{title}</h1>
            <p className="text-sm text-white/40">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await signIn(email, password)
    setLoading(false)
    if (res.error) {
      setError(res.error)
      return
    }
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    navigate(from, { replace: true })
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your Meridian">
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="current-password"
        />
        {error && <p className="text-sm text-[#FF887D]">{error}</p>}
        <Button type="submit" className="w-full" loading={loading}>
          Sign in
        </Button>
        <div className="flex items-center justify-between text-sm">
          <Link to="/signup" className="text-white/50 transition-colors hover:text-white">
            Create account
          </Link>
          <Link to="/forgot-password" className="text-white/50 transition-colors hover:text-white">
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}

export function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    const res = await signUp(email, password)
    setLoading(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setMessage('Account created! Check your email to confirm, then sign in.')
    setTimeout(() => navigate('/login'), 2500)
  }

  return (
    <AuthLayout title="Create account" subtitle="Same account as the mobile app">
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          required
          minLength={6}
          autoComplete="new-password"
        />
        {error && <p className="text-sm text-[#FF887D]">{error}</p>}
        {message && <p className="text-sm text-[#59D6C7]">{message}</p>}
        <Button type="submit" className="w-full" loading={loading}>
          Sign up
        </Button>
        <p className="text-center text-sm text-white/50">
          Already have an account?{' '}
          <Link to="/login" className="text-white transition-colors hover:text-white/80">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    const res = await resetPassword(email)
    setLoading(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setMessage('Password reset link sent — check your email.')
  }

  return (
    <AuthLayout title="Reset password" subtitle="We'll email you a reset link">
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        {error && <p className="text-sm text-[#FF887D]">{error}</p>}
        {message && <p className="text-sm text-[#59D6C7]">{message}</p>}
        <Button type="submit" className="w-full" loading={loading}>
          Send reset link
        </Button>
        <p className="text-center text-sm text-white/50">
          <Link to="/login" className="text-white transition-colors hover:text-white/80">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}