'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { saveCredentials } from '@/lib/client/use-thinnai'

export default function CreateThinnaiPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [seatCount, setSeatCount] = useState<4 | 6>(4)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function create() {
    if (!name.trim()) {
      setError('Enter your name first')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/thinnai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatCount, hostName: name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? 'Could not create the thinnai')
        return
      }
      saveCredentials(data.roomId, { playerId: data.playerId, secret: data.secret })
      router.push(`/thinnai/${data.roomId}`)
    } catch {
      setError('Could not reach the server')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col items-center justify-center gap-8 px-4 py-12">
      <header className="text-center">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.35em] text-gold">Gather · Play</p>
        <h1 className="font-serif text-6xl font-bold tracking-tight text-gold-soft">Thinnai</h1>
        <p className="mx-auto mt-4 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          Open a thinnai, send the link to your people, and play 904 from wherever you each are.
        </p>
      </header>

      <div className="w-full rounded-2xl border border-border bg-secondary/50 p-6">
        <label htmlFor="name" className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Your name
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          maxLength={20}
          placeholder="Soundar"
          className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-foreground outline-none focus:border-gold"
        />

        <p className="mb-2 mt-5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Table size</p>
        <div className="grid grid-cols-2 gap-3">
          {([4, 6] as const).map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setSeatCount(count)}
              className={cn(
                'rounded-xl border px-4 py-3 text-left transition-colors',
                seatCount === count ? 'border-gold bg-gold/10' : 'border-border bg-background/40 hover:border-gold/50',
              )}
            >
              <span className="block font-serif text-2xl font-bold text-gold-soft">{count}</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {count === 4 ? '24 cards · 5 to lose' : '36 cards · 7 to lose'}
              </span>
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}

        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="mt-6 w-full rounded-xl bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {busy ? 'Opening…' : 'Open the thinnai'}
        </button>
      </div>

      <a href="/" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-gold">
        or play pass-and-play on one device
      </a>
    </main>
  )
}
