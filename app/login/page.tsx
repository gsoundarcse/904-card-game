import { LoginForm } from '@/components/auth/login-form'
import { FACEBOOK_LOGIN_ENABLED } from '@/lib/feature-flags'

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-8 px-4 py-12">
      <header className="text-center">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.35em] text-gold">Welcome back</p>
        <h1 className="font-serif text-5xl font-bold tracking-tight text-gold-soft">Log in</h1>
      </header>
      <LoginForm facebookEnabled={FACEBOOK_LOGIN_ENABLED} />
    </main>
  )
}
