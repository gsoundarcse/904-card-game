@AGENTS.md

# 904

A trick-taking bidding game, playable two ways:

- `/` — pass-and-play on one device, all seats on one screen.
- `/thinnai` — online. One player opens a thinnai, shares the link, everyone
  plays from their own device.

## Read these first

- **`RULES.md`** — the full ruleset: bidding, trump, double, settlement, how a
  match ends. Read it before changing anything in `lib/game.ts`.
- **`docs/THINNAI-DESIGN.md`** — how online play works and why it is built this
  way.

## Shape of the code

`lib/game.ts` is pure and framework-free — no React, no server imports. It holds
every rule that can be decided from cards alone, and it runs unchanged on both
the client and the server. Keep it that way: rules go here, not in components.

`lib/server/rooms.ts` owns everything the rules cannot decide alone — whose turn
it is, who is allowed to act, and **what each player is permitted to see**.

## The one rule that matters most

Hidden information is only hidden because the server never sends it. `viewFor`
in `lib/server/rooms.ts` decides what reaches each player: their own hand, other
players' card counts, and the trump only once it is revealed or if they are the
claimer who chose it. Anything added to `PlayerView` must be checked against
that. Putting a full hand or an unrevealed trump into the response would let any
player read it in devtools, and no amount of client-side care would fix it.

## Rooms are in memory

Rooms live in a `Map` in one Node process. `pnpm dev` and `pnpm start` on a
single machine both work with no database. A multi-instance deploy — Vercel
included — will lose rooms at random, because requests land on different
instances. Swapping the store for Redis is the fix; nothing outside
`lib/server/rooms.ts` needs to change.
