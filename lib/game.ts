export type Suit = 'Spades' | 'Clubs' | 'Hearts' | 'Diamonds'
export type Rank = '2' | '3' | 'J' | '9' | 'A' | '10' | 'K' | 'Q' | '8'

export interface Card {
  id: string
  suit: Suit
  rank: Rank
  points: number
}

export interface TrickPlay {
  player: number
  card: Card
}

export const SUITS: Suit[] = ['Spades', 'Clubs', 'Hearts', 'Diamonds']

export const SUIT_SYMBOL: Record<Suit, string> = {
  Spades: '\u2660',
  Clubs: '\u2663',
  Hearts: '\u2665',
  Diamonds: '\u2666',
}

export const RED_SUITS: Suit[] = ['Hearts', 'Diamonds']

export const RANK_POINTS: Record<Rank, number> = {
  '2': 100,
  '3': 50,
  J: 30,
  '9': 20,
  A: 11,
  '10': 10,
  K: 3,
  Q: 2,
  '8': 0,
}

/** Ranks used for a 4-player deck (24 cards). */
const RANKS_4: Rank[] = ['2', '3', 'J', '9', 'A', '10']
/** Extra ranks injected for a 6-player deck (36 cards). */
const RANKS_6: Rank[] = ['2', '3', 'J', '9', 'A', '10', 'K', 'Q', '8']

/**
 * Strength order from strongest to weakest. A card beats another of the same
 * suit when it appears earlier in this list (i.e. has a lower index).
 */
const STRENGTH_ORDER: Rank[] = ['2', '3', 'J', '9', 'A', '10', 'K', 'Q', '8']

export function rankStrength(rank: Rank): number {
  return STRENGTH_ORDER.indexOf(rank)
}

export const CARDS_PER_PLAYER = 6
export const MIN_CLAIM = 500
export const MAX_CLAIM = 904
export const CLAIM_STEP = 10

export function buildDeck(playerCount: number): Card[] {
  const ranks = playerCount >= 6 ? RANKS_6 : RANKS_4
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of ranks) {
      deck.push({ id: `${suit}-${rank}`, suit, rank, points: RANK_POINTS[rank] })
    }
  }
  return deck
}

export function shuffle<T>(input: T[]): T[] {
  const arr = [...input]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Alternating team assignment: even seats = Team A (0), odd seats = Team B (1). */
export function teamOf(seat: number): 0 | 1 {
  return (seat % 2) as 0 | 1
}

export const TEAM_NAME = ['Team A', 'Team B'] as const

export function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => {
    if (a.suit !== b.suit) return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit)
    return rankStrength(a.rank) - rankStrength(b.rank)
  })
}

export interface PlayableResult {
  /** Card ids the active player is currently allowed to drop. */
  playableIds: Set<string>
  /** True when resolving this player's options exposes the hidden trump. */
  revealsTrump: boolean
  reason: 'lead' | 'follow' | 'forced-trump' | 'free-discard'
}

/**
 * Determine which cards the active player may legally play given the current
 * trick, the (possibly still hidden) trump suit, and whether trump is revealed.
 */
export function getPlayable(
  hand: Card[],
  trick: TrickPlay[],
  trumpSuit: Suit | null,
  trumpRevealed: boolean,
): PlayableResult {
  // Leading the trick: any card is allowed.
  if (trick.length === 0) {
    return { playableIds: new Set(hand.map((c) => c.id)), revealsTrump: false, reason: 'lead' }
  }

  const ledSuit = trick[0].card.suit
  const ledCards = hand.filter((c) => c.suit === ledSuit)

  // Must follow the led suit when possible.
  if (ledCards.length > 0) {
    return { playableIds: new Set(ledCards.map((c) => c.id)), revealsTrump: false, reason: 'follow' }
  }

  // Out of the led suit -> trump becomes (or already is) revealed.
  const revealsTrump = !trumpRevealed
  const trumpCards = trumpSuit ? hand.filter((c) => c.suit === trumpSuit) : []

  if (trumpCards.length > 0) {
    // Forced trump: only trump cards may be dropped.
    return { playableIds: new Set(trumpCards.map((c) => c.id)), revealsTrump, reason: 'forced-trump' }
  }

  // No trump in hand: free to discard anything.
  return { playableIds: new Set(hand.map((c) => c.id)), revealsTrump, reason: 'free-discard' }
}

/** Returns the seat index that wins the completed trick. */
export function evaluateTrick(
  trick: TrickPlay[],
  trumpSuit: Suit | null,
  trumpRevealed: boolean,
): number {
  const ledSuit = trick[0].card.suit
  const trumps = trumpRevealed && trumpSuit ? trick.filter((p) => p.card.suit === trumpSuit) : []
  const pool = trumps.length > 0 ? trumps : trick.filter((p) => p.card.suit === ledSuit)
  let winner = pool[0]
  for (const play of pool) {
    if (rankStrength(play.card.rank) < rankStrength(winner.card.rank)) winner = play
  }
  return winner.player
}

export function trickPoints(trick: TrickPlay[]): number {
  return trick.reduce((sum, p) => sum + p.card.points, 0)
}
