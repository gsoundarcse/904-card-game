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

const HAND_SUIT_ORDER: Suit[] = ['Spades', 'Hearts', 'Clubs', 'Diamonds']

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
export const MAX_CLAIM = 903
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
  const ordered = [...hand].sort((a, b) => {
    if (a.suit !== b.suit) return HAND_SUIT_ORDER.indexOf(a.suit) - HAND_SUIT_ORDER.indexOf(b.suit)
    return rankStrength(a.rank) - rankStrength(b.rank)
  })
  const groups = new Map<Suit, Card[]>()
  for (const card of ordered) groups.set(card.suit, [...(groups.get(card.suit) ?? []), card])

  const black: Suit[] = [...groups.keys()].filter((suit) => !RED_SUITS.includes(suit))
  const red: Suit[] = [...groups.keys()].filter((suit) => RED_SUITS.includes(suit))
  const sorted: Card[] = []
  let lastColor: 'black' | 'red' | null = null

  while (black.length > 0 || red.length > 0) {
    const chooseRed: boolean =
      black.length === 0 ||
      (red.length > black.length && lastColor !== 'red') ||
      (lastColor === 'black' && red.length > 0 && black.length <= red.length)
    const primary: Suit[] = chooseRed ? red : black
    const fallback: Suit[] = chooseRed ? black : red
    let suit: Suit | undefined = primary.shift()
    if (!suit) suit = fallback.shift()
    if (!suit) break
    sorted.push(...groups.get(suit)!)
    lastColor = RED_SUITS.includes(suit) ? 'red' : 'black'
  }
  return sorted
}

export interface PlayableResult {
  /** Card ids the active player is currently allowed to drop. */
  playableIds: Set<string>
  /** True when this player is void in the led suit and could ask for trump. */
  canAskTrump: boolean
  reason: 'lead' | 'follow' | 'void'
}

/**
 * Determine which cards the active player may legally play.
 *
 * Following the led suit is the only hard constraint. A player void in the led
 * suit may drop anything at all — trump or plain discard, their choice. Asking
 * for trump is an option offered to a void player, never a requirement, and it
 * does not restrict what they may then play.
 */
export function getPlayable(
  hand: Card[],
  trick: TrickPlay[],
  trumpRevealed: boolean,
): PlayableResult {
  // Leading the trick: any card is allowed.
  if (trick.length === 0) {
    return { playableIds: new Set(hand.map((c) => c.id)), canAskTrump: false, reason: 'lead' }
  }

  const ledSuit = trick[0].card.suit
  const ledCards = hand.filter((c) => c.suit === ledSuit)

  // Must follow the led suit when possible.
  if (ledCards.length > 0) {
    return { playableIds: new Set(ledCards.map((c) => c.id)), canAskTrump: false, reason: 'follow' }
  }

  // Void in the led suit: free choice, plus the option to ask for trump.
  return { playableIds: new Set(hand.map((c) => c.id)), canAskTrump: !trumpRevealed, reason: 'void' }
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

/** Choose a legal bot play using only cards and plays visible at the table. */
export function chooseBotCard(
  hand: Card[],
  playableIds: Set<string>,
  trick: TrickPlay[],
  trumpSuit: Suit | null,
  trumpRevealed: boolean,
  seat: number,
): Card | null {
  const legal = hand.filter((card) => playableIds.has(card.id))
  if (legal.length === 0) return null

  const value = (card: Card) => card.points * 100 - rankStrength(card.rank)
  if (trick.length === 0) return legal.reduce((best, card) => (value(card) > value(best) ? card : best))

  const currentWinner = evaluateTrick(trick, trumpSuit, trumpRevealed)
  const teammateWinning = teamOf(currentWinner) === teamOf(seat)
  const winners = legal.filter(
    (card) => evaluateTrick([...trick, { player: seat, card }], trumpSuit, trumpRevealed) === seat,
  )

  if (teammateWinning) {
    const support = legal.filter(
      (card) => evaluateTrick([...trick, { player: seat, card }], trumpSuit, trumpRevealed) !== seat,
    )
    return (support.length > 0 ? support : legal).reduce((best, card) => (value(card) > value(best) ? card : best))
  }

  if (winners.length > 0) return winners.reduce((best, card) => (value(card) < value(best) ? card : best))
  return legal.reduce((best, card) => (value(card) < value(best) ? card : best))
}

export function trickPoints(trick: TrickPlay[]): number {
  return trick.reduce((sum, p) => sum + p.card.points, 0)
}

// ---------------------------------------------------------------------------
// Match settlement
//
// A round does not produce a running score. It produces *cards*, handed to one
// team as a penalty. They accumulate across rounds; a team that collects enough
// loses the match.
// ---------------------------------------------------------------------------

/** Bids at or above this are "big" and settle harder in both directions. */
export const BIG_BID = 700

/** Cards for a made claim, paid by the opponents. */
export const WIN_CARDS = { small: 1, big: 3 } as const
/** Cards for a failed claim, paid by the claiming team. */
export const LOSS_CARDS = { small: 2, big: 3 } as const
/** Cards for a double that did not come off. Replaces the whole settlement. */
export const WRONG_DOUBLE_CARDS = { small: 3, big: 4 } as const
/** Added to a made claim when the claimer called double and swept. */
export const DOUBLE_BONUS = 1
/** Added when a failed claimer could not capture half their claim. */
export const SHORTFALL_BONUS = 1

/** Cards a team must accumulate to lose the match. */
export function cardLimit(playerCount: number): number {
  return playerCount >= 6 ? 7 : 5
}

/** Seat numbers (1-based, for display) belonging to each team. */
export function teamMembers(playerCount: number): [number[], number[]] {
  const a: number[] = []
  const b: number[] = []
  for (let seat = 0; seat < playerCount; seat++) {
    ;(teamOf(seat) === 0 ? a : b).push(seat + 1)
  }
  return [a, b]
}

/** "Team A (P1, P3)" — teams are always named alongside their members. */
export function teamLabel(team: 0 | 1, playerCount: number): string {
  const members = teamMembers(playerCount)[team]
  return `${TEAM_NAME[team]} (${members.map((p) => `P${p}`).join(', ')})`
}

export interface Settlement {
  success: boolean
  /** Team that receives the penalty cards. */
  penalisedTeam: 0 | 1
  cards: number
  /** Human-readable breakdown, one line per contributing rule. */
  reasons: string[]
}

export interface SettleInput {
  claim: number
  claimerTeam: 0 | 1
  /** Points captured by the claiming team. */
  captured: number
  /** Tricks won by [team A, team B]. */
  teamTricks: [number, number]
  /** True when the claimer called double on their last card. */
  doubleCalled: boolean
}

/**
 * Work out who takes cards for a finished round, and how many.
 *
 * A called double short-circuits everything: if the claiming team swept all six
 * tricks it pays the normal win plus one, otherwise it replaces the settlement
 * with a flat penalty against the claiming team.
 */
export function settleRound({
  claim,
  claimerTeam,
  captured,
  teamTricks,
  doubleCalled,
}: SettleInput): Settlement {
  const opponents = (1 - claimerTeam) as 0 | 1
  const big = claim >= BIG_BID
  const totalTricks = teamTricks[0] + teamTricks[1]
  const swept = totalTricks > 0 && teamTricks[claimerTeam] === totalTricks

  if (doubleCalled) {
    if (swept) {
      const base = big ? WIN_CARDS.big : WIN_CARDS.small
      return {
        success: true,
        penalisedTeam: opponents,
        cards: base + DOUBLE_BONUS,
        reasons: [
          `Claim of ${claim} made — ${base} card${base === 1 ? '' : 's'}`,
          `Double called and every trick taken — +${DOUBLE_BONUS} card`,
        ],
      }
    }
    const cards = big ? WRONG_DOUBLE_CARDS.big : WRONG_DOUBLE_CARDS.small
    return {
      success: false,
      penalisedTeam: claimerTeam,
      cards,
      reasons: [`Double called and missed — ${cards} cards, settlement replaced`],
    }
  }

  const success = captured >= claim
  if (success) {
    const cards = big ? WIN_CARDS.big : WIN_CARDS.small
    return {
      success: true,
      penalisedTeam: opponents,
      cards,
      reasons: [`Claim of ${claim} made with ${captured} — ${cards} card${cards === 1 ? '' : 's'}`],
    }
  }

  let cards = big ? LOSS_CARDS.big : LOSS_CARDS.small
  const reasons = [`Claim of ${claim} failed with ${captured} — ${cards} cards`]
  if (captured < claim / 2) {
    cards += SHORTFALL_BONUS
    reasons.push(`Under half the claim — +${SHORTFALL_BONUS} card`)
  }
  return { success: false, penalisedTeam: claimerTeam, cards, reasons }
}
