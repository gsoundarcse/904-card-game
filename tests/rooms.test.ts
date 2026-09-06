import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  type Action,
  ActionError,
  applyAction,
  createRoom,
  getRoom,
  joinRoom,
  type Room,
  type RoomPlayer,
  viewFor,
} from '@/lib/server/rooms'
import { buildDeck, CARDS_PER_PLAYER, MIN_CLAIM, type Suit, teamOf } from '@/lib/game'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Table {
  id: string
  host: RoomPlayer
  bySeat: RoomPlayer[]
  room: () => Room
  act: (seat: number, action: Action) => void
  view: (seat: number) => ReturnType<typeof viewFor>
}

/** A room with every seat filled. Cards are not dealt until `start`. */
function seatTable(seats = 4): Table {
  const { room, player: host } = createRoom(seats, 'Host')
  const players = [host]
  for (let i = 1; i < seats; i++) players.push(joinRoom(room.id, `P${i + 1}`).player)

  const bySeat = players.slice().sort((a, b) => a.seat - b.seat)
  const id = room.id
  return {
    id,
    host,
    bySeat,
    room: () => getRoom(id)!,
    act: (seat, action) => {
      const p = bySeat[seat]
      applyAction(id, p.id, p.secret, action)
    },
    view: (seat) => viewFor(getRoom(id)!, bySeat[seat].id),
  }
}

function dealtTable(seats = 4): Table {
  const t = seatTable(seats)
  applyAction(t.id, t.host.id, t.host.secret, { type: 'start' })
  return t
}

/**
 * Make sure `seat` holds at least one card of `suit`, by swapping one in from
 * another seat. Keeps the deck valid — no card is duplicated or lost.
 */
function ensureSuit(t: Table, seat: number, suit: Suit) {
  const hands = t.room().round.hands
  if (hands[seat].some((c) => c.suit === suit)) return
  for (let other = 0; other < hands.length; other++) {
    if (other === seat) continue
    const idx = hands[other].findIndex((c) => c.suit === suit)
    if (idx === -1) continue
    const give = hands[other][idx]
    hands[other][idx] = hands[seat][0]
    hands[seat][0] = give
    return
  }
  throw new Error(`no ${suit} anywhere in the deal`)
}

/** Bid once around the table, then set a card of `trumpSuit` face down. */
function toPlayingPhase(t: Table, claimAmount = 520, trumpSuit: Suit = 'Hearts'): Table {
  const seats = t.room().seatCount
  const first = t.room().round.current
  t.act(first, { type: 'bid', amount: claimAmount })
  for (let i = 1; i < seats; i++) t.act((first + i) % seats, { type: 'pass' })

  const claimer = t.room().round.claimer!
  ensureSuit(t, claimer, trumpSuit)
  const card = t.room().round.hands[claimer].find((c) => c.suit === trumpSuit)!
  t.act(claimer, { type: 'selectTrump', cardId: card.id })
  return t
}

/**
 * Replace the dealt hands with exact ones and put a chosen seat on turn.
 *
 * Randomly dealt hands rarely contain the shape a rule needs (a void, a
 * singleton, a forced follow), and skipping the assertion when they do not is a
 * test that passes without testing anything. These are rigged on purpose.
 */
function rig(t: Table, hands: Record<number, string[]>, onTurn: number) {
  const r = t.room()
  const deck = buildDeck(r.seatCount)
  for (const [seat, ids] of Object.entries(hands)) {
    r.round.hands[Number(seat)] = ids.map((id) => {
      const found = deck.find((c) => c.id === id)
      if (!found) throw new Error(`rig: no such card ${id}`)
      return found
    })
  }
  r.round.current = onTurn
  // Rigged hands are exact; a leftover face-down card would add a card nobody
  // asked for. Tests that care about it set it explicitly.
  r.round.trumpCard = null
}

/** Play the round out with random legal moves. Returns the finished room. */
function playOutRound(t: Table, opts: { double?: boolean } = {}): Room {
  let guard = 0
  while (t.room().status === 'playing' && guard++ < 500) {
    const seat = t.room().round.current
    const v = t.view(seat)
    const cardId = v.playableIds[Math.floor(Math.random() * v.playableIds.length)]
    const callDouble = opts.double === true && v.canCallDouble
    t.act(seat, { type: 'playCard', cardId, double: callDouble })
  }
  return t.room()
}

const rejects = (fn: () => void, expected: RegExp) => {
  assert.throws(fn, (err: unknown) => {
    assert.ok(err instanceof ActionError, `expected an ActionError, got ${err}`)
    assert.match((err as Error).message, expected)
    return true
  })
}

// ---------------------------------------------------------------------------

describe('opening a thinnai', () => {
  it('starts in the lobby with only the host seated', () => {
    const { room, player } = createRoom(4, 'Soundar')
    assert.equal(room.status, 'lobby')
    assert.equal(room.players.length, 1)
    assert.equal(player.seat, 0)
    assert.equal(room.hostId, player.id)
    assert.equal(room.match.cardLimit, 5)
  })

  it('rejects a table that is not 4 or 6', () => {
    rejects(() => createRoom(5, 'x'), /4 or 6/)
    rejects(() => createRoom(0, 'x'), /4 or 6/)
  })

  it('insists on a name', () => {
    rejects(() => createRoom(4, '   '), /Enter a name/)
  })

  it('hands out unique room ids', () => {
    const ids = new Set(Array.from({ length: 40 }, () => createRoom(4, 'x').room.id))
    assert.equal(ids.size, 40)
  })

  it('gives each player different credentials', () => {
    const t = seatTable(4)
    assert.equal(new Set(t.bySeat.map((p) => p.id)).size, 4)
    assert.equal(new Set(t.bySeat.map((p) => p.secret)).size, 4)
  })
})

describe('joining', () => {
  it('seats players in arrival order', () => {
    const t = seatTable(4)
    assert.deepEqual(t.bySeat.map((p) => p.seat), [0, 1, 2, 3])
    assert.deepEqual(t.bySeat.map((p) => p.name), ['Host', 'P2', 'P3', 'P4'])
  })

  it('turns away an extra player', () => {
    const t = seatTable(4)
    rejects(() => joinRoom(t.id, 'Late'), /full/)
  })

  it('refuses a room that does not exist', () => {
    rejects(() => joinRoom('no-such-room', 'x'), /does not exist/)
  })

  it('locks the door once the match starts', () => {
    const t = dealtTable(4)
    rejects(() => joinRoom(t.id, 'Late'), /already started/)
  })
})

describe('who is allowed to act', () => {
  it('rejects a wrong secret', () => {
    const t = seatTable(4)
    rejects(() => applyAction(t.id, t.host.id, 'wrong', { type: 'start' }), /not seated/)
  })

  it('rejects an unknown player', () => {
    const t = seatTable(4)
    rejects(() => applyAction(t.id, 'ghost', 'ghost', { type: 'start' }), /not seated/)
  })

  it('lets only the host deal', () => {
    const t = seatTable(4)
    rejects(() => t.act(1, { type: 'start' }), /host/)
  })

  it('will not deal a short table', () => {
    const { room, player } = createRoom(4, 'Host')
    joinRoom(room.id, 'P2')
    rejects(() => applyAction(room.id, player.id, player.secret, { type: 'start' }), /Waiting for 2/)
  })

  it('rejects an unknown action', () => {
    const t = seatTable(4)
    rejects(
      () => applyAction(t.id, t.host.id, t.host.secret, { type: 'nonsense' } as unknown as Action),
      /Unknown action/,
    )
  })
})

describe('dealing', () => {
  it('gives everyone six cards from one deck', () => {
    const t = dealtTable(4)
    const r = t.room()
    assert.equal(r.status, 'bidding')
    assert.ok(r.round.hands.every((h) => h.length === CARDS_PER_PLAYER))
    const allIds = r.round.hands.flat().map((c) => c.id)
    assert.equal(new Set(allIds).size, 24, 'no card dealt twice')
  })

  it('opens the bidding to the left of the dealer', () => {
    for (let i = 0; i < 10; i++) {
      const r = dealtTable(4).room()
      assert.equal(r.round.current, (r.round.dealer + 1) % 4)
    }
  })
})

describe('bidding', () => {
  it('runs exactly one lap and stops', () => {
    const t = dealtTable(4)
    const first = t.room().round.current
    t.act(first, { type: 'bid', amount: 500 })
    t.act((first + 1) % 4, { type: 'bid', amount: 520 })
    t.act((first + 2) % 4, { type: 'pass' })
    assert.equal(t.room().status, 'bidding', 'still going with one seat to act')
    t.act((first + 3) % 4, { type: 'pass' })

    const r = t.room()
    assert.equal(r.status, 'trump', 'lap complete')
    assert.equal(r.round.claimer, (first + 1) % 4, 'highest bidder claims')
    assert.equal(r.round.claim, 520)
  })

  it('gives no one a second turn to counter', () => {
    const t = dealtTable(4)
    const first = t.room().round.current
    t.act(first, { type: 'bid', amount: 500 })
    t.act((first + 1) % 4, { type: 'bid', amount: 600 })
    t.act((first + 2) % 4, { type: 'pass' })
    t.act((first + 3) % 4, { type: 'pass' })
    // The opening bidder never gets to answer the 600.
    assert.equal(t.room().status, 'trump')
    rejects(() => t.act(first, { type: 'bid', amount: 700 }), /Not bidding/)
  })

  it('refuses moves out of turn', () => {
    const t = dealtTable(4)
    const first = t.room().round.current
    rejects(() => t.act((first + 1) % 4, { type: 'bid', amount: 500 }), /Not your turn/)
    rejects(() => t.act((first + 2) % 4, { type: 'pass' }), /Not your turn/)
  })

  it('enforces the opening minimum', () => {
    const t = dealtTable(4)
    const first = t.room().round.current
    rejects(() => t.act(first, { type: 'bid', amount: 490 }), /at least 500/)
  })

  it('enforces the step and the ceiling', () => {
    const t = dealtTable(4)
    const first = t.room().round.current
    rejects(() => t.act(first, { type: 'bid', amount: 505 }), /steps of 10/)
    rejects(() => t.act(first, { type: 'bid', amount: 910 }), /Maximum bid/)
    rejects(() => t.act(first, { type: 'bid', amount: 500.5 }), /whole number/)
  })

  it('makes each bid beat the last by the step', () => {
    const t = dealtTable(4)
    const first = t.room().round.current
    t.act(first, { type: 'bid', amount: 600 })
    rejects(() => t.act((first + 1) % 4, { type: 'bid', amount: 600 }), /at least 610/)
    rejects(() => t.act((first + 1) % 4, { type: 'bid', amount: 590 }), /at least 610/)
    t.act((first + 1) % 4, { type: 'bid', amount: 610 })
    assert.equal(t.room().round.highBid, 610)
  })

  it('reshuffles when everyone passes', () => {
    const t = dealtTable(4)
    const first = t.room().round.current
    const before = t.room().round.hands.map((hand) => hand.map((card) => card.id).join(','))
    for (let i = 0; i < 4; i++) t.act((first + i) % 4, { type: 'pass' })

    const after = t.room()
    assert.equal(after.status, 'bidding')
    assert.equal(after.round.bidTurn, 0)
    assert.equal(after.round.highBid, 0)
    assert.deepEqual(after.round.passed, [false, false, false, false])
    assert.notDeepEqual(after.round.hands.map((hand) => hand.map((card) => card.id).join(',')), before)
  })

  it('never forces a claim while a bid stands', () => {
    const t = dealtTable(4)
    const first = t.room().round.current
    t.act(first, { type: 'bid', amount: 500 })
    for (let i = 1; i < 3; i++) t.act((first + i) % 4, { type: 'pass' })
    assert.equal(t.view((first + 3) % 4).mustClaim, false)
    t.act((first + 3) % 4, { type: 'pass' })
    assert.equal(t.room().round.claimer, first)
  })

  it('works the same at six players', () => {
    const t = dealtTable(6)
    const first = t.room().round.current
    t.act(first, { type: 'bid', amount: 700 })
    for (let i = 1; i < 6; i++) t.act((first + i) % 6, { type: 'pass' })
    assert.equal(t.room().status, 'trump')
    assert.equal(t.room().round.claim, 700)
    assert.equal(t.room().match.cardLimit, 7)
  })

  it('reshuffles after all six players pass', () => {
    const t = dealtTable(6)
    const first = t.room().round.current
    const before = t.room().round.hands.map((hand) => hand.map((card) => card.id).join(','))

    for (let i = 0; i < 6; i++) t.act((first + i) % 6, { type: 'pass' })

    const after = t.room()
    assert.equal(after.status, 'bidding')
    assert.equal(after.round.bidTurn, 0)
    assert.equal(after.round.highBid, 0)
    assert.deepEqual(after.round.passed, [false, false, false, false, false, false])
    assert.notDeepEqual(after.round.hands.map((hand) => hand.map((card) => card.id).join(',')), before)
  })
})

describe('choosing trump', () => {
  it('is the claimer alone who picks', () => {
    const t = dealtTable(4)
    const first = t.room().round.current
    t.act(first, { type: 'bid', amount: 520 })
    for (let i = 1; i < 4; i++) t.act((first + i) % 4, { type: 'pass' })

    const claimer = t.room().round.claimer!
    const mine = t.room().round.hands[claimer][0].id
    rejects(() => t.act((claimer + 1) % 4, { type: 'selectTrump', cardId: mine }), /claimer/)
    t.act(claimer, { type: 'selectTrump', cardId: mine })
    assert.equal(t.room().status, 'playing')
  })

  it('rejects a card the claimer does not hold', () => {
    const t = dealtTable(4)
    const first = t.room().round.current
    t.act(first, { type: 'bid', amount: 520 })
    for (let i = 1; i < 4; i++) t.act((first + i) % 4, { type: 'pass' })
    const claimer = t.room().round.claimer!
    const notMine = t.room().round.hands[(claimer + 1) % 4][0].id
    rejects(() => t.act(claimer, { type: 'selectTrump', cardId: notMine }), /do not hold/)
    rejects(() => t.act(claimer, { type: 'selectTrump', cardId: 'Spades-99' }), /do not hold/)
  })

  it('hands the first lead to the player right of the claimer', () => {
    const t = toPlayingPhase(dealtTable(4))
    const claimer = t.room().round.claimer!
    assert.equal(t.room().round.current, (claimer - 1 + 4) % 4)
  })

  it('gives Player 2 the opening lead when Player 3 is the claimer', () => {
    const t = dealtTable(4)
    const first = t.room().round.current
    for (let i = 0; i < 4; i++) {
      const seat = (first + i) % 4
      t.act(seat, seat === 2 ? { type: 'bid', amount: 520 } : { type: 'pass' })
    }

    assert.equal(t.room().round.claimer, 2)
    const claimer = 2
    const card = t.room().round.hands[claimer][0]
    t.act(claimer, { type: 'selectTrump', cardId: card.id })
    assert.equal(t.room().round.current, 1)
  })
})

describe('what each player is allowed to see', () => {
  it('shows a player their own six cards', () => {
    const t = dealtTable(4)
    assert.equal(t.view(0).yourHand.length, 6)
  })

  it('never leaks another hand', () => {
    const t = dealtTable(4)
    const serialised = JSON.stringify(t.view(0))
    for (const seat of [1, 2, 3]) {
      for (const card of t.room().round.hands[seat]) {
        assert.ok(!serialised.includes(card.id), `${card.id} must not reach seat 0`)
      }
    }
  })

  it('shows opponents only as card counts', () => {
    const t = dealtTable(4)
    const v = t.view(0)
    assert.deepEqual(v.players.map((p) => p.handCount), [6, 6, 6, 6])
  })

  it('never leaks a secret', () => {
    const t = dealtTable(4)
    const serialised = JSON.stringify(t.view(0))
    for (const p of t.bySeat) assert.ok(!serialised.includes(p.secret), 'no secrets in the view')
  })

  it('hides the trump from everyone but the claimer', () => {
    const t = toPlayingPhase(dealtTable(4))
    const claimer = t.room().round.claimer!
    assert.equal(t.view(claimer).round.trumpSuit, 'Hearts', 'the claimer chose it')
    for (let seat = 0; seat < 4; seat++) {
      if (seat === claimer) continue
      assert.equal(t.view(seat).round.trumpSuit, null, `seat ${seat} must not see trump`)
      assert.equal(t.view(seat).round.trumpRevealed, false)
    }
  })

  it('reveals the trump to everyone once asked for', () => {
    const t = toPlayingPhase(dealtTable(4))
    const r = t.room()
    const claimer = t.room().round.claimer!
    const selectedTrumpId = t.room().round.trumpCard!.id
    const next = (claimer + 1) % 4
    rig(t, { [claimer]: ['Spades-2'], [next]: ['Hearts-3', 'Clubs-9'] }, claimer)
    r.round.trumpCard = buildDeck(4).find((card) => card.id === selectedTrumpId)!
    r.round.trumpSuit = 'Hearts'

    t.act(claimer, { type: 'playCard', cardId: 'Spades-2' })
    assert.equal(t.view(next).canAskTrump, true, 'void in spades, so may ask')
    t.act(next, { type: 'askTrump' })

    for (let seat = 0; seat < 4; seat++) {
      assert.equal(t.view(seat).round.trumpSuit, 'Hearts', `seat ${seat} now sees trump`)
      assert.equal(t.view(seat).round.trumpRevealed, true)
      assert.equal(t.view(seat).round.trumpCard?.id, selectedTrumpId, 'everyone sees the actual selected card')
    }
  })

  it('refuses a view to someone not at the table', () => {
    const t = dealtTable(4)
    rejects(() => viewFor(t.room(), 'stranger'), /not seated/)
  })
})

describe('playing cards', () => {
  it('refuses a card the player does not hold', () => {
    const t = toPlayingPhase(dealtTable(4))
    const seat = t.room().round.current
    const notMine = t.room().round.hands[(seat + 1) % 4][0].id
    rejects(() => t.act(seat, { type: 'playCard', cardId: notMine }), /do not hold/)
    rejects(() => t.act(seat, { type: 'playCard', cardId: 'Spades-99' }), /do not hold/)
  })

  it('refuses a play out of turn', () => {
    const t = toPlayingPhase(dealtTable(4))
    const seat = t.room().round.current
    const other = (seat + 1) % 4
    const theirCard = t.room().round.hands[other][0].id
    rejects(() => t.act(other, { type: 'playCard', cardId: theirCard }), /Not your turn/)
  })

  it('makes a player follow the led suit', () => {
    const t = toPlayingPhase(dealtTable(4))
    const leader = t.room().round.current
    const next = (leader + 1) % 4
    rig(t, { [leader]: ['Spades-2'], [next]: ['Spades-3', 'Hearts-A'] }, leader)

    t.act(leader, { type: 'playCard', cardId: 'Spades-2' })
    assert.deepEqual(t.view(next).playableIds, ['Spades-3'], 'only the spade is offered')
    rejects(() => t.act(next, { type: 'playCard', cardId: 'Hearts-A' }), /follow the led suit/)
    t.act(next, { type: 'playCard', cardId: 'Spades-3' })
    assert.equal(t.room().round.trick.length, 2)
  })

  it('moves the turn one seat left', () => {
    const t = toPlayingPhase(dealtTable(4))
    const leader = t.room().round.current
    t.act(leader, { type: 'playCard', cardId: t.room().round.hands[leader][0].id })
    assert.equal(t.room().round.current, (leader + 1) % 4)
  })

  it('gives the next lead to whoever took the trick', () => {
    const t = toPlayingPhase(dealtTable(4))
    for (let i = 0; i < 4; i++) {
      const seat = t.room().round.current
      const v = t.view(seat)
      t.act(seat, { type: 'playCard', cardId: v.playableIds[0] })
    }
    const r = t.room()
    assert.equal(r.round.trickNumber, 1)
    assert.equal(r.round.current, r.round.lastTrick!.winner)
    assert.equal(r.round.trick.length, 0, 'table cleared')
  })

  it('uses the trick winner for every lead after the opening trick', () => {
    const t = toPlayingPhase(dealtTable(4))

    for (let i = 0; i < 4; i++) {
      const seat = t.room().round.current
      const v = t.view(seat)
      t.act(seat, { type: 'playCard', cardId: v.playableIds[0] })
    }

    const r = t.room()
    assert.equal(r.round.current, r.round.lastTrick!.winner)
  })
})

describe('asking for trump', () => {
  it('is refused while the player can follow suit', () => {
    const t = toPlayingPhase(dealtTable(4))
    const leader = t.room().round.current
    const next = (leader + 1) % 4
    rig(t, { [leader]: ['Spades-2'], [next]: ['Spades-3', 'Hearts-A'] }, leader)

    t.act(leader, { type: 'playCard', cardId: 'Spades-2' })
    assert.equal(t.view(next).canAskTrump, false)
    rejects(() => t.act(next, { type: 'askTrump' }), /only ask when void/)
  })

  it('is refused to the leader', () => {
    const t = toPlayingPhase(dealtTable(4))
    rejects(() => t.act(t.room().round.current, { type: 'askTrump' }), /only ask when void/)
  })

  it('cannot be asked twice', () => {
    const t = toPlayingPhase(dealtTable(4))
    const r = t.room()
    r.round.trumpRevealed = true
    rejects(() => t.act(r.round.current, { type: 'askTrump' }), /already revealed/)
  })

  it('never forces the asker to then play trump', () => {
    const t = toPlayingPhase(dealtTable(4))
    const leader = t.room().round.current
    const next = (leader + 1) % 4
    // The asker holds a trump (hearts) and a plain club. Both must stay legal.
    rig(t, { [leader]: ['Spades-2'], [next]: ['Hearts-3', 'Clubs-9'] }, leader)

    t.act(leader, { type: 'playCard', cardId: 'Spades-2' })
    t.act(next, { type: 'askTrump' })

    const playable = t.view(next).playableIds
    assert.ok(playable.includes('Clubs-9'), 'a plain discard is still legal after asking')
    assert.ok(playable.includes('Hearts-3'), 'trumping is also still allowed')
    // And the discard is genuinely accepted, not merely offered.
    t.act(next, { type: 'playCard', cardId: 'Clubs-9' })
    assert.equal(t.room().round.trick.length, 2)
  })
})

describe('double', () => {
  it('is offered only to the claimer, on their last card', () => {
    const t = toPlayingPhase(dealtTable(4))
    const claimer = t.room().round.claimer!
    assert.equal(t.view(claimer).canCallDouble, false, 'not with six cards in hand')
  })

  it('rejects a call from anyone but the claimer', () => {
    const t = toPlayingPhase(dealtTable(4))
    const r = t.room()
    const claimer = r.round.claimer!
    const other = (claimer + 1) % 4
    // Put the other player on turn with a single card.
    r.round.current = other
    r.round.trumpCard = null
    r.round.hands[other] = r.round.hands[other].slice(0, 1)
    rejects(
      () => t.act(other, { type: 'playCard', cardId: r.round.hands[other][0].id, double: true }),
      /Only the claimer/,
    )
  })

  it('rejects a call before the last card', () => {
    const t = toPlayingPhase(dealtTable(4))
    const r = t.room()
    const claimer = r.round.claimer!
    r.round.current = claimer
    assert.ok(r.round.hands[claimer].length > 1)
    rejects(
      () => t.act(claimer, { type: 'playCard', cardId: r.round.hands[claimer][0].id, double: true }),
      /last card/,
    )
  })

  it('does not offer double before the first five tricks are swept', () => {
    const t = toPlayingPhase(dealtTable(4))
    const r = t.room()
    const claimer = r.round.claimer!
    r.round.current = claimer
    r.round.trickNumber = 4
    r.round.teamTricks = teamOf(claimer) === 0 ? [4, 0] : [0, 4]
    r.round.trumpCard = null
    r.round.hands[claimer] = r.round.hands[claimer].slice(0, 1)

    assert.equal(t.view(claimer).canCallDouble, false)
  })

  it('is recorded when called on the last card', () => {
    const t = toPlayingPhase(dealtTable(4))
    const r = t.room()
    const claimer = r.round.claimer!
    r.round.current = claimer
    r.round.trickNumber = 5
    r.round.teamTricks = teamOf(claimer) === 0 ? [5, 0] : [0, 5]
    r.round.trumpCard = null
    r.round.hands[claimer] = r.round.hands[claimer].slice(0, 1)
    const v = t.view(claimer)
    assert.equal(v.canCallDouble, true)
    t.act(claimer, { type: 'playCard', cardId: r.round.hands[claimer][0].id, double: true })
    assert.equal(t.room().round.doubleCalled, true)
  })
})

describe('finishing a round', () => {
  it('plays six tricks, empties every hand and settles', () => {
    const t = toPlayingPhase(dealtTable(4))
    const r = playOutRound(t)

    assert.ok(['roundOver', 'matchOver'].includes(r.status), `status was ${r.status}`)
    assert.equal(r.round.trickNumber, CARDS_PER_PLAYER)
    assert.ok(r.round.hands.every((h) => h.length === 0), 'every card played')
    assert.equal(r.round.teamScores[0] + r.round.teamScores[1], 884, 'all points accounted')
    assert.equal(r.round.teamTricks[0] + r.round.teamTricks[1], CARDS_PER_PLAYER)
    assert.ok(r.round.settlement, 'settled')
  })

  it('awards the settled cards to exactly one team', () => {
    const t = toPlayingPhase(dealtTable(4))
    const r = playOutRound(t)
    const s = r.round.settlement!
    assert.equal(r.match.teamCards[s.penalisedTeam], s.cards)
    assert.equal(r.match.teamCards[1 - s.penalisedTeam], 0, 'the other team takes none')
  })

  it('matches the settlement to what actually happened', () => {
    const t = toPlayingPhase(dealtTable(4))
    const r = playOutRound(t)
    const claimerTeam = teamOf(r.round.claimer!)
    const captured = r.round.teamScores[claimerTeam]
    const s = r.round.settlement!

    if (!r.round.doubleCalled) {
      assert.equal(s.success, captured >= r.round.claim, 'success tracks the points captured')
      assert.equal(s.penalisedTeam, s.success ? 1 - claimerTeam : claimerTeam)
    }
  })

  it('refuses to deal the next round early', () => {
    const t = toPlayingPhase(dealtTable(4))
    rejects(() => t.act(0, { type: 'nextRound' }), /not over/)
  })

  it('pays a correct double through the whole server path', () => {
    const t = toPlayingPhase(dealtTable(4), 520)
    const r = t.room()
    const claimer = r.round.claimer!
    const claimerTeam = teamOf(claimer)

    // Stand at the last trick with the claiming team having taken all five so
    // far, then let the claimer win the sixth with the strongest card, doubling.
    r.round.trickNumber = 5
    r.round.teamTricks = claimerTeam === 0 ? [5, 0] : [0, 5]
    r.round.teamScores = claimerTeam === 0 ? [884, 0] : [0, 884]
    rig(
      t,
      {
        [claimer]: ['Spades-2'],
        [(claimer + 1) % 4]: ['Spades-3'],
        [(claimer + 2) % 4]: ['Spades-J'],
        [(claimer + 3) % 4]: ['Spades-9'],
      },
      claimer,
    )

    assert.equal(t.view(claimer).canCallDouble, true)
    t.act(claimer, { type: 'playCard', cardId: 'Spades-2', double: true })
    for (let i = 1; i < 4; i++) {
      const seat = t.room().round.current
      t.act(seat, { type: 'playCard', cardId: t.view(seat).playableIds[0] })
    }

    const done = t.room()
    const s = done.round.settlement!
    assert.equal(done.round.teamTricks[claimerTeam], 6, 'swept every trick')
    assert.equal(s.success, true)
    assert.equal(s.penalisedTeam, 1 - claimerTeam, 'opponents pay')
    assert.equal(s.cards, 2, 'a 520 claim pays 1, plus 1 for the double')
    assert.equal(done.match.teamCards[1 - claimerTeam], 2)
  })

  it('punishes a missed double through the whole server path', () => {
    const t = toPlayingPhase(dealtTable(4), 520)
    const r = t.room()
    const claimer = r.round.claimer!
    const claimerTeam = teamOf(claimer)

    // Same last trick, but the claimer loses it, so the sweep fails.
    r.round.trickNumber = 5
    r.round.teamTricks = claimerTeam === 0 ? [5, 0] : [0, 5]
    r.round.teamScores = claimerTeam === 0 ? [884, 0] : [0, 884]
    rig(
      t,
      {
        [claimer]: ['Spades-9'],
        [(claimer + 1) % 4]: ['Spades-2'],
        [(claimer + 2) % 4]: ['Spades-J'],
        [(claimer + 3) % 4]: ['Spades-3'],
      },
      claimer,
    )

    t.act(claimer, { type: 'playCard', cardId: 'Spades-9', double: true })
    for (let i = 1; i < 4; i++) {
      const seat = t.room().round.current
      t.act(seat, { type: 'playCard', cardId: t.view(seat).playableIds[0] })
    }

    const done = t.room()
    const s = done.round.settlement!
    assert.equal(done.round.teamTricks[claimerTeam], 5, 'did not sweep')
    assert.equal(s.success, false)
    assert.equal(s.penalisedTeam, claimerTeam, 'the claimers pay')
    assert.equal(s.cards, 3, 'flat 3 under 700, replacing a claim they had made')
    assert.equal(s.reasons.length, 1, 'nothing else is added')
  })
})

describe('across rounds', () => {
  it('carries cards over, rotates the dealer and redeals', () => {
    const t = toPlayingPhase(dealtTable(4))
    const finished = playOutRound(t)
    // The largest single-round settlement is 4 cards, under the limit of 5, so
    // one round can never end a four-player match.
    assert.equal(finished.status, 'roundOver')

    const carried = [...finished.match.teamCards]
    const previousDealer = finished.round.dealer

    rejects(() => t.act(t.bySeat.findIndex((p) => p.id !== t.host.id), { type: 'nextRound' }), /host/)
    t.act(0, { type: 'nextRound' })

    const r = t.room()
    assert.deepEqual(r.match.teamCards, carried, 'cards persist')
    assert.equal(r.match.roundNumber, 2)
    assert.equal(r.round.dealer, (previousDealer + 1) % 4, 'dealer moves one seat left')
    assert.equal(r.status, 'bidding')
    assert.ok(r.round.hands.every((h) => h.length === CARDS_PER_PLAYER), 'fresh hands')
    assert.equal(r.round.settlement, null, 'last round cleared')
    assert.equal(r.round.doubleCalled, false)
  })

  it('runs a whole match to its end', () => {
    const t = dealtTable(4)
    let rounds = 0

    while (t.room().status !== 'matchOver' && rounds < 60) {
      rounds++
      const seats = t.room().seatCount
      const first = t.room().round.current
      t.act(first, { type: 'bid', amount: 520 })
      for (let i = 1; i < seats; i++) t.act((first + i) % seats, { type: 'pass' })
      const cl = t.room().round.claimer!
      ensureSuit(t, cl, 'Hearts')
      t.act(cl, { type: 'selectTrump', cardId: t.room().round.hands[cl].find((c) => c.suit === 'Hearts')!.id })
      playOutRound(t)
      if (t.room().status === 'roundOver') t.act(0, { type: 'nextRound' })
    }

    const r = t.room()
    assert.equal(r.status, 'matchOver', `match should end within 60 rounds, played ${rounds}`)
    assert.ok(r.match.loser === 0 || r.match.loser === 1, 'someone lost')
    assert.ok(
      r.match.teamCards[r.match.loser!] >= r.match.cardLimit,
      `loser reached the limit: ${r.match.teamCards} vs ${r.match.cardLimit}`,
    )
    assert.ok(
      r.match.teamCards[1 - r.match.loser!] < r.match.cardLimit,
      'only one team reached it',
    )
  })

  it('stops accepting play once the match is over', () => {
    const t = dealtTable(4)
    let rounds = 0
    while (t.room().status !== 'matchOver' && rounds < 60) {
      rounds++
      const seats = t.room().seatCount
      const first = t.room().round.current
      t.act(first, { type: 'bid', amount: 520 })
      for (let i = 1; i < seats; i++) t.act((first + i) % seats, { type: 'pass' })
      const cl = t.room().round.claimer!
      ensureSuit(t, cl, 'Hearts')
      t.act(cl, { type: 'selectTrump', cardId: t.room().round.hands[cl].find((c) => c.suit === 'Hearts')!.id })
      playOutRound(t)
      if (t.room().status === 'roundOver') t.act(0, { type: 'nextRound' })
    }
    assert.equal(t.room().status, 'matchOver')
    rejects(() => t.act(0, { type: 'nextRound' }), /not over/)
    rejects(() => t.act(0, { type: 'pass' }), /Not bidding/)
  })
})

describe('version counter', () => {
  it('advances on every accepted action so pollers notice', () => {
    const t = seatTable(4)
    const before = t.room().version
    applyAction(t.id, t.host.id, t.host.secret, { type: 'start' })
    assert.ok(t.room().version > before, 'start bumped the version')

    const mid = t.room().version
    t.act(t.room().round.current, { type: 'bid', amount: 500 })
    assert.ok(t.room().version > mid, 'bid bumped the version')
  })

  it('does not advance on a rejected action', () => {
    const t = dealtTable(4)
    const before = t.room().version
    rejects(() => t.act((t.room().round.current + 1) % 4, { type: 'pass' }), /Not your turn/)
    assert.equal(t.room().version, before, 'a rejected move changes nothing')
  })
})

describe('the face-down trump card', () => {
  it('leaves the claimer holding five playable cards', () => {
    const t = toPlayingPhase(dealtTable(4))
    const r = t.room()
    const claimer = r.round.claimer!

    assert.equal(r.round.hands[claimer].length, 5, 'one card is set aside')
    assert.ok(r.round.trumpCard, 'and it is held face down')
    assert.equal(r.round.trumpCard!.suit, r.round.trumpSuit, 'its suit is trump')
    assert.ok(
      !r.round.hands[claimer].some((c) => c.id === r.round.trumpCard!.id),
      'it is genuinely out of the hand, not just marked',
    )
  })

  it('shows the face-down card to the claimer alone', () => {
    const t = toPlayingPhase(dealtTable(4))
    const claimer = t.room().round.claimer!
    const trumpId = t.room().round.trumpCard!.id

    assert.equal(t.view(claimer).yourTrumpCard?.id, trumpId, 'the claimer knows their own card')
    for (let seat = 0; seat < 4; seat++) {
      const v = t.view(seat)
      assert.equal(v.trumpFaceDown, true, 'everyone can see that a card is face down')
      if (seat === claimer) continue
      assert.equal(v.yourTrumpCard, null, `seat ${seat} must not learn the card`)
      assert.ok(!JSON.stringify(v).includes(trumpId), `seat ${seat} must not see it anywhere`)
    }
  })

  it('will not let the claimer play it while it is face down', () => {
    const t = toPlayingPhase(dealtTable(4))
    const r = t.room()
    const claimer = r.round.claimer!
    const trumpId = r.round.trumpCard!.id
    r.round.current = claimer

    assert.ok(!t.view(claimer).playableIds.includes(trumpId), 'not offered')
    rejects(() => t.act(claimer, { type: 'playCard', cardId: trumpId }), /do not hold/)
  })

  it('makes the claimer void in that suit, so they may play anything', () => {
    const t = toPlayingPhase(dealtTable(4), 520, 'Hearts')
    const r = t.room()
    const claimer = r.round.claimer!
    const leader = (claimer - 1 + 4) % 4

    // The claimer's only heart is the one lying face down.
    rig(t, { [leader]: ['Hearts-2'], [claimer]: ['Spades-3', 'Clubs-9'] }, leader)
    r.round.trumpCard = buildDeck(4).find((c) => c.id === 'Hearts-A')!
    r.round.trumpSuit = 'Hearts'

    t.act(leader, { type: 'playCard', cardId: 'Hearts-2' })

    const v = t.view(claimer)
    assert.equal(v.playableIds.length, 2, 'both cards legal — they count as void')
    assert.equal(v.canAskTrump, true, 'and they may ask for their own trump')
  })

  it('hands the card back when trump is asked for', () => {
    const t = toPlayingPhase(dealtTable(4), 520, 'Hearts')
    const r = t.room()
    const claimer = r.round.claimer!
    const asker = (claimer + 1) % 4
    const leader = (claimer - 1 + 4) % 4

    rig(t, { [leader]: ['Spades-2'], [asker]: ['Clubs-9', 'Diamonds-3'] }, leader)
    r.round.trumpCard = buildDeck(4).find((c) => c.id === 'Hearts-A')!
    r.round.trumpSuit = 'Hearts'
    const handBefore = r.round.hands[claimer].length

    t.act(leader, { type: 'playCard', cardId: 'Spades-2' })
    // Seats between the leader and the asker pass through; put the asker on turn.
    r.round.current = asker
    assert.equal(t.view(asker).canAskTrump, true, 'void in spades, so the ask is offered')
    t.act(asker, { type: 'askTrump' })

    const after = t.room()
    assert.equal(after.round.trumpRevealed, true)
    assert.equal(after.round.trumpCard, null, 'no longer face down')
    assert.equal(after.round.hands[claimer].length, handBefore + 1, 'back in the claimer’s hand')
    assert.ok(
      after.round.hands[claimer].some((c) => c.id === 'Hearts-A'),
      'and it is the card that was set aside',
    )
  })

  it('comes back for the last trick when nobody ever asks', () => {
    const t = toPlayingPhase(dealtTable(4))
    const claimer = t.room().round.claimer!
    const trumpId = t.room().round.trumpCard!.id

    const done = playOutRound(t) // playOutRound never asks for trump

    assert.equal(done.round.trumpRevealed, false, 'trump never went live')
    assert.equal(done.round.trumpCard, null, 'the card was returned and played')
    assert.equal(done.round.hands[claimer].length, 0, 'the claimer played all six')
    assert.equal(done.round.trickNumber, 6)
    const everyCardPlayed = [
      ...(done.round.lastTrick?.plays ?? []).map((p) => p.card.id),
    ]
    assert.ok(everyCardPlayed.includes(trumpId), 'the trump card was the last card played')
  })

  it('refuses a double while the trump is still face down', () => {
    const t = toPlayingPhase(dealtTable(4))
    const r = t.room()
    const claimer = r.round.claimer!
    r.round.current = claimer
    r.round.hands[claimer] = r.round.hands[claimer].slice(0, 1)

    assert.equal(t.view(claimer).canCallDouble, false, 'not their real last card')
    rejects(
      () => t.act(claimer, { type: 'playCard', cardId: r.round.hands[claimer][0].id, double: true }),
      /last card/,
    )
  })
})
