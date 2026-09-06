# Tests

```bash
pnpm test
```

No test framework, no dependencies. Node's built-in runner (`node:test`) plus
`--experimental-strip-types` runs the TypeScript sources directly. Node 22.6 or
newer.

`register.mjs` and `resolve-alias.mjs` exist only because Node does not read
tsconfig `paths`; they teach the runner what `@/lib/...` means.

## What is covered

| File | Kind | Covers |
|---|---|---|
| `game.test.ts` | unit | Deck composition and totals, rank strength, sorting, shuffling, teams, legal plays, trick winners, and every branch of `settleRound`. |
| `rooms.test.ts` | functional | The server end to end: opening and joining a thinnai, authorisation, a full lap of bidding, trump selection, playing tricks, double, settlement, multi-round matches, and redaction. |

Both suites end with something broader than a single assertion. `game.test.ts`
plays 300 random rounds and checks that no play is ever illegal and no point is
ever created or lost. `rooms.test.ts` drives a whole match through the server
until a team collects enough cards to lose.

## Two things worth knowing

**Redaction has its own tests, and they matter most.** Hidden information is
only hidden because `viewFor` never sends it. The tests serialise a player's
view and assert that no opponent's card id and no player's secret appears
anywhere in it. If you add a field to `PlayerView`, add a case here.

**Some hands are rigged, deliberately.** A random deal rarely produces a void, a
singleton, or a forced follow, and a test that quietly skips when the deal is
wrong is a test that passes without testing anything. `rig()` sets exact hands
so those rules are always exercised.

## Keeping the suite honest

The suite was checked by mutation: eighteen deliberate rule breaks — a wrong
card penalty, trump winning while hidden, the follow-suit rule dropped, turn
order unenforced, the trump leaked to every player, bidding running two laps —
were each introduced in turn. All eighteen were caught.

Worth repeating after a substantial change. Break a rule on purpose; if the
suite still passes, the suite has a hole.

## Not covered

The API route handlers and the React components. Routes are thin wrappers over
`applyAction`, which is thoroughly tested, but the wrappers themselves — request
parsing, status codes — are not. The UI is untested entirely.
