'use server'

import { AuthError } from 'next-auth'
import { signIn } from '@/auth'
import { createUser, normalizeUsername } from '@/lib/server/users'

export interface RegisterState {
  error?: string
}

export async function registerAction(_prevState: RegisterState, formData: FormData): Promise<RegisterState> {
  const username = normalizeUsername(String(formData.get('username') ?? ''))
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')

  if (username.length < 3) return { error: 'Username must be at least 3 characters.' }
  if (!/^[a-z0-9_.-]+$/.test(username)) return { error: 'Username can only contain letters, numbers, . _ and -.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (password !== confirmPassword) return { error: 'Passwords do not match.' }

  try {
    createUser(username, password)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not create account.' }
  }

  try {
    await signIn('credentials', { username, password, redirectTo: '/' })
  } catch (err) {
    // signIn throws a redirect on success — only report actual auth failures.
    if (err instanceof AuthError) return { error: 'Account created, but sign-in failed. Try logging in.' }
    throw err
  }
  return {}
}
