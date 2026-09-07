'use client'

import { cn } from '@/lib/utils'
import { SUIT_SYMBOL, type Suit, TEAM_NAME } from '@/lib/game'

export function Scoreboard({
  teamScores,
  targetPoints,
  claimerName,
  claimerTeam,
  claim,
  trumpSuit,
  trumpRevealed,
  phaseLabel,
  onReset,
}: {
  teamScores: [number, number]
  targetPoints: number
  claimerName: string | null
  claimerTeam: 0 | 1 | null
  claim: number
  trumpSuit: Suit | null
  trumpRevealed: boolean
  phaseLabel: string
  onReset: () => void
}) {
  return (
    <div className="flex flex-wrap items-stretch justify-between gap-3">
      <div className="flex items-center gap-3">
        {([0, 1] as const).map((t) => (
          <div
            key={t}
            className={cn(
              'flex min-w-24 flex-col rounded-xl border px-4 py-2 shadow-lg',
              t === 0 ? 'border-team-a/50 bg-team-a/10' : 'border-team-b/50 bg-team-b/10',
              claimerTeam === t && 'ring-2 ring-gold',
            )}
          >
            <span className={cn('text-[10px] font-semibold uppercase tracking-widest', t === 0 ? 'text-team-a' : 'text-team-b')}>
              {TEAM_NAME[t]}
            </span>
            <span className="font-serif text-3xl font-bold leading-none text-foreground">
              {teamScores[t]}<span className="ml-1 font-mono text-xs font-normal text-muted-foreground">/ {targetPoints}</span>
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              {targetPoints - teamScores[t]} pending
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
        <div className="flex flex-col items-end">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Phase</span>
          <span className="text-sm font-semibold text-foreground">{phaseLabel}</span>
        </div>

        {claimerName && (
          <div className="flex flex-col items-end border-l border-border pl-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Claim</span>
            <span className="text-sm font-semibold text-foreground">
              {claimerName} &middot; <span className="text-gold">{claim}</span>
            </span>
          </div>
        )}

        <div className="flex flex-col items-end border-l border-border pl-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Trump</span>
          <span className="text-sm font-semibold text-foreground">
            {!trumpSuit ? (
              '—'
            ) : trumpRevealed ? (
              <span className="inline-flex items-center gap-1">
                <span className={cn((trumpSuit === 'Hearts' || trumpSuit === 'Diamonds') && 'text-suit-red')}>
                  {SUIT_SYMBOL[trumpSuit]} {trumpSuit}
                </span>
              </span>
            ) : (
              <span className="text-gold">Hidden ?</span>
            )}
          </span>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-gold hover:text-gold"
        >
          New Game
        </button>
      </div>
    </div>
  )
}
