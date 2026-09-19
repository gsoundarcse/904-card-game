'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { resetPasswordAction, type ResetPasswordState } from '@/app/reset-password/[token]/actions'

const initialState: ResetPasswordState = {}

export function ResetPasswordForm({ token }: { token: string }) {
  const action = resetPasswordAction.bind(null, token)
  const [state, formAction, pending] = useActionState(action, initialState)

  if (state.success) {
    return (
      <div className="w-full rounded-2xl border border-border bg-secondary/50 p-6 text-center">
        <p className="font-mono text-sm text-gold-soft">Password updated. You can log in now.</p>
        <Link
          href="/login"
          className="mt-5 inline-block rounded-xl bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5"
        >
          Log in
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="w-full rounded-2xl border border-border bg-secondary/50 p-6">
      <label htmlFor="password" className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        New password
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
        Confirm new password
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
        {pending ? 'Updating…' : 'Update password'}
      </button>
    </form>
  )
}
