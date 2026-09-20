'use client'

import { cn } from '@/lib/utils'
import { type Card, RED_SUITS, SUIT_SYMBOL } from '@/lib/game'

const SIZES = {
  sm: 'h-16 w-11 text-[10px] rounded-md',
  md: 'h-24 w-16 text-xs rounded-lg',
  lg: 'h-32 w-24 text-sm rounded-xl',
} as const

type Size = keyof typeof SIZES

/** Simple line-art faces for the picture cards — filled with currentColor so they pick up the suit's color. */
const FACE_ICONS: Partial<Record<Card['rank'], (props: { className?: string }) => React.ReactNode>> = {
  K: ({ className }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8z" />
      <rect x="4" y="19" width="16" height="2" rx="0.5" />
    </svg>
  ),
  Q: ({ className }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2l2.6 4.9 5-1.6-1.4 5.1L21 12l-2.8 1.6 1.4 5.1-5-1.6L12 22l-2.6-4.9-5 1.6 1.4-5.1L3 12l2.8-1.6-1.4-5.1 5 1.6L12 2z" />
      <circle cx="12" cy="12" r="2.4" className="fill-card" />
    </svg>
  ),
  J: ({ className }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M11 2h2v13.5a3.5 3.5 0 11-6.13-2.32l1.5 1.32A1.5 1.5 0 1011 15V2z" />
      <rect x="8" y="1" width="8" height="2" rx="0.5" />
    </svg>
  ),
}

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
  const FaceIcon = FACE_ICONS[card.rank]
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
      {FaceIcon ? (
        <FaceIcon
          className={cn(
            'mx-auto',
            size === 'lg' ? 'h-9 w-9' : size === 'md' ? 'h-7 w-7' : 'h-5 w-5',
            isRed ? 'text-suit-red' : 'text-card-foreground',
          )}
        />
      ) : (
        <div
          className={cn(
            'text-center font-serif leading-none',
            card.rank === 'A'
              ? size === 'lg'
                ? 'text-4xl'
                : size === 'md'
                  ? 'text-3xl'
                  : 'text-xl'
              : size === 'lg'
                ? 'text-2xl'
                : size === 'md'
                  ? 'text-xl'
                  : 'text-base',
            card.rank === 'A' && 'font-bold',
            isRed ? 'text-suit-red' : 'text-card-foreground',
          )}
          aria-hidden
        >
          {symbol}
        </div>
      )}
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

export function CardBack({
  size = 'md',
  className,
  showLabel = true,
}: {
  size?: Size
  className?: string
  showLabel?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center border border-gold/40 bg-felt-dark shadow-md',
        'bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,color-mix(in_oklch,var(--gold)_18%,transparent)_6px,color-mix(in_oklch,var(--gold)_18%,transparent)_12px)]',
        SIZES[size],
        className,
      )}
    >
      {showLabel && <span className="font-serif text-xs font-bold tracking-widest text-gold/80">904</span>}
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
  mobileSize,
  mobileGrid = false,
  fan = true,
  disabled,
  selected,
  onClick,
  className,
}: {
  card: Card
  size?: Size
  mobileSize?: Size
  mobileGrid?: boolean
  fan?: boolean
  disabled?: boolean
  selected?: boolean
  onClick?: () => void
  className?: string
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
        className,
      )}
    >
      <CardFace
        card={card}
        size={size}
        className={cn(
          !disabled && 'group-hover:ring-2 group-hover:ring-gold',
          mobileSize === 'sm' && 'h-16 w-11 sm:h-24 sm:w-16',
          mobileGrid && 'w-full',
        )}
      />
    </button>
  )
}
