import {
  buildDeck,
  CARDS_PER_PLAYER,
  cardLimit,
  CLAIM_STEP,
  type Card,
  evaluateTrick,
  getPlayable,
  MAX_CLAIM,
  MIN_CLAIM,
  type Settlement,
  settleRound,
  shuffle,
  sortHand,
  type Suit,

  teamOf,
  type TrickPlay,
  trickPoints,
} from '@/lib/game'

// ---------------------------------------------------------------------------
// Room state
//
// Rooms live in memory in a single Node process. That is deliberate for the
// simple build: `pnpm dev` and `pnpm start` on one machine both work with no
// database. It does NOT survive a multi-instance deploy (Vercel), where two
// requests can hit different instances. Swap ROOMS for a Redis-backed store to
// go multi-instance; nothing else in this file needs to change.
// ---------------------------------------------------------------------------

export type RoomStatus = 'lobby' | 'bidding' | 'trump' | 'playing' | 'roundOver' | 'matchOver'

export interface RoomPlayer {
  id: string
  secret: string
  name: string
  seat: number
  lastSeen: number
}

export interface CompletedTrick {
  plays: TrickPlay[]
  winner: number
  points: number
}

export interface Room {
  id: string
  version: number
  createdAt: number
  seatCount: number
  status: RoomStatus
  hostId: string
  players: RoomPlayer[]

  match: {
    roundNumber: number
    teamCards: [number, number]
    cardLimit: number
    loser: 0 | 1 | null
  }

  round: {
    dealer: number
    current: number
    hands: Card[][]
    passed: boolean[]
    bids: (number | null)[]
    bidTurn: number
    highBid: number
    highBidder: number | null
    claimer: number | null
    claim: number
    trumpSuit: Suit | null
    /**
     * The claimer's face-down trump card, held out of their hand. While it sits
     * here it is unplayable and does not count for following suit. It returns to
     * the hand when trump is revealed, or when it is the only card they have
     * left — in which case it is played without trump ever going live.
     */
    trumpCard: Card | null
    /** The selected card remains private until trump is revealed. */
    selectedTrumpCard: Card | null
    /** The real selected card, available to everyone once trump is revealed. */
    revealedTrumpCard: Card | null
    trumpRevealed: boolean
    doubleCalled: boolean
    trick: TrickPlay[]
    lastTrick: CompletedTrick | null
    trickNumber: number
    teamScores: [number, number]
    teamTricks: [number, number]
    settlement: Settlement | null
  }
}

/** Survives dev-server hot reloads, which would otherwise wipe every room. */
const globalStore = globalThis as unknown as { __thinnaiRooms?: Map<string, Room> }
const ROOMS: Map<string, Room> = (globalStore.__thinnaiRooms ??= new Map())

/** Rooms idle for this long are swept on the next create. */
const ROOM_TTL_MS = 6 * 60 * 60 * 1000

const WORDS = [
  'kolam', 'veranda', 'mango', 'jasmine', 'monsoon', 'tamarind', 'banyan',
  'coconut', 'lantern', 'palmyra', 'kingfisher', 'sandal',
]

function token(): string {
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 8)).join('')
}

function roomId(): string {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)]
  const num = Math.floor(Math.random() * 90) + 10
  return `${word}-${num}`
}

function sweep() {
  const cutoff = Date.now() - ROOM_TTL_MS
  for (const [id, room] of ROOMS) if (room.createdAt < cutoff) ROOMS.delete(id)
}

function emptyRound(seatCount: number): Room['round'] {
  return {
    dealer: 0,
    current: 0,
    hands: Array.from({ length: seatCount }, () => []),
    passed: Array(seatCount).fill(false),
    bids: Array(seatCount).fill(null),
    bidTurn: 0,
    highBid: 0,
    highBidder: null,
    claimer: null,
    claim: 0,
    trumpSuit: null,
    trumpCard: null,
    selectedTrumpCard: null,
    revealedTrumpCard: null,
    trumpRevealed: false,
    doubleCalled: false,
    trick: [],
    lastTrick: null,
    trickNumber: 0,
    teamScores: [0, 0],
    teamTricks: [0, 0],
    settlement: null,
  }
}

export function createRoom(seatCount: number, hostName: string) {
  sweep()
  if (seatCount !== 4 && seatCount !== 6) throw new ActionError('Table size must be 4 or 6')

  let id = roomId()
  while (ROOMS.has(id)) id = roomId()

  const host: RoomPlayer = {
    id: token(),
    secret: token(),
    name: cleanName(hostName),
    seat: 0,
    lastSeen: Date.now(),
  }

  const room: Room = {
    id,
    version: 1,
    createdAt: Date.now(),
    seatCount,
    status: 'lobby',
    hostId: host.id,
    players: [host],
    match: { roundNumber: 1, teamCards: [0, 0], cardLimit: cardLimit(seatCount), loser: null },
    round: emptyRound(seatCount),
  }
  ROOMS.set(id, room)
  return { room, player: host }
}

export function getRoom(id: string): Room | null {
  return ROOMS.get(id) ?? null
}

export class ActionError extends Error {}

function cleanName(raw: string): string {
  const name = (raw ?? '').trim().slice(0, 20)
  if (!name) throw new ActionError('Enter a name')
  return name
}

export function joinRoom(id: string, name: string) {
  const room = ROOMS.get(id)
  if (!room) throw new ActionError('That thinnai does not exist')
  if (room.status !== 'lobby') throw new ActionError('That match has already started')
  if (room.players.length >= room.seatCount) throw new ActionError('That thinnai is full')

  const player: RoomPlayer = {
    id: token(),
    secret: token(),
    name: cleanName(name),
    seat: room.players.length,
    lastSeen: Date.now(),
  }
  room.players.push(player)
  room.version++
  return { room, player }
}

function authenticate(room: Room, playerId: string, secret: string): RoomPlayer {
  const player = room.players.find((p) => p.id === playerId)
  if (!player || player.secret !== secret) throw new ActionError('You are not seated at this thinnai')
  player.lastSeen = Date.now()
  return player
}

function requireTurn(room: Room, player: RoomPlayer) {
  if (room.round.current !== player.seat) throw new ActionError('Not your turn')
}

/** Deal a fresh round. Match-level state (cards, round number) is untouched. */
function dealRound(room: Room, dealer: number) {
  const deck = shuffle(buildDeck(room.seatCount))
  const round = emptyRound(room.seatCount)
  round.hands = Array.from({ length: room.seatCount }, (_, seat) =>
    sortHand(deck.slice(seat * CARDS_PER_PLAYER, seat * CARDS_PER_PLAYER + CARDS_PER_PLAYER)),
  )
  round.dealer = dealer
  round.current = (dealer + 1) % room.seatCount
  room.round = round
  room.status = 'bidding'
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type Action =
  | { type: 'start' }
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'selectTrump'; cardId: string }
  | { type: 'askTrump' }
  | { type: 'playCard'; cardId: string; double?: boolean }
  | { type: 'nextRound' }

export function applyAction(id: string, playerId: string, secret: string, action: Action): Room {
  const room = ROOMS.get(id)
  if (!room) throw new ActionError('That thinnai does not exist')
  const player = authenticate(room, playerId, secret)

  switch (action.type) {
    case 'start':
      doStart(room, player)
      break
    case 'bid':
      doBid(room, player, action.amount)
      break
    case 'pass':
      doPass(room, player)
      break
    case 'selectTrump':
      doSelectTrump(room, player, action.cardId)
      break
    case 'askTrump':
      doAskTrump(room, player)
      break
    case 'playCard':
      doPlayCard(room, player, action.cardId, action.double === true)
      break
    case 'nextRound':
      doNextRound(room, player)
      break
    default:
      throw new ActionError('Unknown action')
  }

  room.version++
  return room
}

function doStart(room: Room, player: RoomPlayer) {
  if (room.hostId !== player.id) throw new ActionError('Only the host can start')
  if (room.status !== 'lobby') throw new ActionError('Already started')
  if (room.players.length !== room.seatCount) {
    throw new ActionError(`Waiting for ${room.seatCount - room.players.length} more player(s)`)
  }
  dealRound(room, Math.floor(Math.random() * room.seatCount))
}

function minAllowed(room: Room): number {
  const { highBid } = room.round
  return Math.min(MAX_CLAIM, highBid > 0 ? highBid + CLAIM_STEP : MIN_CLAIM)
}

/** One lap only: when every seat has acted, the high bid takes the claim. */
function advanceBidding(room: Room) {
  const r = room.round
  const turn = r.bidTurn + 1
  if (turn < room.seatCount) {
    r.bidTurn = turn
    r.current = (r.current + 1) % room.seatCount
    return
  }
  if (r.highBidder === null) {
    // No claim: deal fresh hands and start bidding again with the same dealer.
    dealRound(room, r.dealer)
    return
  }
  r.claimer = r.highBidder
  r.claim = r.highBid
  r.current = r.claimer
  room.status = 'trump'
}

function doBid(room: Room, player: RoomPlayer, amount: number) {
  if (room.status !== 'bidding') throw new ActionError('Not bidding')
  requireTurn(room, player)
  if (!Number.isInteger(amount)) throw new ActionError('Bid must be a whole number')
  if (amount > MAX_CLAIM) throw new ActionError(`Maximum bid is ${MAX_CLAIM}`)
  if (amount % CLAIM_STEP !== 0) throw new ActionError(`Bids move in steps of ${CLAIM_STEP}`)
  if (amount < minAllowed(room)) throw new ActionError(`Bid must be at least ${minAllowed(room)}`)

  const r = room.round
  r.bids[player.seat] = amount
  r.highBid = amount
  r.highBidder = player.seat
  advanceBidding(room)
}

function doPass(room: Room, player: RoomPlayer) {
  if (room.status !== 'bidding') throw new ActionError('Not bidding')
  requireTurn(room, player)
  room.round.passed[player.seat] = true
  advanceBidding(room)
}

/**
 * The claimer sets one card aside, face down. Its suit becomes trump, but
 * nobody — including the claimer — can play that card until trump is revealed.
 */
function doSelectTrump(room: Room, player: RoomPlayer, cardId: string) {
  if (room.status !== 'trump') throw new ActionError('Not choosing trump')
  if (room.round.claimer !== player.seat) throw new ActionError('Only the claimer picks trump')

  const r = room.round
  const hand = r.hands[player.seat]
  const card = hand.find((c) => c.id === cardId)
  if (!card) throw new ActionError('You do not hold that card')

  // Out of the hand entirely: this is what makes it unplayable and makes the
  // claimer count as void in its suit.
  r.hands[player.seat] = hand.filter((c) => c.id !== cardId)
  r.trumpCard = card
  r.selectedTrumpCard = card
  r.revealedTrumpCard = null
  r.trumpSuit = card.suit
  r.trumpRevealed = false
  // The player to the claimer's right leads the first trick.
  r.current = (player.seat - 1 + room.seatCount) % room.seatCount
  room.status = 'playing'
}

/** Put the face-down card back in the claimer's hand. */
function returnTrumpCard(room: Room) {
  const r = room.round
  if (!r.trumpCard || r.claimer === null) return
  r.hands[r.claimer] = sortHand([...r.hands[r.claimer], r.trumpCard])
  r.trumpCard = null
}

function doAskTrump(room: Room, player: RoomPlayer) {
  if (room.status !== 'playing') throw new ActionError('Not in play')
  requireTurn(room, player)
  const r = room.round
  if (r.trumpRevealed) throw new ActionError('Trump is already revealed')
  const playable = getPlayable(r.hands[player.seat], r.trick, r.trumpRevealed)
  if (!playable.canAskTrump) throw new ActionError('You can only ask when void in the led suit')

  r.revealedTrumpCard = r.selectedTrumpCard
  r.trumpRevealed = true
  // Revealing hands the card back to the claimer, who may now play it.
  returnTrumpCard(room)
}

function doPlayCard(room: Room, player: RoomPlayer, cardId: string, double: boolean) {
  if (room.status !== 'playing') throw new ActionError('Not in play')
  requireTurn(room, player)

  const r = room.round
  const hand = r.hands[player.seat]
  const card = hand.find((c) => c.id === cardId)
  if (!card) throw new ActionError('You do not hold that card')

  const playable = getPlayable(hand, r.trick, r.trumpRevealed)
  if (!playable.playableIds.has(cardId)) throw new ActionError('You must follow the led suit')

  if (double) {
    if (r.claimer !== player.seat) throw new ActionError('Only the claimer can call double')
    // With the trump still face down this is not really their last card — it
    // comes back to hand the moment the rest of the hand runs out.
    if (hand.length !== 1 || r.trumpCard) throw new ActionError('Double is called on your last card')
    if (r.doubleCalled) throw new ActionError('Double already called')
    r.doubleCalled = true
  }

  r.hands[player.seat] = hand.filter((c) => c.id !== cardId)

  // If the claimer has emptied their hand and nobody ever asked, the face-down
  // card comes back so they can play it for the last trick. Trump stays
  // unrevealed, so it wins only as an ordinary card of its suit.
  if (player.seat === r.claimer && r.hands[player.seat].length === 0 && r.trumpCard) {
    returnTrumpCard(room)
  }

  r.trick.push({ player: player.seat, card })
  r.lastTrick = null

  if (r.trick.length < room.seatCount) {
    r.current = (player.seat + 1) % room.seatCount
    return
  }

  resolveTrick(room)
}

function resolveTrick(room: Room) {
  const r = room.round
  const winner = evaluateTrick(r.trick, r.trumpSuit, r.trumpRevealed)
  const points = trickPoints(r.trick)
  const winnerTeam = teamOf(winner)

  r.teamScores[winnerTeam] += points
  r.teamTricks[winnerTeam] += 1
  r.lastTrick = { plays: r.trick, winner, points }
  r.trick = []
  r.trickNumber += 1
  r.current = winner

  if (r.trickNumber < CARDS_PER_PLAYER) return

  // Round over — settle.
  const claimerTeam = teamOf(r.claimer ?? 0)
  const settlement = settleRound({
    claim: r.claim,
    claimerTeam,
    captured: r.teamScores[claimerTeam],
    teamTricks: r.teamTricks,
    doubleCalled: r.doubleCalled,
  })
  r.settlement = settlement
  room.match.teamCards[settlement.penalisedTeam] += settlement.cards

  if (room.match.teamCards[settlement.penalisedTeam] >= room.match.cardLimit) {
    room.match.loser = settlement.penalisedTeam
    room.status = 'matchOver'
  } else {
    room.status = 'roundOver'
  }
}

function doNextRound(room: Room, player: RoomPlayer) {
  if (room.status !== 'roundOver') throw new ActionError('Round is not over')
  if (room.hostId !== player.id) throw new ActionError('Only the host starts the next round')
  room.match.roundNumber += 1
  dealRound(room, (room.round.dealer + 1) % room.seatCount)
}

// ---------------------------------------------------------------------------
// Redaction
//
// The single most security-sensitive function here. A player may see their own
// hand, everyone's card counts, and the trump only once it is revealed (or if
// they are the claimer, who chose it). Nothing else about other hands leaves
// the server.
// ---------------------------------------------------------------------------

export interface PlayerView {
  roomId: string
  version: number
  status: RoomStatus
  seatCount: number
  youAreHost: boolean
  yourSeat: number
  players: { name: string; seat: number; team: 0 | 1; handCount: number; connected: boolean }[]
  match: Room['match']
  round: {
    dealer: number
    current: number
    passed: boolean[]
    bids: (number | null)[]
    bidTurn: number
    highBid: number
    highBidder: number | null
    claimer: number | null
    claim: number
    trumpSuit: Suit | null
    trumpCard: Card | null
    trumpRevealed: boolean
    doubleCalled: boolean
    trick: TrickPlay[]
    lastTrick: CompletedTrick | null
    trickNumber: number
    teamScores: [number, number]
    teamTricks: [number, number]
    settlement: Settlement | null
  }
  yourHand: Card[]
  /** The claimer's own face-down trump card. Null for everyone else. */
  yourTrumpCard: Card | null
  /** True while a face-down trump card is sitting out of the claimer's hand. */
  trumpFaceDown: boolean
  playableIds: string[]
  canAskTrump: boolean
  canCallDouble: boolean
  minBid: number
  mustClaim: boolean
}

const CONNECTED_WINDOW_MS = 15_000

export function viewFor(room: Room, playerId: string): PlayerView {
  const me = room.players.find((p) => p.id === playerId)
  if (!me) throw new ActionError('You are not seated at this thinnai')

  const r = room.round
  const inPlay = room.status === 'playing' && r.current === me.seat
  const myHand = r.hands[me.seat] ?? []
  const playable = inPlay ? getPlayable(myHand, r.trick, r.trumpRevealed) : null

  // The claimer knows the trump because they chose it. Everyone else waits.
  const trumpVisible = r.trumpRevealed || r.claimer === me.seat
  const now = Date.now()

  return {
    roomId: room.id,
    version: room.version,
    status: room.status,
    seatCount: room.seatCount,
    youAreHost: room.hostId === me.id,
    yourSeat: me.seat,
    players: room.players
      .slice()
      .sort((a, b) => a.seat - b.seat)
      .map((p) => ({
        name: p.name,
        seat: p.seat,
        team: teamOf(p.seat),
        handCount: (r.hands[p.seat] ?? []).length,
        connected: now - p.lastSeen < CONNECTED_WINDOW_MS,
      })),
    match: room.match,
    round: {
      dealer: r.dealer,
      current: r.current,
      passed: r.passed,
      bids: r.bids,
      bidTurn: r.bidTurn,
      highBid: r.highBid,
      highBidder: r.highBidder,
      claimer: r.claimer,
      claim: r.claim,
      trumpSuit: trumpVisible ? r.trumpSuit : null,
      trumpCard: trumpVisible ? (r.trumpRevealed ? r.revealedTrumpCard : r.trumpCard) : null,
      trumpRevealed: r.trumpRevealed,
      doubleCalled: r.doubleCalled,
      trick: r.trick,
      lastTrick: r.lastTrick,
      trickNumber: r.trickNumber,
      teamScores: r.teamScores,
      teamTricks: r.teamTricks,
      settlement: r.settlement,
    },
    yourHand: myHand,
    // Only the claimer ever learns which card is face down.
    yourTrumpCard: r.claimer === me.seat ? r.trumpCard : null,
    trumpFaceDown: r.trumpCard !== null,
    playableIds: playable ? Array.from(playable.playableIds) : [],
    canAskTrump: playable?.canAskTrump === true,
    canCallDouble:
      inPlay &&
      r.claimer === me.seat &&
      myHand.length === 1 &&
      !r.trumpCard &&
      !r.doubleCalled &&
      r.trickNumber === CARDS_PER_PLAYER - 1 &&
      r.teamTricks[teamOf(me.seat)] === CARDS_PER_PLAYER - 1,
    minBid: minAllowed(room),
    mustClaim: false,
  }
}

/** Marks a player as still watching, for the connected dots. */
export function touch(room: Room, playerId: string) {
  const p = room.players.find((x) => x.id === playerId)
  if (p) p.lastSeen = Date.now()
}
