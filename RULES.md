# 904 — rules as implemented

The authoritative version of these rules is `lib/game.ts`. Every number below is
a named constant there, so changing a rule is a one-line edit rather than a hunt
through the UI.

## Table and teams

| Players | Deck | Ranks | Cards to lose |
|---|---|---|---|
| 4 | 24 | 2 3 J 9 A 10 | 5 |
| 6 | 36 | 2 3 J 9 A 10 K Q 8 | 7 |

Six cards each. Seats alternate between the two teams, so at four players seats
1 and 3 are partners against seats 2 and 4. Teams are always named with their
members — `Team A (P1, P3)` — never bare.

## Cards

Strength runs high to low: **2, 3, J, 9, A, 10, K, Q, 8**. The 2 is the
strongest card in the game and also the most valuable.

| Rank | 2 | 3 | J | 9 | A | 10 | K | Q | 8 |
|---|---|---|---|---|---|---|---|---|---|
| Points | 100 | 50 | 30 | 20 | 11 | 10 | 3 | 2 | 0 |

The four-player deck totals **884** points; the six-player deck totals **904**.

> ⚠️ `MAX_CLAIM` is 903 at both table sizes, so a four-player claim above 884 is
> unwinnable. Left as-is because bids that high are rare, but worth knowing.

## Bidding

**One round only.** Starting left of the dealer, each seat acts exactly once —
bid or pass. There is no second lap and no counter-bidding after your turn has
passed.

- Bids run from 500 to 904 in steps of 10.
- Each bid must beat the standing high bid by at least 10.
- A pass is final.
- If every seat passes, the hand is reshuffled and bidding starts again.

The highest bid at the end of the lap becomes the claim, and that player is the
**claimer**.

## Trump

The claimer lays **one card from their hand face down**. Its suit is trump.
Nobody else sees the card or the suit.

That card is genuinely out of their hand, which has three consequences:

- The claimer plays the round with **five cards**, not six, until it comes back.
- They **cannot play it** while it is face down.
- It **does not count for following suit**. If the face-down card is their only
  spade and spades are led, the claimer is void and may play anything.

The card returns to their hand the moment trump is revealed. If nobody ever asks,
it comes back for the sixth trick and is played as an ordinary card of its suit —
trump never goes live, and it never wins as trump.

The player to the claimer's right leads the first trick, so the claimer plays
second. The winner of each trick leads the next.

## Play

Follow the led suit if you can. That is the only hard constraint.

If you are **void** in the led suit you may play absolutely anything — a trump,
or a plain discard. Nothing is forced.

**Asking for trump is optional.** A void player may ask, which turns the
face-down card over, hands it back to the claimer, and makes trump live for the
rest of the round. Asking does not oblige you to then play a trump. The cost of
asking is the information you hand your opponents — and that you have just given
the claimer their sixth card back.

The claimer may ask too, on the same terms: only when they are void. That is
their route to getting the card back early.

Until trump is revealed it does not win tricks — the highest card of the led suit
takes them. Once revealed, any trump beats any non-trump.

Turn order within a trick is strictly the seat to your left. The winner of a
trick leads the next one.

## Double

Double is **declared, not detected**. Sweeping every trick by accident earns
nothing extra.

- Only the **claimer** may call it, personally. Their partner cannot.
- It is called **while playing their last card**, in the sixth trick. The call is
  committed with the card, before the trick resolves.
- **Correct** — the claiming team took all six tricks: the normal win **plus one
  card**.
- **Wrong** — they did not: the call **replaces the entire settlement** with a
  flat penalty against the claiming team. Nothing else applies, not even
  shortfall.

A wrong double is punishing in a way that is easy to miss: it replaces the
settlement *even when the claim itself succeeded*. Call double at 510, capture
700, take only five tricks, and you lose 3 cards on a round you would otherwise
have won 1.

## Settlement

Rounds do not accumulate points. They hand **cards** to one team as a penalty.

| Outcome | Bid under 700 | Bid 700 or more | Paid by |
|---|---|---|---|
| Claim made | 1 | 3 | opponents |
| Claim failed | 2 | 3 | claiming team |
| Correct double | 2 | 4 | opponents |
| Wrong double | 3 | 4 | claiming team |

Plus, on an ordinary failed claim only:

- **Shortfall** — the claiming team captured less than half the claim: **+1 card**
  against them.

There is no separate bonus for the defending team sweeping. That already shows up
as a failed claim with shortfall attached, since the claimer captured nothing.

## Ending the match

Cards carry across rounds. Between rounds the dealer moves one seat left and
hands are redealt.

A team that reaches **5 cards** (four players) or **7 cards** (six players)
**loses the match**, and the match ends there.

## Where the code lives

| Rule | Location |
|---|---|
| Deck, ranks, points, strength | `lib/game.ts` |
| Legal plays, asking trump | `getPlayable` in `lib/game.ts` |
| Trick winner | `evaluateTrick` in `lib/game.ts` |
| Settlement, double, shortfall | `settleRound` in `lib/game.ts` |
| Card limits, team labels | `cardLimit`, `teamLabel` in `lib/game.ts` |
| Turn order, whose turn, validation | `lib/server/rooms.ts` |
| What each player may see | `viewFor` in `lib/server/rooms.ts` |

Online architecture is described separately in `docs/THINNAI-DESIGN.md`.
