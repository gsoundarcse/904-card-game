'use client'

import { cn } from '@/lib/utils'
import { useState } from 'react'

const OPTIONS = [
  {
    game: '904',
    enabled: true,
    count: 4,
    deck: '24-card deck',
    ranks: '2 · 3 · J · 9 · A · 10',
    blurb: 'Classic short deck. Every card carries points.',
  },
  {
    game: 'Rani',
    enabled: false,
    count: 6,
    deck: 'Coming soon',
    ranks: 'A new thinnai game',
    blurb: 'This game will be available soon.',
  },
] as const

export function ConfigMenu({ onStart }: { onStart: (count: number, names: string[], solo: boolean) => void }) {
  const [count, setCount] = useState(4)
  const [solo, setSolo] = useState(false)
  const [names, setNames] = useState(['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6'])

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-4xl flex-col items-center justify-center gap-10 px-4 py-12">
      <header className="text-center">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.35em] text-gold">Trick-Taking · Counter-Claim</p>
        <h1 className="text-balance font-serif text-6xl font-bold tracking-tight text-gold-soft sm:text-7xl">
          Thinnai
        </h1>
        <p className="mx-auto mt-4 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
          Choose a game, gather everyone around, and let the thinnai decide who takes the tricks.
        </p>
      </header>

      <div className="grid w-full gap-5 sm:grid-cols-2">
        {OPTIONS.filter((opt) => opt.enabled).map((opt) => (
          <button
            key={opt.count}
            type="button"
            onClick={() => setCount(opt.count)}
            className={cn(
              'group flex min-w-0 flex-col items-start gap-3 rounded-2xl border border-border bg-secondary/60 p-5 text-left sm:p-6',
              'cursor-pointer',
              count === opt.count && 'border-gold bg-secondary',
              'transition-all hover:-translate-y-1 hover:border-gold hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-serif text-4xl font-bold text-gold-soft">{opt.game}</span>
              <span className="rounded-full border border-gold/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-gold">
                {opt.deck}
              </span>
            </div>
            <span className="text-lg font-semibold text-foreground">Card game</span>
            <span className="break-words font-mono text-xs tracking-wide text-muted-foreground">{opt.ranks}</span>
            <span className="text-sm leading-relaxed text-muted-foreground">{opt.blurb}</span>
            <span className="mt-2 text-sm font-semibold text-gold transition-transform group-hover:translate-x-1">
              Set up 904 →
            </span>
          </button>
        ))}
      </div>

      <section className="w-full rounded-2xl border border-border bg-secondary/40 p-5">
        <h2 className="font-serif text-xl font-bold text-gold-soft">Player names</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {names.slice(0, solo ? 1 : count).map((name, index) => (
            <label key={index} className="flex items-center gap-3">
              <span className="w-16 font-mono text-xs uppercase tracking-widest text-muted-foreground">P{index + 1}</span>
              <input
                value={name}
                maxLength={20}
                onChange={(event) => setNames((current) => current.map((item, i) => (i === index ? event.target.value : item)))}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
                placeholder={`Player ${index + 1}`}
              />
            </label>
          ))}
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-team-b/40 bg-team-b/10 px-3 py-3 text-sm text-foreground">
          <input type="checkbox" checked={solo} onChange={(event) => setSolo(event.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
          <span>Play solo against 3 bots</span>
        </label>
        <button
          type="button"
          onClick={() => onStart(count, names.slice(0, solo ? 1 : count).map((name, index) => name.trim() || `Player ${index + 1}`), solo)}
          className="mt-5 w-full rounded-xl bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5"
        >
          Deal the cards
        </button>
      </section>

      <a
        href="/thinnai"
        className="rounded-xl border border-gold/50 px-6 py-3 text-sm font-bold uppercase tracking-wide text-gold transition-colors hover:bg-gold/10"
      >
        Play online at a thinnai &rarr;
      </a>

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
    </div>
  )
}
