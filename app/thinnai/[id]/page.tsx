'use client'

import { use, useEffect, useState } from 'react'
import { type Credentials, loadCredentials, saveCredentials } from '@/lib/client/use-thinnai'
import { ThinnaiRoom } from '@/components/thinnai-room'

export default function ThinnaiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [creds, setCreds] = useState<Credentials | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    setCreds(loadCredentials(id))
    setChecked(true)
  }, [id])

  if (!checked) return <Splash>Finding the thinnai…</Splash>
  if (!creds) return <JoinGate roomId={id} onJoined={(c) => setCreds(c)} />
  return <ThinnaiRoom roomId={id} creds={creds} />
}

function Splash({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <p className="font-serif text-lg italic text-muted-foreground">{children}</p>
    </main>
  )
}

function JoinGate({ roomId, onJoined }: { roomId: string; onJoined: (c: Credentials) => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function join() {
    if (!name.trim()) {
      setError('Enter your name first')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/thinnai/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? 'Could not join')
        return
      }
      const creds = { playerId: data.playerId, secret: data.secret }
      saveCredentials(roomId, creds)
      onJoined(creds)
    } catch {
      setError('Could not reach the server')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-8 px-4">
      <header className="text-center">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.35em] text-gold">You have been invited</p>
        <h1 className="font-serif text-5xl font-bold text-gold-soft">{roomId}</h1>
      </header>

      <div className="w-full rounded-2xl border border-border bg-secondary/50 p-6">
        <label htmlFor="join-name" className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Your name
        </label>
        <input
          id="join-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          maxLength={20}
          onKeyDown={(e) => e.key === 'Enter' && join()}
          className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-foreground outline-none focus:border-gold"
        />
        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}
        <button
          type="button"
          onClick={join}
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {busy ? 'Joining…' : 'Take a seat'}
        </button>
      </div>
    </main>
  )
}
