'use server'

import { resetPasswordWithToken } from '@/lib/server/users'

export interface ResetPasswordState {
  error?: string
  success?: boolean
}

export async function resetPasswordAction(
  token: string,
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')

  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (password !== confirmPassword) return { error: 'Passwords do not match.' }

  const ok = resetPasswordWithToken(token, password)
  if (!ok) return { error: 'This reset link is invalid or has expired.' }
  return { success: true }
}
