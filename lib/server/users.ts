import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/server/db'

export interface UserRecord {
  id: string
  username: string
  passwordHash: string
  createdAt: string
}

const SCRYPT_KEY_LENGTH = 64

function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const derived = scryptSync(password, salt, SCRYPT_KEY_LENGTH)
  return `${salt.toString('hex')}:${derived.toString('hex')}`
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [saltHex, keyHex] = storedHash.split(':')
  if (!saltHex || !keyHex) return false
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(keyHex, 'hex')
  const actual = scryptSync(password, salt, SCRYPT_KEY_LENGTH)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

export function findUserByUsername(username: string): UserRecord | undefined {
  const row = db
    .prepare('SELECT id, username, password_hash AS passwordHash, created_at AS createdAt FROM users WHERE username = ?')
    .get(normalizeUsername(username)) as UserRecord | undefined
  return row
}

export function createUser(username: string, password: string): UserRecord {
  const normalized = normalizeUsername(username)
  if (findUserByUsername(normalized)) {
    throw new Error('That username is already taken.')
  }
  const user: UserRecord = {
    id: randomUUID(),
    username: normalized,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  }
  db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
    user.id,
    user.username,
    user.passwordHash,
    user.createdAt,
  )
  return user
}

export function verifyCredentials(username: string, password: string): UserRecord | null {
  const user = findUserByUsername(username)
  if (!user || !verifyPassword(password, user.passwordHash)) return null
  return user
}

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000

/** Returns null if there's no account for that username — callers should still show a generic success message. */
export function createPasswordResetToken(username: string): string | null {
  const user = findUserByUsername(username)
  if (!user) return null
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString()
  db.prepare('INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    user.id,
    expiresAt,
  )
  return token
}

export function resetPasswordWithToken(token: string, newPassword: string): boolean {
  const row = db
    .prepare('SELECT user_id AS userId, expires_at AS expiresAt FROM password_reset_tokens WHERE token = ?')
    .get(token) as { userId: string; expiresAt: string } | undefined
  if (!row || new Date(row.expiresAt).getTime() < Date.now()) return false
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), row.userId)
  db.prepare('DELETE FROM password_reset_tokens WHERE token = ?').run(token)
  return true
}
