'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { requestPasswordResetAction, type ForgotPasswordState } from '@/app/forgot-password/actions'

const initialState: ForgotPasswordState = {}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initialState)

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

      {state.error && <p className="mt-3 font-mono text-[11px] text-destructive">{state.error}</p>}
      {state.message && <p className="mt-3 font-mono text-[11px] text-gold-soft">{state.message}</p>}
      {state.devResetUrl && (
        <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
          Dev mode (no email provider wired up yet):{' '}
          <Link href={state.devResetUrl} className="text-gold hover:underline">
            {state.devResetUrl}
          </Link>
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 w-full rounded-xl bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-40"
      >
        {pending ? 'Sending…' : 'Send reset link'}
      </button>

      <p className="mt-5 text-center font-mono text-[11px] text-muted-foreground">
        <Link href="/login" className="text-gold hover:underline">
          Back to login
        </Link>
      </p>
    </form>
  )
}
