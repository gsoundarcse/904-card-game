'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { saveCredentials } from '@/lib/client/use-thinnai'
import { TEAM_NAME, teamOf } from '@/lib/game'

const SIZES = [
  { count: 4 as const, deck: '24-card deck', ranks: '2 · 3 · J · 9 · A · 10' },
  { count: 6 as const, deck: '36-card deck', ranks: '2 · 3 · J · 9 · A · 10 · K · Q · 8' },
]

export default function HomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomClosed = searchParams.get('closed') === '1'
  const [seatCount, setSeatCount] = useState<4 | 6>(4)
  const [name, setName] = useState('')
  const [seatRoles, setSeatRoles] = useState<('bot' | 'invite')[]>(Array(3).fill('bot'))
  const [customizing, setCustomizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function changeSeatCount(size: 4 | 6) {
    setSeatCount(size)
    setSeatRoles(Array(size - 1).fill('bot'))
  }

  function toggleSeat(index: number) {
    setSeatRoles((prev) => prev.map((role, i) => (i === index ? (role === 'bot' ? 'invite' : 'bot') : role)))
  }

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
        body: JSON.stringify({ seatCount, hostName: name, seatPlan: seatRoles }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? 'Could not create the thinnai')
        return
      }
      saveCredentials(data.roomId, { playerId: data.playerId, secret: data.secret })
      // All-bots quick path: every seat is already filled, so start the match
      // immediately instead of leaving the player on an empty lobby screen.
      if (invites === 0) {
        await fetch(`/api/thinnai/${data.roomId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: data.playerId, secret: data.secret, action: { type: 'start' } }),
        }).catch(() => {})
      }
      router.push(`/thinnai/${data.roomId}`)
    } catch {
      setError('Could not reach the server')
    } finally {
      setBusy(false)
    }
  }

  const invites = seatRoles.filter((role) => role === 'invite').length

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col items-center justify-center gap-2 px-3 py-3 sm:gap-8 sm:px-4 sm:py-12">
      {roomClosed && (
        <p className="w-full rounded-xl border border-destructive/60 bg-destructive/10 px-4 py-2.5 text-center text-sm text-destructive">
          That thinnai is closed or no longer exists.
        </p>
      )}
      <header className="text-center">
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.35em] text-gold sm:mb-2">Trick-Taking · Counter-Claim</p>
        <h1 className="text-balance font-serif text-4xl font-bold tracking-tight text-gold-soft sm:text-7xl">
          Thinnai
        </h1>
        <Link href="/results" className="mt-1 inline-block font-mono text-[11px] text-muted-foreground hover:text-gold sm:mt-3">
          See results & leaderboard
        </Link>
      </header>

      <div className="grid w-full gap-1.5 sm:gap-4 sm:grid-cols-2">
        {SIZES.map((s) => (
          <button
            key={s.count}
            type="button"
            onClick={() => changeSeatCount(s.count)}
            className={cn(
              'flex flex-col items-start gap-0.5 rounded-2xl border border-border bg-secondary/60 p-2.5 text-left transition-all hover:-translate-y-1 hover:border-gold sm:gap-1 sm:p-5',
              seatCount === s.count && 'border-gold bg-secondary',
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-serif text-xl font-bold text-gold-soft sm:text-3xl">{s.count} players</span>
              <span className="rounded-full border border-gold/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-gold">
                {s.deck}
              </span>
            </div>
            <span className="font-mono text-xs tracking-wide text-muted-foreground">{s.ranks}</span>
          </button>
        ))}
      </div>

      <section className="w-full rounded-2xl border border-border bg-secondary/40 p-2.5 sm:p-5">
        <div className="flex items-center gap-3">
          <label htmlFor="name" className="shrink-0 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Name
          </label>
          <input
            id="name"
            value={name}
            maxLength={20}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            placeholder="Soundar"
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold"
          />
        </div>

        <p className="mb-1.5 mt-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground sm:mb-2 sm:mt-5">
          {customizing ? `The other ${seatRoles.length} seats` : `You + ${seatRoles.length} bots`}
        </p>
        {customizing ? (
          <div className="grid gap-1.5 sm:gap-2 sm:grid-cols-2">
            {seatRoles.map((role, i) => {
              const seat = i + 1
              return (
                <div
                  key={seat}
                  className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-1.5 sm:py-2"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn('h-2 w-2 rounded-full', teamOf(seat) === 0 ? 'bg-team-a' : 'bg-team-b')}
                      aria-hidden
                    />
                    <span className="font-mono text-xs text-muted-foreground">
                      Seat {seat + 1} · {TEAM_NAME[teamOf(seat)]}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSeat(i)}
                    className={cn(
                      'rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors',
                      role === 'bot' ? 'bg-secondary text-foreground' : 'bg-gold/15 text-gold',
                    )}
                  >
                    {role === 'bot' ? 'Bot' : 'Invite a person'}
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCustomizing(true)}
            className="font-mono text-[11px] text-muted-foreground underline decoration-dotted hover:text-gold"
          >
            Want to invite friends instead? Customize seats
          </button>
        )}

        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="mt-3 w-full rounded-xl bg-gold px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-40 sm:mt-5 sm:py-3"
        >
          {busy ? 'Creating…' : invites > 0 ? 'Create thinnai & get invite link' : `Play now — you + ${seatRoles.length} bots`}
        </button>
        {error && <p className="mt-3 text-center font-mono text-[11px] text-destructive">{error}</p>}
      </section>

      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
        <li>2 = 100</li>
        <li>3 = 50</li>
        <li>J = 30</li>
        <li>9 = 20</li>
        <li>A = 11</li>
        <li>10 = 10</li>
        <li>K = 3</li>
        <li>Q = 2</li>
        <li>8 = 0</li>
      </ul>
    </main>
  )
}
