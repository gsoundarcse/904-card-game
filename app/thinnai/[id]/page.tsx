'use client'

import { use, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { TEAM_NAME } from '@/lib/game'
import { type Credentials, loadCredentials, saveCredentials } from '@/lib/client/use-thinnai'
import { ThinnaiRoom } from '@/components/thinnai-room'

interface LobbyPreview {
  roomId: string
  seatCount: number
  status: string
  seats: { seat: number; team: 0 | 1; taken: boolean; name?: string; isBot: boolean }[]
}

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
  const [preview, setPreview] = useState<LobbyPreview | null>(null)
  const [seat, setSeat] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let stopped = false
    async function poll() {
      while (!stopped) {
        try {
          const res = await fetch(`/api/thinnai/${roomId}/join`, { cache: 'no-store' })
          if (res.ok) {
            const data: LobbyPreview = await res.json()
            if (!stopped) {
              setPreview(data)
              setSeat((current) => {
                if (current !== null && !data.seats.find((s) => s.seat === current)?.taken) return current
                return data.seats.find((s) => !s.taken)?.seat ?? current
              })
            }
          }
        } catch {
          // Network blip — keep polling.
        }
        await new Promise((r) => setTimeout(r, 1500))
      }
    }
    poll()
    return () => {
      stopped = true
    }
  }, [roomId])

  async function join() {
    if (!name.trim()) {
      setError('Enter your name first')
      return
    }
    if (seat === null) {
      setError('Pick an open seat')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/thinnai/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, seat }),
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
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-8 px-4 py-10">
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

        {preview && (
          <>
            <p className="mb-2 mt-5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Pick your seat & side
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {preview.seats.map((s) => (
                <button
                  key={s.seat}
                  type="button"
                  disabled={s.taken}
                  onClick={() => {
                    setSeat(s.seat)
                    setError(null)
                  }}
                  className={cn(
                    'flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors',
                    s.taken
                      ? 'cursor-not-allowed border-dashed border-border/60 opacity-50'
                      : seat === s.seat
                        ? 'border-gold bg-gold/10'
                        : 'border-border bg-background/60 hover:border-gold/50',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className={cn('h-2.5 w-2.5 rounded-full', s.team === 0 ? 'bg-team-a' : 'bg-team-b')} aria-hidden />
                    <span className="text-sm text-foreground">
                      {s.taken ? (s.name ?? 'taken') : `Seat ${s.seat + 1}`}
                    </span>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {TEAM_NAME[s.team]}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}
        <button
          type="button"
          onClick={join}
          disabled={busy || seat === null}
          className="mt-5 w-full rounded-xl bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {busy ? 'Joining…' : 'Take a seat'}
        </button>
      </div>
    </main>
  )
}
