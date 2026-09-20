# Product Requirements

## Scope

Thinnai is a single online experience. The home screen (`/`) is one flow: pick a
4- or 6-seat table, enter a name, and choose Bot or "Invite a person" for every
other seat. Creating a table always opens a server-authoritative online room
(`/thinnai/[id]`) — there is no separate local pass-and-play or offline solo
mode reachable from the UI anymore. (The old local single-device engine,
`components/card-game.tsx` / `components/config-menu.tsx`, still exists in the
repo but is not linked from any page.)

Bot seats play themselves end to end: bidding, choosing trump, following suit,
asking for trump when void, and calling double when eligible — the same rules
a human seat follows, on a short delay so their turns are readable.

## Core principles

- Server-authoritative online gameplay. `lib/server/rooms.ts` is the single
  source of truth; clients only render `viewFor(room, playerId)` and send
  actions.
- Hidden hands and hidden (unrevealed) trump are never sent to anyone but their
  owner. Bots follow the same visibility rules as humans.
- Real selected cards are preserved and displayed; no fake placeholders.
- Every important rule has functional test coverage (`tests/rooms.test.ts`,
  `tests/game.test.ts`).
- All layouts work on phones, tablets, and desktop.

## Claim ladder and solo claim

- Bidding is one lap: minimum 500, steps of 10, up to 900.
- A claim can jump straight from 900 to 904 — a solo claim. Winning a solo
  claim skips trump entirely: there is no trump card, the claimer's partner
  sits out the round, and the claimer plays every trick alone against both
  opponents.

## Seats and teams

- Teams alternate by seat: 4 seats are P1/P3 vs P2/P4; 6 seats are
  P1/P3/P5 vs P2/P4/P6. Team membership is always derived from seat parity.
- Anyone opening the invite link picks their own open seat (and therefore
  their team) from a live-updating seat picker before they take it — seats
  are not auto-assigned in join order.
- The host can "shuffle teams" from the lobby at any point before dealing: it
  randomly re-seats the already-seated human players among the human seats
  (bots keep their seats), which is the fair, random way to split an all-human
  table into two sides.

## Accounts, results, and metrics

- Optional accounts via Auth.js (username/password `Credentials` provider;
  Facebook is wired but disabled by default). Guests can play and appear in
  match history without ever logging in.
- `/results` is public. It shows the leaderboard, recent match history, and a
  server metrics panel: total games played (durable, backed by SQLite) plus
  process-local counters for rooms/rounds/actions and recent
  client/server error messages (these reset on a server restart).
- `/api/health` exposes the same metrics as JSON, optionally protected by a
  `MONITORING_TOKEN` env var for public deployments.

## Deployment

A small friends' trial can run on a single long-lived Render/Railway/Node
process. Rooms live in memory in that one process, so this does **not**
survive a multi-instance deploy (e.g. Vercel) without swapping the in-memory
room store for Redis. Accounts and match history persist to a local SQLite
file (`data/app.db`) via `node:sqlite`, independent of the in-memory rooms.

Before shipping: `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`, then
`pnpm start`.

