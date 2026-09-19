import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-8 px-4 py-12">
      <header className="text-center">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.35em] text-gold">Reset access</p>
        <h1 className="font-serif text-5xl font-bold tracking-tight text-gold-soft">Choose a new password</h1>
      </header>
      <ResetPasswordForm token={token} />
    </main>
  )
}
