'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { registerAction, type RegisterState } from '@/app/register/actions'

const initialState: RegisterState = {}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initialState)

  return (
    <form action={action} className="w-full rounded-2xl border border-border bg-secondary/50 p-6">
      <label htmlFor="username" className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        Username
      </label>
      <input
        id="username"
        name="username"
        autoComplete="username"
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
        autoComplete="new-password"
        className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-foreground outline-none focus:border-gold"
      />

      <label
        htmlFor="confirmPassword"
        className="mb-2 mt-5 block font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
      >
        Confirm password
      </label>
      <input
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-foreground outline-none focus:border-gold"
      />

      {state.error && <p className="mt-3 font-mono text-[11px] text-destructive">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 w-full rounded-xl bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-40"
      >
        {pending ? 'Creating account…' : 'Create account'}
      </button>

      <p className="mt-5 text-center font-mono text-[11px] text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="text-gold hover:underline">
          Log in
        </Link>
      </p>
    </form>
  )
}
