'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: error.message, digest: error.digest }),
      keepalive: true,
    }).catch(() => {})
  }, [error])

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 text-center text-foreground">
      <div>
        <h1 className="font-serif text-3xl font-bold text-gold-soft">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">The error was recorded. Please try again.</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-5 rounded-xl bg-gold px-5 py-3 text-sm font-bold text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </main>
  )
}
