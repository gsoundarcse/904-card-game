import { RegisterForm } from '@/components/auth/register-form'

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-8 px-4 py-12">
      <header className="text-center">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.35em] text-gold">Join in</p>
        <h1 className="font-serif text-5xl font-bold tracking-tight text-gold-soft">Create account</h1>
      </header>
      <RegisterForm />
    </main>
  )
}
