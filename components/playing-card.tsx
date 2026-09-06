'use client'

import { cn } from '@/lib/utils'
import { type Card, RED_SUITS, SUIT_SYMBOL } from '@/lib/game'

const SIZES = {
  sm: 'h-16 w-11 text-[10px] rounded-md',
  md: 'h-24 w-16 text-xs rounded-lg',
  lg: 'h-32 w-24 text-sm rounded-xl',
} as const

type Size = keyof typeof SIZES

export function CardFace({
  card,
  size = 'md',
  className,
}: {
  card: Card
  size?: Size
  className?: string
}) {
  const isRed = RED_SUITS.includes(card.suit)
  const symbol = SUIT_SYMBOL[card.suit]
  return (
    <div
      className={cn(
        'relative flex flex-col justify-between border border-black/10 bg-card p-1.5 shadow-md',
        'text-card-foreground',
        SIZES[size],
        className,
      )}
    >
      <div className={cn('flex items-center gap-0.5 font-semibold leading-none', isRed && 'text-suit-red')}>
        <span>{card.rank}</span>
        <span>{symbol}</span>
      </div>
      <div
        className={cn(
          'text-center font-serif leading-none',
          size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-xl' : 'text-base',
          isRed ? 'text-suit-red' : 'text-card-foreground',
        )}
        aria-hidden
      >
        {symbol}
      </div>
      <div
        className={cn(
          'self-end rounded-sm bg-black/5 px-1 font-mono text-[9px] font-semibold leading-tight text-card-foreground/70',
          size === 'sm' && 'text-[8px]',
        )}
      >
        {card.points}
      </div>
    </div>
  )
}

export function CardBack({ size = 'md', className }: { size?: Size; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center border border-gold/40 bg-felt-dark shadow-md',
        'bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,color-mix(in_oklch,var(--gold)_18%,transparent)_6px,color-mix(in_oklch,var(--gold)_18%,transparent)_12px)]',
        SIZES[size],
        className,
      )}
    >
      <span className="font-serif text-xs font-bold tracking-widest text-gold/80">904</span>
    </div>
  )
}

export function MysteryCard({
  size = 'md',
  revealed,
  card,
  className,
}: {
  size?: Size
  revealed?: boolean
  card?: Card | null
  className?: string
}) {
  if (revealed && card) {
    return <CardFace card={card} size={size} className={cn('ring-2 ring-gold', className)} />
  }
  return (
    <div
      className={cn(
        'flex items-center justify-center border-2 border-gold/60 bg-felt-dark text-gold shadow-lg',
        SIZES[size],
        className,
      )}
    >
      <span className="font-serif text-3xl font-bold">?</span>
    </div>
  )
}

/** Interactive wrapper used for the active player's hand. */
export function ClickableCard({
  card,
  size = 'lg',
  fan = true,
  disabled,
  selected,
  onClick,
}: {
  card: Card
  size?: Size
  fan?: boolean
  disabled?: boolean
  selected?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${card.rank} of ${card.suit}, ${card.points} points`}
      className={cn(
        'group relative shrink-0 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
        fan && '-ml-3 first:ml-0',
        disabled
          ? 'cursor-not-allowed opacity-40 saturate-0'
          : 'cursor-pointer hover:-translate-y-4 hover:z-10',
        selected && '-translate-y-4',
      )}
    >
      <CardFace card={card} size={size} className={cn(!disabled && 'group-hover:ring-2 group-hover:ring-gold')} />
    </button>
  )
}
