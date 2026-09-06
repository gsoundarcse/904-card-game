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
        'flex w-24 max-w-[30vw] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-xl border bg-felt-dark/80 px-1.5 py-1.5 text-center backdrop-blur-sm transition-all sm:w-28 sm:gap-1.5 sm:px-2 sm:py-2',
        seat.isCurrent
          ? 'border-gold bg-gold/10 shadow-[0_0_0_2px_var(--gold),0_8px_30px_var(--team-a-glow)]'
          : seat.team === 0
            ? 'border-team-a/40'
            : 'border-team-b/50',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn('h-2 w-2 rounded-full', seat.team === 0 ? 'bg-team-a' : 'bg-team-b')} aria-hidden />
        <span className="max-w-[22vw] truncate text-[10px] font-semibold text-foreground sm:max-w-24 sm:text-xs">{seat.name}</span>
      </div>

      <div className="flex h-8 items-center justify-center">
        {seat.handCount > 0 ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="flex h-7 items-center sm:h-8">
              {[0, 1, 2].map((slot) => (
                <CardBack key={slot} size="sm" className={cn('h-7 w-4 sm:h-8 sm:w-5', slot > 0 && '-ml-2 sm:-ml-3')} />
              ))}
            </div>
            <span className="whitespace-nowrap font-mono text-[9px] font-semibold text-muted-foreground sm:text-[10px]">
              {seat.handCount} {seat.handCount === 1 ? 'card' : 'cards'}
            </span>
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
    <div className="relative mx-auto h-[380px] w-full max-w-4xl overflow-hidden rounded-3xl border border-team-b/30 bg-[linear-gradient(145deg,var(--felt-dark),var(--felt)_48%,var(--felt-dark))] shadow-[0_18px_60px_rgba(0,0,0,0.28)] sm:h-[560px]">
      {/* felt surface */}
      <div className="absolute inset-3 rounded-2xl border border-gold/30 bg-[radial-gradient(ellipse_at_center,var(--felt)_0%,var(--felt-dark)_100%)] shadow-[inset_0_0_70px_rgba(0,0,0,0.4)] sm:inset-5 sm:rounded-3xl">
        <div className="absolute inset-3 rounded-xl border border-team-b/25 sm:inset-5 sm:rounded-2xl" />
        <div className="absolute inset-6 rounded-lg border border-team-a/15 sm:inset-10 sm:rounded-xl" />
      </div>

      {/* trump indicator */}
      {showTrumpIndicator && (
        <div className="absolute left-1/2 top-[8%] flex -translate-x-1/2 flex-col items-center gap-1">
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
      <div className="absolute left-1/2 top-1/2 flex min-h-28 max-w-[72%] -translate-x-1/2 -translate-y-1/2 flex-wrap items-center justify-center gap-1 rounded-xl border border-white/15 bg-black/15 px-2 py-2 shadow-[inset_0_0_24px_rgba(0,0,0,0.18)] sm:min-h-40 sm:max-w-[65%] sm:gap-2 sm:rounded-2xl sm:px-5 sm:py-4">
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
