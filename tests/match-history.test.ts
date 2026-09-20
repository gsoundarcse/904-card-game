import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyAction, createRoom, getRoom, joinRoom, type Room, viewFor } from '@/lib/server/rooms'
import { getLeaderboard, getRecentMatches, getTotalMatchesPlayed, recordMatch } from '@/lib/server/match-history'

/** A minimal object shaped like the parts of Room that recordMatch reads. */
function fakeRoom(overrides: {
  id: string
  loser: 0 | 1
  claim?: number
  players: { seat: number; name: string; userId?: string }[]
}): Room {
  return {
    id: overrides.id,
    seatCount: 4,
    match: { roundNumber: 3, teamCards: [0, 0], cardLimit: 5, loser: overrides.loser },
    round: { claim: overrides.claim ?? 520 },
    players: overrides.players,
  } as unknown as Room
}

describe('recordMatch', () => {
  it('does nothing when the match has no loser yet', () => {
    const before = getTotalMatchesPlayed()
    recordMatch(fakeRoom({ id: 'no-loser-room', loser: null as unknown as 0, players: [] }))
    assert.equal(getTotalMatchesPlayed(), before)
  })

  it('persists exactly one match row per call', () => {
    const before = getTotalMatchesPlayed()
    recordMatch(
      fakeRoom({
        id: `mh-single-${before}`,
        loser: 1,
        players: [
          { seat: 0, name: 'Alice' },
          { seat: 1, name: 'Bob' },
          { seat: 2, name: 'Carol' },
          { seat: 3, name: 'Dave' },
        ],
      }),
    )
    assert.equal(getTotalMatchesPlayed(), before + 1)
  })

  it('marks winners and losers correctly in recent matches', () => {
    const id = `mh-winners-${Date.now()}`
    recordMatch(
      fakeRoom({
        id,
        loser: 0, // team 0 (seats 0/2) loses, team 1 (seats 1/3) wins
        claim: 620,
        players: [
          { seat: 0, name: 'Alice' },
          { seat: 1, name: 'Bob' },
          { seat: 2, name: 'Carol' },
          { seat: 3, name: 'Dave' },
        ],
      }),
    )
    const match = getRecentMatches(1).find((m) => m.roomId === id)
    assert.ok(match, 'the match should be findable by room id')
    assert.equal(match!.winningTeam, 1)
    assert.equal(match!.finalClaim, 620)
    const bySeat = new Map(match!.players.map((p) => [p.seat, p.won]))
    assert.equal(bySeat.get(0), false)
    assert.equal(bySeat.get(1), true)
    assert.equal(bySeat.get(2), false)
    assert.equal(bySeat.get(3), true)
  })

  it('groups guests without accounts by lower-cased name on the leaderboard', () => {
    const before = getLeaderboard(500).find((e) => e.key === 'guest:repeatguest')
    const beforeWins = before?.wins ?? 0
    const beforeGames = before?.gamesPlayed ?? 0

    // Same guest name, different casing, wins once and loses once.
    recordMatch(
      fakeRoom({
        id: `mh-guest-win-${Date.now()}`,
        loser: 1,
        players: [
          { seat: 0, name: 'RepeatGuest' },
          { seat: 1, name: 'Other' },
          { seat: 2, name: 'Third' },
          { seat: 3, name: 'Fourth' },
        ],
      }),
    )
    recordMatch(
      fakeRoom({
        id: `mh-guest-loss-${Date.now()}`,
        loser: 0,
        players: [
          { seat: 0, name: 'repeatguest' },
          { seat: 1, name: 'Other' },
          { seat: 2, name: 'Third' },
          { seat: 3, name: 'Fourth' },
        ],
      }),
    )

    const after = getLeaderboard(500).find((e) => e.key === 'guest:repeatguest')
    assert.ok(after, 'guest should appear on the leaderboard grouped by lower(name)')
    assert.equal(after!.gamesPlayed, beforeGames + 2, 'both matches count for the same guest key')
    assert.equal(after!.wins, beforeWins + 1, 'only the match they won counts as a win')
  })
})

// ---------------------------------------------------------------------------
// End-to-end: a real match played through the server actually reaches the
// database, not just the unit-tested recordMatch calls above.
// ---------------------------------------------------------------------------

describe('match history end to end', () => {
  it('records a real match driven entirely through applyAction', () => {
    const { room: created, player: host } = createRoom(4, 'E2EHost')
    const others = [joinRoom(created.id, 'E2EP2').player, joinRoom(created.id, 'E2EP3').player, joinRoom(created.id, 'E2EP4').player]
    applyAction(created.id, host.id, host.secret, { type: 'start' })

    const before = getTotalMatchesPlayed()
    let rounds = 0
    while (getRoom(created.id)!.status !== 'matchOver' && rounds < 60) {
      rounds++
      const room = getRoom(created.id)!
      const bySeat = [host, ...others].slice().sort((a, b) => a.seat - b.seat)
      const first = room.round.current
      applyAction(room.id, bySeat[first].id, bySeat[first].secret, { type: 'bid', amount: 520 })
      for (let i = 1; i < room.seatCount; i++) {
        const seat = (first + i) % room.seatCount
        applyAction(room.id, bySeat[seat].id, bySeat[seat].secret, { type: 'pass' })
      }
      const claimer = getRoom(created.id)!.round.claimer!
      const hand = getRoom(created.id)!.round.hands[claimer]
      applyAction(room.id, bySeat[claimer].id, bySeat[claimer].secret, { type: 'selectTrump', cardId: hand[0].id })

      let guard = 0
      while (getRoom(created.id)!.status === 'playing' && guard++ < 200) {
        const r = getRoom(created.id)!
        const seat = r.round.current
        const p = bySeat[seat]
        const playableId = viewFor(r, p.id).playableIds[0]
        applyAction(room.id, p.id, p.secret, { type: 'playCard', cardId: playableId })
      }
      if (getRoom(created.id)!.status === 'roundOver') {
        applyAction(room.id, host.id, host.secret, { type: 'nextRound' })
      }
    }

    assert.equal(getRoom(created.id)!.status, 'matchOver', `match should finish within 60 rounds, played ${rounds}`)
    assert.equal(getTotalMatchesPlayed(), before + 1, 'the real match should have been recorded exactly once')
    const recorded = getRecentMatches(1).find((m) => m.roomId === created.id)
    assert.ok(recorded, 'the real match should be visible in recent matches')
  })
})
