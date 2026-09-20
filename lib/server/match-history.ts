import { randomUUID } from 'node:crypto'
import { teamOf } from '@/lib/game'
import { db } from '@/lib/server/db'
import type { Room } from '@/lib/server/rooms'

export interface LeaderboardEntry {
  key: string
  name: string
  gamesPlayed: number
  wins: number
}

export interface MatchHistoryPlayer {
  seat: number
  team: 0 | 1
  name: string
  won: boolean
}

export interface MatchHistoryEntry {
  id: string
  roomId: string
  seatCount: number
  finalClaim: number
  winningTeam: 0 | 1
  endedAt: string
  players: MatchHistoryPlayer[]
}

/** Call once a room's match.loser is set — persists the final result. Idempotent guard: only ever called once per room by resolveTrick. */
export function recordMatch(room: Room): void {
  if (room.match.loser === null) return
  const winningTeam: 0 | 1 = room.match.loser === 0 ? 1 : 0
  const matchId = randomUUID()

  db.prepare(
    `INSERT INTO matches (id, room_id, seat_count, rounds_played, final_claim, winning_team, ended_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(matchId, room.id, room.seatCount, room.match.roundNumber, room.round.claim, winningTeam, new Date().toISOString())

  const insertPlayer = db.prepare(
    `INSERT INTO match_players (match_id, seat, team, name, user_id, won) VALUES (?, ?, ?, ?, ?, ?)`,
  )
  for (const player of room.players) {
    const team = teamOf(player.seat)
    insertPlayer.run(matchId, player.seat, team, player.name, player.userId ?? null, team === winningTeam ? 1 : 0)
  }
}

/** Ranked by wins, then games played. Guests are grouped by name since they have no account. */
export function getLeaderboard(limit = 50): LeaderboardEntry[] {
  return db
    .prepare(
      `SELECT
         COALESCE(mp.user_id, 'guest:' || lower(mp.name)) AS key,
         COALESCE(u.username, mp.name) AS name,
         COUNT(*) AS gamesPlayed,
         SUM(mp.won) AS wins
       FROM match_players mp
       LEFT JOIN users u ON u.id = mp.user_id
       GROUP BY key
       ORDER BY wins DESC, gamesPlayed DESC
       LIMIT ?`,
    )
    .all(limit) as unknown as LeaderboardEntry[]
}

/** Total completed matches, all-time — durable across restarts (unlike the in-memory telemetry counters). */
export function getTotalMatchesPlayed(): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM matches`).get() as unknown as { count: number }
  return row.count
}

export function getRecentMatches(limit = 20): MatchHistoryEntry[] {
  const matches = db
    .prepare(
      `SELECT id, room_id AS roomId, seat_count AS seatCount, final_claim AS finalClaim,
              winning_team AS winningTeam, ended_at AS endedAt
       FROM matches ORDER BY ended_at DESC LIMIT ?`,
    )
    .all(limit) as unknown as Omit<MatchHistoryEntry, 'players'>[]

  const playersStmt = db.prepare(
    `SELECT mp.seat AS seat, mp.team AS team, COALESCE(u.username, mp.name) AS name, mp.won AS won
     FROM match_players mp
     LEFT JOIN users u ON u.id = mp.user_id
     WHERE mp.match_id = ?
     ORDER BY mp.seat`,
  )

  return matches.map((m) => ({
    ...m,
    players: (playersStmt.all(m.id) as unknown as { seat: number; team: 0 | 1; name: string; won: number }[]).map(
      (p) => ({ ...p, won: p.won === 1 }),
    ),
  }))
}
