import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  BIG_BID,
  buildDeck,
  CARDS_PER_PLAYER,
  cardLimit,
  chooseBotCard,
  type Card,
  evaluateTrick,
  getPlayable,
  MAX_CLAIM,
  MIN_CLAIM,
  RANK_POINTS,
  rankStrength,
  settleRound,
  shuffle,
  sortHand,
  type Suit,
  SUITS,
  teamLabel,
  teamMembers,
  teamOf,
  trickPoints,
  type TrickPlay,
} from '@/lib/game'

const DECK6 = buildDeck(6)
const card = (id: string): Card => {
  const found = DECK6.find((c) => c.id === id)
  if (!found) throw new Error(`no such card: ${id}`)
  return found
}
const hand = (...ids: string[]): Card[] => ids.map(card)
const play = (player: number, id: string): TrickPlay => ({ player, card: card(id) })

describe('deck', () => {
  it('deals exactly one full deck at each table size', () => {
    for (const seats of [4, 6]) {
      const deck = buildDeck(seats)
      assert.equal(deck.length, seats * CARDS_PER_PLAYER, `${seats}p deck size`)
      assert.equal(new Set(deck.map((c) => c.id)).size, deck.length, 'no duplicate cards')
    }
  })

  it('gives every suit the same ranks', () => {
    for (const seats of [4, 6]) {
      const bySuit = new Map<Suit, string[]>()
      for (const c of buildDeck(seats)) {
        bySuit.set(c.suit, [...(bySuit.get(c.suit) ?? []), c.rank])
      }
      assert.equal(bySuit.size, 4, 'all four suits present')
      const shapes = new Set([...bySuit.values()].map((ranks) => ranks.slice().sort().join(',')))
      assert.equal(shapes.size, 1, 'every suit holds identical ranks')
    }
  })

  it('totals 884 at four players and 904 at six', () => {
    const total = (seats: number) => buildDeck(seats).reduce((sum, c) => sum + c.points, 0)
    assert.equal(total(4), 884)
    assert.equal(total(6), 904)
  })

  it('adds K, Q and 8 only at six players', () => {
    const ranks = (seats: number) => new Set(buildDeck(seats).map((c) => c.rank))
    assert.ok(!ranks(4).has('K') && !ranks(4).has('Q') && !ranks(4).has('8'))
    assert.ok(ranks(6).has('K') && ranks(6).has('Q') && ranks(6).has('8'))
  })

  it('scores every card according to the points table', () => {
    for (const c of DECK6) assert.equal(c.points, RANK_POINTS[c.rank], `${c.id} points`)
  })
})

describe('rank strength', () => {
  it('runs 2 3 J 9 A 10 K Q 8 from strongest to weakest', () => {
    const order = ['2', '3', 'J', '9', 'A', '10', 'K', 'Q', '8'] as const
    for (let i = 1; i < order.length; i++) {
      assert.ok(
        rankStrength(order[i - 1]) < rankStrength(order[i]),
        `${order[i - 1]} should beat ${order[i]}`,
      )
    }
  })

  it('makes the 2 both strongest and most valuable', () => {
    assert.equal(rankStrength('2'), 0)
    assert.equal(Math.max(...Object.values(RANK_POINTS)), RANK_POINTS['2'])
  })
})

describe('sortHand', () => {
  it('groups by suit and orders by strength without mutating', () => {
    const original = hand('Diamonds-10', 'Hearts-2', 'Clubs-9', 'Spades-3')
    const snapshot = original.map((c) => c.id)
    const sorted = sortHand(original)

    assert.deepEqual(original.map((c) => c.id), snapshot, 'input untouched')
    assert.deepEqual(sorted.map((c) => c.id), ['Spades-3', 'Hearts-2', 'Clubs-9', 'Diamonds-10'])
  })

  it('keeps each suit together in the configured suit order', () => {
    const sorted = sortHand(hand('Diamonds-2', 'Clubs-3', 'Clubs-J', 'Spades-9', 'Clubs-A'))
    assert.deepEqual(sorted.map((c) => c.id), ['Spades-9', 'Diamonds-2', 'Clubs-3', 'Clubs-J', 'Clubs-A'])
  })

  it('puts the black suit between two red suits when Clubs are absent', () => {
    const sorted = sortHand(hand('Diamonds-2', 'Hearts-A', 'Spades-9'))
    assert.deepEqual(sorted.map((c) => c.id), ['Hearts-A', 'Spades-9', 'Diamonds-2'])
  })

  it('covers every non-empty suit combination', () => {
    const cases: [string, Suit[]][] = [
      ['Spades', ['Spades']],
      ['Clubs', ['Clubs']],
      ['Hearts', ['Hearts']],
      ['Diamonds', ['Diamonds']],
      ['Spades + Clubs', ['Spades', 'Clubs']],
      ['Spades + Hearts', ['Spades', 'Hearts']],
      ['Spades + Diamonds', ['Spades', 'Diamonds']],
      ['Clubs + Hearts', ['Clubs', 'Hearts']],
      ['Clubs + Diamonds', ['Clubs', 'Diamonds']],
      ['Hearts + Diamonds', ['Hearts', 'Diamonds']],
      ['Spades + Clubs + Hearts', ['Spades', 'Hearts', 'Clubs']],
      ['Spades + Clubs + Diamonds', ['Spades', 'Diamonds', 'Clubs']],
      ['Spades + Hearts + Diamonds', ['Hearts', 'Spades', 'Diamonds']],
      ['Clubs + Hearts + Diamonds', ['Hearts', 'Clubs', 'Diamonds']],
      ['all suits', ['Spades', 'Hearts', 'Clubs', 'Diamonds']],
    ]

    for (const [label, expected] of cases) {
      const cards = expected.flatMap((suit, index) => [`${suit}-A`, `${suit}-${index === 0 ? '2' : '3'}`])
      const actual = sortHand(hand(...cards)).map((card) => card.suit)
      const grouped = [...new Set(actual)]
      assert.deepEqual(grouped, expected, label)
      assert.equal(actual.length, cards.length, `${label}: no cards lost`)
    }
  })
})

describe('shuffle', () => {
  it('preserves every card and leaves the input alone', () => {
    const deck = buildDeck(6)
    const before = deck.map((c) => c.id)
    const shuffled = shuffle(deck)

    assert.deepEqual(deck.map((c) => c.id), before, 'input untouched')
    assert.deepEqual(
      shuffled.map((c) => c.id).sort(),
      before.slice().sort(),
      'same multiset of cards',
    )
  })

  it('actually reorders across repeated runs', () => {
    const deck = buildDeck(6)
    const identical = Array.from({ length: 20 }, () =>
      shuffle(deck).map((c) => c.id).join(',') === deck.map((c) => c.id).join(','),
    )
    assert.ok(identical.some((same) => !same), 'at least one run differs from the original')
  })
})

describe('teams', () => {
  it('alternates seats between the two teams', () => {
    assert.deepEqual([0, 1, 2, 3].map(teamOf), [0, 1, 0, 1])
    assert.deepEqual([0, 1, 2, 3, 4, 5].map(teamOf), [0, 1, 0, 1, 0, 1])
  })

  it('splits the table evenly', () => {
    for (const seats of [4, 6]) {
      const [a, b] = teamMembers(seats)
      assert.equal(a.length, seats / 2)
      assert.equal(b.length, seats / 2)
      assert.equal(new Set([...a, ...b]).size, seats, 'every seat on exactly one team')
    }
  })

  it('always names a team with its members', () => {
    assert.equal(teamLabel(0, 4), 'Team A (P1, P3)')
    assert.equal(teamLabel(1, 4), 'Team B (P2, P4)')
    assert.equal(teamLabel(0, 6), 'Team A (P1, P3, P5)')
    assert.equal(teamLabel(1, 6), 'Team B (P2, P4, P6)')
  })

  it('needs 5 cards to lose at four players and 7 at six', () => {
    assert.equal(cardLimit(4), 5)
    assert.equal(cardLimit(6), 7)
  })
})

describe('getPlayable', () => {
  const myHand = hand('Spades-2', 'Spades-3', 'Hearts-A', 'Clubs-9')

  it('lets the leader play anything', () => {
    const result = getPlayable(myHand, [], false)
    assert.equal(result.reason, 'lead')
    assert.equal(result.playableIds.size, myHand.length)
    assert.equal(result.canAskTrump, false, 'cannot ask when leading')
  })

  it('forces following the led suit when able', () => {
    const result = getPlayable(myHand, [play(0, 'Spades-9')], false)
    assert.equal(result.reason, 'follow')
    assert.deepEqual([...result.playableIds].sort(), ['Spades-2', 'Spades-3'])
    assert.equal(result.canAskTrump, false, 'cannot ask while able to follow')
  })

  it('frees a void player to play absolutely anything', () => {
    const result = getPlayable(myHand, [play(0, 'Diamonds-9')], false)
    assert.equal(result.reason, 'void')
    assert.equal(result.playableIds.size, myHand.length, 'no forced trump')
    assert.equal(result.canAskTrump, true)
  })

  it('stops offering the ask once trump is already revealed', () => {
    const result = getPlayable(myHand, [play(0, 'Diamonds-9')], true)
    assert.equal(result.reason, 'void')
    assert.equal(result.playableIds.size, myHand.length, 'still unrestricted')
    assert.equal(result.canAskTrump, false)
  })

  it('never offers a card the player does not hold, and never offers nothing', () => {
    const ids = new Set(myHand.map((c) => c.id))
    for (const led of SUITS) {
      for (const revealed of [false, true]) {
        const result = getPlayable(myHand, [play(0, `${led}-9`)], revealed)
        assert.ok(result.playableIds.size > 0, `${led} revealed=${revealed}: some card is legal`)
        for (const id of result.playableIds) {
          assert.ok(ids.has(id), `${id} is actually in hand`)
        }
      }
    }
  })
})

describe('evaluateTrick', () => {
  it('gives the trick to the highest card of the led suit', () => {
    const trick = [play(0, 'Spades-10'), play(1, 'Spades-2'), play(2, 'Spades-9')]
    assert.equal(evaluateTrick(trick, 'Hearts', false), 1, 'the 2 is the strongest')
  })

  it('ignores off-suit cards entirely', () => {
    const trick = [play(0, 'Spades-10'), play(1, 'Hearts-2'), play(2, 'Clubs-2')]
    assert.equal(evaluateTrick(trick, 'Diamonds', true), 0, 'only the led suit competes')
  })

  it('leaves a hidden trump powerless', () => {
    const trick = [play(0, 'Spades-A'), play(1, 'Hearts-2')]
    assert.equal(evaluateTrick(trick, 'Hearts', false), 0, 'trump not revealed yet')
  })

  it('lets a revealed trump beat the led suit', () => {
    const trick = [play(0, 'Spades-A'), play(1, 'Hearts-8')]
    assert.equal(evaluateTrick(trick, 'Hearts', true), 1, 'even the weakest trump wins')
  })

  it('ranks trumps against each other when several are played', () => {
    const trick = [play(0, 'Spades-2'), play(1, 'Hearts-10'), play(2, 'Hearts-3')]
    assert.equal(evaluateTrick(trick, 'Hearts', true), 2, 'the 3 outranks the 10')
  })

  it('always names a seat that actually played', () => {
    const trick = [play(3, 'Clubs-9'), play(0, 'Clubs-A'), play(1, 'Diamonds-2')]
    const winner = evaluateTrick(trick, 'Spades', true)
    assert.ok(trick.some((p) => p.player === winner), 'winner participated')
  })
})

describe('chooseBotCard', () => {
  it('uses the cheapest legal card that can beat an opponent', () => {
    const chosen = chooseBotCard(
      hand('Spades-2', 'Spades-8'),
      new Set(['Spades-2', 'Spades-8']),
      [play(0, 'Spades-10')],
      null,
      false,
      1,
    )
    assert.equal(chosen?.id, 'Spades-2')
  })

  it('supports a teammate by adding points without overtaking their trick', () => {
    const chosen = chooseBotCard(
      hand('Clubs-2', 'Clubs-8'),
      new Set(['Clubs-2', 'Clubs-8']),
      [play(0, 'Hearts-2')],
      null,
      false,
      2,
    )
    assert.equal(chosen?.id, 'Clubs-2')
  })

  it('never chooses a card outside the legal playable set', () => {
    const chosen = chooseBotCard(
      hand('Spades-8', 'Hearts-2'),
      new Set(['Spades-8']),
      [play(0, 'Spades-10')],
      null,
      false,
      1,
    )
    assert.equal(chosen?.id, 'Spades-8')
  })
})

describe('trickPoints', () => {
  it('sums the points of every card in the trick', () => {
    assert.equal(trickPoints([play(0, 'Spades-2'), play(1, 'Hearts-3')]), 150)
  })

  it('counts a trick of zero-point cards as zero', () => {
    assert.equal(trickPoints([play(0, 'Spades-8'), play(1, 'Hearts-8')]), 0)
  })
})

describe('settleRound', () => {
  const base = {
    claim: 510,
    claimerTeam: 0 as const,
    captured: 600,
    teamTricks: [4, 2] as [number, number],
    doubleCalled: false,
  }
  const settle = (over: Partial<typeof base>) => settleRound({ ...base, ...over })

  describe('a made claim', () => {
    it('costs the opponents 1 card under 700', () => {
      const r = settle({})
      assert.equal(r.success, true)
      assert.equal(r.penalisedTeam, 1)
      assert.equal(r.cards, 1)
    })

    it('costs the opponents 3 cards at 700 and above', () => {
      assert.equal(settle({ claim: BIG_BID, captured: 750 }).cards, 3)
      assert.equal(settle({ claim: 800, captured: 850 }).cards, 3)
    })

    it('treats capturing exactly the claim as success', () => {
      const r = settle({ claim: 600, captured: 600 })
      assert.equal(r.success, true)
      assert.equal(r.penalisedTeam, 1)
    })

    it('puts 700 itself on the big side of the line', () => {
      assert.equal(settle({ claim: 690, captured: 700 }).cards, 1)
      assert.equal(settle({ claim: 700, captured: 700 }).cards, 3)
    })
  })

  describe('a failed claim', () => {
    it('costs the claiming team 2 cards under 700', () => {
      const r = settle({ captured: 400 })
      assert.equal(r.success, false)
      assert.equal(r.penalisedTeam, 0, 'the claimers pay')
      assert.equal(r.cards, 2)
    })

    it('costs the claiming team 3 cards at 700 and above', () => {
      assert.equal(settle({ claim: 700, captured: 500 }).cards, 3)
    })

    it('adds a card when they could not capture half the claim', () => {
      assert.equal(settle({ claim: 600, captured: 200 }).cards, 3, '2 + shortfall')
      assert.equal(settle({ claim: 800, captured: 100 }).cards, 4, '3 + shortfall')
    })

    it('treats exactly half as no shortfall', () => {
      assert.equal(settle({ claim: 600, captured: 300 }).cards, 2, 'half is not under half')
      assert.equal(settle({ claim: 600, captured: 299 }).cards, 3, 'just under half is')
    })

    it('explains itself in the reasons', () => {
      const r = settle({ claim: 600, captured: 100 })
      assert.equal(r.reasons.length, 2)
      assert.match(r.reasons[1], /half/i)
    })
  })

  describe('double', () => {
    const swept = { teamTricks: [6, 0] as [number, number], captured: 884, doubleCalled: true }

    it('pays the normal win plus one when it comes off', () => {
      assert.equal(settle({ ...swept }).cards, 2, '1 + 1 under 700')
      assert.equal(settle({ ...swept, claim: 700 }).cards, 4, '3 + 1 at 700')
    })

    it('sends a correct double against the opponents', () => {
      const r = settle({ ...swept })
      assert.equal(r.penalisedTeam, 1)
      assert.equal(r.success, true)
    })

    it('costs a flat 3 under 700 when missed', () => {
      const r = settle({ teamTricks: [5, 1], captured: 700, doubleCalled: true })
      assert.equal(r.penalisedTeam, 0)
      assert.equal(r.cards, 3)
      assert.equal(r.success, false)
    })

    it('costs a flat 4 at 700 and above when missed', () => {
      const r = settle({ claim: 800, teamTricks: [5, 1], captured: 850, doubleCalled: true })
      assert.equal(r.cards, 4)
    })

    it('replaces the settlement even when the claim itself was made', () => {
      // Captured well past the claim, but did not sweep: the double still bites,
      // turning a round that would have paid 1 into a 3-card loss.
      const r = settle({ claim: 510, captured: 800, teamTricks: [5, 1], doubleCalled: true })
      assert.equal(r.penalisedTeam, 0)
      assert.equal(r.cards, 3)
    })

    it('ignores shortfall entirely', () => {
      const r = settle({ claim: 800, captured: 20, teamTricks: [1, 5], doubleCalled: true })
      assert.equal(r.cards, 4, 'flat, no shortfall added')
      assert.equal(r.reasons.length, 1)
    })

    it('is worse than simply failing, which is the point', () => {
      const failed = settle({ captured: 400 }).cards
      const missed = settle({ captured: 400, teamTricks: [3, 3], doubleCalled: true }).cards
      assert.ok(missed > failed, `${missed} should exceed ${failed}`)
    })
  })

  describe('defenders sweeping', () => {
    it('is a failed claim with shortfall, not a bonus of its own', () => {
      const r = settle({ claim: 600, captured: 0, teamTricks: [0, 6] })
      assert.equal(r.penalisedTeam, 0)
      assert.equal(r.cards, 3, '2 + shortfall')
    })
  })

  describe('invariants', () => {
    it('always awards at least one card to exactly one team', () => {
      const claims = [MIN_CLAIM, 510, 690, 700, 800, MAX_CLAIM]
      const captures = [0, 100, 441, 500, 700, 884]
      const tricks: [number, number][] = [[6, 0], [0, 6], [3, 3], [5, 1]]
      for (const claim of claims) {
        for (const captured of captures) {
          for (const teamTricks of tricks) {
            for (const doubleCalled of [false, true]) {
              for (const claimerTeam of [0, 1] as const) {
                const r = settleRound({ claim, claimerTeam, captured, teamTricks, doubleCalled })
                assert.ok(r.cards >= 1, 'at least one card changes hands')
                assert.ok(r.penalisedTeam === 0 || r.penalisedTeam === 1, 'a real team pays')
                assert.ok(r.reasons.length >= 1, 'always explained')
              }
            }
          }
        }
      }
    })

    it('never penalises the claiming team on a success, or the opponents on a failure', () => {
      for (const claim of [MIN_CLAIM, 700, MAX_CLAIM]) {
        for (const captured of [0, 500, 904]) {
          for (const claimerTeam of [0, 1] as const) {
            const r = settleRound({
              claim,
              claimerTeam,
              captured,
              teamTricks: [3, 3],
              doubleCalled: false,
            })
            assert.equal(
              r.penalisedTeam,
              r.success ? 1 - claimerTeam : claimerTeam,
              'cards flow to the losing side of the exchange',
            )
          }
        }
      }
    })
  })
})

describe('a fully played round', () => {
  it('stays legal and accounts for every point, over many random deals', () => {
    for (let iteration = 0; iteration < 300; iteration++) {
      const seats = iteration % 2 === 0 ? 4 : 6
      const deck = shuffle(buildDeck(seats))
      const hands = Array.from({ length: seats }, (_, seat) =>
        sortHand(deck.slice(seat * CARDS_PER_PLAYER, (seat + 1) * CARDS_PER_PLAYER)),
      )
      const trumpSuit = SUITS[iteration % 4]
      let revealed = false
      let leader = 0
      const scores: [number, number] = [0, 0]
      const tricks: [number, number] = [0, 0]

      for (let t = 0; t < CARDS_PER_PLAYER; t++) {
        const trick: TrickPlay[] = []
        for (let k = 0; k < seats; k++) {
          const seat = (leader + k) % seats
          const options = getPlayable(hands[seat], trick, revealed)

          if (trick.length > 0) {
            const led = trick[0].card.suit
            const holdsLed = hands[seat].some((c) => c.suit === led)
            if (holdsLed) {
              assert.ok(
                [...options.playableIds].every((id) =>
                  hands[seat].find((c) => c.id === id)?.suit === led,
                ),
                'a player holding the led suit may only play it',
              )
            }
          }

          if (options.canAskTrump && (iteration + seat) % 3 === 0) revealed = true

          const legal = hands[seat].filter((c) => options.playableIds.has(c.id))
          assert.ok(legal.length > 0, 'always something to play')
          const chosen = legal[Math.floor(Math.random() * legal.length)]
          hands[seat] = hands[seat].filter((c) => c.id !== chosen.id)
          trick.push({ player: seat, card: chosen })
        }

        assert.equal(trick.length, seats, 'every seat contributed')
        const winner = evaluateTrick(trick, trumpSuit, revealed)
        scores[teamOf(winner)] += trickPoints(trick)
        tricks[teamOf(winner)] += 1
        leader = winner
      }

      assert.ok(hands.every((h) => h.length === 0), 'every card played')
      assert.equal(tricks[0] + tricks[1], CARDS_PER_PLAYER, 'six tricks, all won')
      assert.equal(
        scores[0] + scores[1],
        buildDeck(seats).reduce((sum, c) => sum + c.points, 0),
        'no points created or lost',
      )
    }
  })
})

describe('the position from the reported screenshot', () => {
  // Clubs led with 10♣ 9♣ J♣; the player on turn holds 3♠ A♠ 10♠ J♥ 9♦ and no
  // club at all, with the trump still face down. The ask must be on offer.
  const onTurn = hand('Spades-3', 'Spades-A', 'Spades-10', 'Hearts-J', 'Diamonds-9')
  const led = [play(0, 'Clubs-10'), play(1, 'Clubs-9'), play(2, 'Clubs-J')]

  it('offers the ask to a player with no card of the led suit', () => {
    const result = getPlayable(onTurn, led, false)
    assert.equal(result.reason, 'void')
    assert.equal(result.canAskTrump, true, 'the button should be live here')
  })

  it('lets them play any of their five cards', () => {
    const result = getPlayable(onTurn, led, false)
    assert.equal(result.playableIds.size, 5)
    assert.deepEqual(
      [...result.playableIds].sort(),
      ['Diamonds-9', 'Hearts-J', 'Spades-10', 'Spades-3', 'Spades-A'],
    )
  })

  it('withdraws the ask once trump is already out', () => {
    assert.equal(getPlayable(onTurn, led, true).canAskTrump, false)
  })
})
