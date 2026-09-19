'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { cn } from '@/lib/utils'

export function LoginForm({ facebookEnabled }: { facebookEnabled: boolean }) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const result = await signIn('credentials', { username, password, redirect: false })
    setBusy(false)
    if (result?.error) {
      setError('Incorrect username or password.')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="w-full rounded-2xl border border-border bg-secondary/50 p-6">
      <label htmlFor="username" className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        Username
      </label>
      <input
        id="username"
        name="username"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-foreground outline-none focus:border-gold"
      />

      <label
        htmlFor="password"
        className="mb-2 mt-5 block font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
      >
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-foreground outline-none focus:border-gold"
      />
      <div className="mt-2 text-right">
        <Link href="/forgot-password" className="font-mono text-[11px] text-muted-foreground hover:text-gold">
          Forgot password?
        </Link>
      </div>

      {error && <p className="mt-3 font-mono text-[11px] text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={busy || !username || !password}
        className="mt-5 w-full rounded-xl bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-40"
      >
        {busy ? 'Signing in…' : 'Log in'}
      </button>

      <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground/70">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        type="button"
        disabled={!facebookEnabled}
        title={facebookEnabled ? undefined : 'Facebook login is coming soon'}
        className={cn(
          'w-full rounded-xl border border-border px-6 py-3 text-sm font-bold uppercase tracking-wide transition-colors',
          facebookEnabled
            ? 'text-foreground hover:border-gold hover:text-gold'
            : 'cursor-not-allowed text-muted-foreground/50',
        )}
        onClick={facebookEnabled ? () => signIn('facebook') : undefined}
      >
        Continue with Facebook{!facebookEnabled && ' (coming soon)'}
      </button>

      <p className="mt-5 text-center font-mono text-[11px] text-muted-foreground">
        No account?{' '}
        <Link href="/register" className="text-gold hover:underline">
          Create one
        </Link>
      </p>
    </form>
  )
}
