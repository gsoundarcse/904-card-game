// Wiring for features that aren't fully hooked up yet. Flip the env var to
// turn one on once real credentials/providers are ready — code paths already
// exist, they just stay dark while the flag is off.

function flag(name: string): boolean {
  return process.env[name] === 'true'
}

/** Facebook OAuth needs a real App ID/Secret from developers.facebook.com. */
export const FACEBOOK_LOGIN_ENABLED = flag('AUTH_FACEBOOK_ENABLED')

/** Password-reset emails need a real provider (e.g. Resend/SendGrid) wired in lib/server/mailer.ts. */
export const EMAIL_DELIVERY_ENABLED = flag('AUTH_EMAIL_ENABLED')
