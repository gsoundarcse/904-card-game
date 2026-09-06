# Thinnai — online 904

Design for turning 904 from a single-device pass-and-play game into an online
game where each player sits at their own screen. A **thinnai** is the raised
porch of a Tamil house where people gather to play — here it is the room players
join before a match starts.

Status: **proposal, awaiting approval**. No code has been written against it.

---

## 1. The one problem you need to decide on first

You chose polling on Next.js API routes. That works, with one catch.

Vercel runs API routes as **stateless serverless functions**. Two requests one
second apart can land on different instances, and instances shut down when idle.
A room held in a module-level `Map` will therefore vanish or appear to vanish at
random. This is not a polling problem — it applies to WebSockets on Vercel too.
It means room state has to live somewhere both instances can see.

The design below keeps your polling choice and puts the state behind a small
`RoomStore` interface with two implementations:

| Implementation | Where it works | Setup |
|---|---|---|
| `MemoryStore` | `next dev`, or `next start` on one machine | none |
| `RedisStore` | Vercel, or anywhere multi-instance | one env var |

Local development needs nothing. Deploying to Vercel needs an Upstash Redis or
Vercel KV database — free tier is far more than enough for card rooms. Everything
else in this document is identical either way, and swapping stores is one line in
`lib/server/store.ts`.

**If you would rather not add Redis at all**, the alternative is to run the app
as a normal long-lived Node process (a small VM, Fly.io, Railway, a Raspberry Pi
on your network) where `MemoryStore` is genuinely fine. Say which you prefer and
I will write only that path.

---

## 2. Architecture

```
Browser (each player)                    Server (Next.js route handlers)
┌──────────────────────┐                ┌────────────────────────────────┐
│ useThinnai(roomId)   │  GET  state    │ /api/thinnai/[id]/state        │
│  ├ poll loop         │ ─────────────► │   → redacted view for caller   │
│  └ send(action)      │  POST action   │ /api/thinnai/[id]/action       │
│                      │ ─────────────► │   → validate, mutate, bump ver │
│ React components     │                │                                │
│ (rendering only)     │                │ lib/game.ts  ← rules, unchanged │
└──────────────────────┘                │ RoomStore    ← Memory | Redis   │
                                        └────────────────────────────────┘
```

The client becomes a thin renderer. It holds no game state of its own, decides
nothing, and trusts nothing it has not been told. Every rule — whose turn it is,
whether a card is legal, what the trump is — is enforced on the server.

`lib/game.ts` is already pure TypeScript with no React imports, so it moves to
the server untouched. That is the reason this port is tractable at all.

### Why server-authoritative is not optional

Today all six hands and the hidden trump live in React state in one tab. That is
fine when one person is looking at the screen. Online, any player could open
devtools and read every opponent's hand and the trump suit. Hidden information
only stays hidden if the server never sends it.

---

## 3. Room state

One object per room, versioned. `version` increments on every mutation and is
what polling clients compare against.

```ts
type RoomStatus = 'lobby' | 'bidding' | 'trump' | 'playing' | 'roundOver' | 'matchOver'

interface Room {
  id: string                 // short code, e.g. "kolam-42"
  version: number            // bumped on every mutation
  createdAt: number
  updatedAt: number
  seatCount: 4 | 6
  status: RoomStatus
  hostId: string

  players: {
    id: string               // opaque, server-issued
    secret: string           // never leaves the owner's browser
    name: string
    seat: number             // 0-based, fixed once the match starts
    lastSeen: number
  }[]

  match: {
    roundNumber: number
    teamCards: [number, number]   // penalty cards, persist across rounds
    cardLimit: number             // 5 at four players, 7 at six
    loser: 0 | 1 | null
  }

  round: {
    dealer: number
    current: number                     // seat on turn — the only seat that may act
    hands: Record<string, Card[]>       // by player id; never sent wholesale
    passed: boolean[]
    bids: (number | null)[]
    bidTurn: number
    highBid: number
    highBidder: number | null
    claimer: number | null
    claim: number
    trumpSuit: Suit | null              // secret until revealed
    trumpRevealed: boolean
    trick: TrickPlay[]
    trickNumber: number
    teamScores: [number, number]
    teamTricks: [number, number]
    settlement: Settlement | null
  }
}
```

### Redaction — what each player is allowed to see

`GET /state` never returns `Room`. It returns a view built for the caller:

| Field | Rule |
|---|---|
| own hand | full cards |
| other hands | **count only** |
| `trumpSuit` | only if `trumpRevealed`, or the caller is the claimer |
| `players[].secret` | never sent, to anyone |
| everything else | public |

This is the single most important function in the codebase to get right, so it
lives alone in `lib/server/redact.ts` with its own tests.

---

## 4. Identity and join links

No accounts, no passwords, no database of users.

1. A player creates a thinnai and picks a table size. The server generates a
   room id and issues them a `playerId` + `secret`.
2. They get a link: `https://<app>/thinnai/kolam-42` — send it on WhatsApp.
3. Anyone opening it is asked for a display name, then takes the next free seat
   and receives their own `playerId` + `secret`.
4. The pair is stored in `localStorage` under the room id, so a refresh or a
   dropped phone signal rejoins the same seat rather than a new one.
5. Every action request carries the secret. Sending an action for a seat that is
   not yours is rejected — this is what makes "you cannot play someone else's
   card" true rather than merely unenforced.

Seats fill in join order. The host can shuffle seats in the lobby before starting,
which matters because **seat order determines teams** — alternating seats, so at
four players seats 0 and 2 are one team, 1 and 3 the other.

---

## 5. API

| Route | Method | Purpose |
|---|---|---|
| `/api/thinnai` | POST | Create a room. Body `{ seatCount, hostName }`. Returns id, join URL, credentials. |
| `/api/thinnai/[id]/join` | POST | Join with `{ name }`. Returns credentials and seat. |
| `/api/thinnai/[id]/state` | GET | Redacted view. Takes `?since=<version>`. |
| `/api/thinnai/[id]/action` | POST | All gameplay. Body `{ playerId, secret, action }`. |

### Actions

```ts
type Action =
  | { type: 'setSeats'; order: string[] }   // host only, lobby only
  | { type: 'start' }                       // host only, needs a full table
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'selectTrump'; suit: Suit }     // claimer only
  | { type: 'askTrump' }                    // void player only, optional
  | { type: 'playCard'; cardId: string; double?: boolean }
  | { type: 'nextRound' }                   // host only, after a round settles
```

Every action runs the same guard: is the room in the right status, is the caller
who they claim to be, is it their turn, is the move legal. Anything else is a
`409` with a reason, and the client shows it rather than silently desyncing.

`double` rides along with `playCard` rather than being its own action, because
the call has to be atomic with dropping the card — a separate request would let
the claimer declare, see the result, and never send the card. The server accepts
the flag only from the claimer, only on their sixth and final card.

### Polling protocol

The client sends its last known `version`:

```
GET /api/thinnai/kolam-42/state?since=17
```

- If the room has moved past 17, the new view returns immediately.
- If not, the handler waits, re-checking a few times a second, and returns `204`
  when it gives up. The client then asks again.

That is long-polling, and it makes turns feel immediate instead of arriving up to
a second late. The wait must stay under the platform's function timeout — **10
seconds on Vercel's Hobby plan**, 60 on Pro — so the cap is 8 seconds with a
plain 1-second poll as the fallback. Idle rooms cost a couple of requests per
player per minute.

---

## 6. Rules changes going in at the same time

These are your rules from this session. Flagged items are places where I had to
choose, and each is a one-line change if I chose wrong.

### Bidding

One lap around the table, starting left of the dealer. Each seat acts once.
Highest bid takes the claim. If nobody bids, the last seat must claim 500.
*(Already built and committed.)*

### Trump

The claimer picks a suit, seen only by them. Online, this drops the "make sure
others look away" step entirely — each player has their own screen, so the
claimer simply sees their hand and picks.

Asking for trump is **optional**. A player void in the led suit may play any card
at all. They may instead ask for trump, which reveals the suit to everyone for
the rest of the round. Asking does not oblige them to then play a trump. The cost
of asking is the information given away.

This removes today's forced-trump rule and the automatic reveal.

### Turn order

Strictly the seat to the left, always, with no reordering. The trick winner leads
the next trick. Enforced server-side by `round.current`.

### Card transfers at the end of a round

Cards are the score. They accumulate on the team that lost the exchange.

| Outcome | Bid | Cards | Who takes them |
|---|---|---|---|
| Claim made | under 700 | 1 | opponents |
| Claim made | 700 or more | 3 | opponents |
| Claim failed | under 700 | 2 | claiming team |
| Claim failed | 700 or more | 3 | claiming team |

Bonus, added on top:

- **Shortfall** — a failed claimer who captured less than half their claim:
  **+1 card** against the claiming team.

### Double

Double is **declared, not detected**. Nobody gets it for sweeping by accident.

- **Only the claimer may call it** — personally. Their partner cannot, even
  though the sweep is a team achievement.
- **Called while playing their last card**, in the sixth trick. The button sits
  beside the card, so the call is committed as the card is dropped — before the
  trick resolves and before the claimer knows whether it lands.
- **Correct** — the claiming team took all six tricks: **+1 card** on top of the
  normal win. A win under 700 pays 2; a win at 700 or more pays 4.
- **Wrong** — they did not take all six: the declaration **replaces the entire
  settlement**. Flat **3 cards** under 700, **4 cards** at 700 or more, against
  the claiming team. Nothing else applies, not even shortfall.

A correct double always implies a made claim, since taking every trick captures
every point in the deck. So the correct-double branch never has to consider
failure.

> *Note:* there is no automatic bonus for the defending team sweeping all six.
> That case already shows up as a failed claim with the shortfall card attached,
> since the claimer captured nothing.

### Ending the match

A team that reaches **5 cards** (four players) or **7 cards** (six players)
**loses the match**, and the match ends there.

Between rounds the dealer moves one seat left, hands are redealt, and card totals
carry over.

### Naming teams

Teams are always shown with their members — `Team A (P1, P3)` — in the
scoreboard, the round summary, and the final result.

---

## 7. Files

New:

```
app/thinnai/page.tsx              create-a-room landing
app/thinnai/[id]/page.tsx         the room: lobby, then table
app/api/thinnai/route.ts          create
app/api/thinnai/[id]/join/route.ts
app/api/thinnai/[id]/state/route.ts
app/api/thinnai/[id]/action/route.ts
lib/server/store.ts               RoomStore, MemoryStore, RedisStore
lib/server/room.ts                create, join, seat, deal, advance
lib/server/actions.ts             validate and apply one action
lib/server/redact.ts              per-player view
lib/client/use-thinnai.ts         polling hook, action sender
components/lobby.tsx              seats, join link, start button
RULES.md                          the ruleset, linked from CLAUDE.md
```

Changed:

```
lib/game.ts            + settlement, card limits, team labels
                       ~ getPlayable loses the forced-trump branch
components/card-game.tsx  becomes props-driven, no game state of its own
components/scoreboard.tsx + card counts, team member labels
components/config-menu.tsx → folds into the lobby
```

Untouched: `playing-card.tsx`, `game-table.tsx` — they already take props.

---

## 8. Order of work

1. **Rules in `lib/game.ts`** — settlement, card limits, optional trump. Pure
   functions, verifiable by simulation before any server exists. *(Half-written
   already; saved as `wip-scoring-rules.patch`.)*
2. **Server core** — store, room lifecycle, actions, redaction.
3. **API routes** over that core.
4. **Polling hook** and rewiring the components to props.
5. **Lobby** — create, join link, seating, start.
6. **`RULES.md`** and the CLAUDE.md link.

Step 1 is worth finishing first regardless: the rules are the part most likely to
be wrong, and they are far cheaper to test as pure functions than through HTTP.

---

## 9. Honest limitations

- **I cannot build or test any of this here.** This sandbox's npm registry is
  blocked, so there is no `node_modules`. I can write the code; you run
  `pnpm dev` and we fix what breaks.
- **Polling is not free.** Four players in a live room is roughly 4 requests a
  second at the 1-second fallback, or a handful a minute with long-polling.
  Comfortable on Vercel's free tier, but it is the reason WebSockets exist.
- **Reconnection is best-effort.** A player who clears their browser storage
  loses their seat and cannot rejoin the match in progress.
- **No spectators, no chat, no rematch history** in this scope.
- **Trust the host.** Any player with the link can join a free seat. Rooms are
  unlisted rather than private, which is fine for a WhatsApp group and not fine
  for strangers.

---

## 10. What I need from you

1. **Redis or a long-lived Node host?** This is the only blocking question.
2. Anything in section 7 you want structured differently before I start.

The card table and the double rules are settled as of this revision.
