'use client'

import { cn } from '@/lib/utils'
import { MAX_CLAIM } from '@/lib/game'

const OPTIONS = [
  {
    count: 4,
    deck: '24-card deck',
    ranks: '2 · 3 · J · 9 · A · 10',
    blurb: 'Classic short deck. Every card carries points.',
  },
  {
    count: 6,
    deck: '36-card deck',
    ranks: '2 · 3 · J · 9 · A · 10 · K · Q · 8',
    blurb: 'Adds K, Q and 8 for the full 904-point spread.',
  },
] as const

export function ConfigMenu({ onStart }: { onStart: (count: number) => void }) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-4xl flex-col items-center justify-center gap-10 px-4 py-12">
      <header className="text-center">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.35em] text-gold">Trick-Taking · Counter-Claim</p>
        <h1 className="text-balance font-serif text-6xl font-bold tracking-tight text-gold-soft sm:text-7xl">
          Nine·Oh·Four
        </h1>
        <p className="mx-auto mt-4 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
          Bid your way to the claim, hide your trump, and take the tricks. First team to secure their claim toward the
          strict {MAX_CLAIM}-point target wins the hand.
        </p>
      </header>

      <div className="grid w-full gap-5 sm:grid-cols-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.count}
            type="button"
            onClick={() => onStart(opt.count)}
            className={cn(
              'group flex flex-col items-start gap-3 rounded-2xl border border-border bg-secondary/60 p-6 text-left',
              'transition-all hover:-translate-y-1 hover:border-gold hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-serif text-4xl font-bold text-gold-soft">{opt.count}</span>
              <span className="rounded-full border border-gold/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-gold">
                {opt.deck}
              </span>
            </div>
            <span className="text-lg font-semibold text-foreground">{opt.count} Players</span>
            <span className="font-mono text-xs tracking-wide text-muted-foreground">{opt.ranks}</span>
            <span className="text-sm leading-relaxed text-muted-foreground">{opt.blurb}</span>
            <span className="mt-2 text-sm font-semibold text-gold transition-transform group-hover:translate-x-1">
              Deal the cards &rarr;
            </span>
          </button>
        ))}
      </div>

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
