'use server'

import { EMAIL_DELIVERY_ENABLED } from '@/lib/feature-flags'
import { createPasswordResetToken, normalizeUsername } from '@/lib/server/users'

export interface ForgotPasswordState {
  error?: string
  message?: string
  devResetUrl?: string
}

export async function requestPasswordResetAction(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const username = normalizeUsername(String(formData.get('username') ?? ''))
  if (!username) return { error: 'Enter your username.' }

  const token = createPasswordResetToken(username)
  // Same message whether or not the account exists, so the form can't be used
  // to probe which usernames are registered.
  const message = "If that account exists, we've sent a reset link."
  if (!token) return { message }

  if (EMAIL_DELIVERY_ENABLED) {
    // TODO: send via a real provider once AUTH_EMAIL_ENABLED=true. Wire it in
    // lib/server/mailer.ts — do not also return devResetUrl below once this
    // path is live, since that would leak account existence to the caller.
    throw new Error('AUTH_EMAIL_ENABLED is on but no email provider is wired up yet.')
  }

  const devResetUrl = `/reset-password/${token}`
  console.log(`[password reset] ${username} -> ${devResetUrl}`)
  return { message, devResetUrl }
}
