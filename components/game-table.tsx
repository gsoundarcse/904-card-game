'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { type Card, type Suit, type TrickPlay } from '@/lib/game'
import { CardBack, CardFace, MysteryCard } from '@/components/playing-card'

export interface SeatView {
  name: string
  team: 0 | 1
  handCount: number
  isCurrent: boolean
  isClaimer: boolean
  isShuffler: boolean
  status?: string
}

/** Even seats placed around an ellipse, seat 0 anchored at the bottom. */
function seatPosition(index: number, total: number) {
  const angle = (Math.PI / 2) + (index / total) * Math.PI * 2
  const x = 50 + Math.cos(angle) * 43
  const y = 50 + Math.sin(angle) * 40
  return { left: `${x}%`, top: `${y}%` }
}

function Seat({ seat }: { seat: SeatView }) {
  return (
    <div
      className={cn(
        'flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 rounded-xl border bg-felt-dark/70 px-2 py-2 text-center backdrop-blur-sm transition-all',
        seat.isCurrent ? 'border-gold shadow-[0_0_0_2px_var(--gold)]' : 'border-border/60',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn('h-2 w-2 rounded-full', seat.team === 0 ? 'bg-team-a' : 'bg-team-b')} aria-hidden />
        <span className="truncate text-xs font-semibold text-foreground">{seat.name}</span>
      </div>

      <div className="flex h-8 items-center justify-center">
        {seat.handCount > 0 ? (
          <div className="flex">
            {Array.from({ length: seat.handCount }).map((_, i) => (
              <div key={i} className={cn(i > 0 && '-ml-4')}>
                <CardBack size="sm" className="h-8 w-6" />
              </div>
            ))}
          </div>
        ) : (
          <span className="font-mono text-[10px] text-muted-foreground">empty</span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1">
        {seat.isClaimer && (
          <span className="rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
            Claimer
          </span>
        )}
        {seat.isShuffler && (
          <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Dealer
          </span>
        )}
        {seat.status && (
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
              seat.status === 'Passed'
                ? 'bg-destructive/20 text-destructive'
                : seat.isCurrent
                  ? 'bg-gold/20 text-gold'
                  : 'border border-border text-muted-foreground',
            )}
          >
            {seat.status}
          </span>
        )}
      </div>
    </div>
  )
}

export function GameTable({
  seats,
  trick,
  trumpSuit,
  trumpCard,
  trumpRevealed,
  trumpPlaced,
  banner,
}: {
  seats: SeatView[]
  trick: TrickPlay[]
  trumpSuit: Suit | null
  trumpCard?: Card | null
  trumpRevealed: boolean
  /**
   * True once a trump card is lying face down. Online, other players are not
   * told the suit, so `trumpSuit` is null for them — without this the indicator
   * would vanish for everyone but the claimer.
   */
  trumpPlaced?: boolean
  banner: string | null
}) {
  const [trumpDismissed, setTrumpDismissed] = useState(false)
  const displayTrumpCard: Card | null = trumpCard ?? (trumpSuit ? { id: 'trump', suit: trumpSuit, rank: 'A', points: 0 } : null)
  const showTrump = trumpPlaced ?? trumpSuit !== null
  const showTrumpIndicator = showTrump && (!trumpRevealed || !trumpDismissed)

  useEffect(() => {
    if (!trumpRevealed) setTrumpDismissed(false)
  }, [trumpRevealed])

  return (
    <div className="relative mx-auto h-[440px] w-full max-w-3xl sm:h-[560px]">
      {/* felt surface */}
      <div className="absolute inset-6 rounded-[45%] border-4 border-gold/30 bg-felt shadow-[inset_0_0_80px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-4 rounded-[45%] border border-felt-line/60" />
      </div>

      {/* trump indicator */}
      {showTrumpIndicator && (
        <div className="absolute left-1/2 top-[14%] flex -translate-x-1/2 flex-col items-center gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-gold">Trump</span>
          <div className="relative">
            <MysteryCard size="sm" revealed={trumpRevealed} card={trumpRevealed ? displayTrumpCard : null} />
            {trumpRevealed && (
              <button
                type="button"
                onClick={() => setTrumpDismissed(true)}
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-gold/70 bg-felt-dark text-xs text-gold hover:bg-felt"
                aria-label="Hide revealed trump card"
                title="Hide revealed trump card"
              >
                ×
              </button>
            )}
          </div>
          {!trumpRevealed && (
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">face down</span>
          )}
        </div>
      )}

      {/* central pile */}
      <div className="absolute left-1/2 top-1/2 flex max-w-[60%] -translate-x-1/2 -translate-y-1/2 flex-wrap items-center justify-center gap-2">
        {trick.length === 0 ? (
          <span className="font-serif text-sm italic text-foreground/50">
            {banner ? '' : 'The pile is empty'}
          </span>
        ) : (
          trick.map((play) => (
            <div key={play.card.id} className="flex flex-col items-center gap-1">
              <CardFace card={play.card} size="md" />
              <span className="max-w-24 truncate font-mono text-[10px] font-semibold text-foreground/80">
                {seats[play.player].name}
              </span>
            </div>
          ))
        )}
      </div>

      {/* banner */}
      {banner && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className="animate-in fade-in zoom-in rounded-xl border-2 border-gold bg-felt-dark/95 px-6 py-3 text-center shadow-2xl">
            <span className="font-serif text-lg font-bold text-gold-soft">{banner}</span>
          </div>
        </div>
      )}

      {/* seats */}
      {seats.map((seat, i) => (
        <div key={i} className="absolute" style={seatPosition(i, seats.length)}>
          <Seat seat={seat} />
        </div>
      ))}
    </div>
  )
}
