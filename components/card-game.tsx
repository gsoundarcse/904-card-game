'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  buildDeck,
  CARDS_PER_PLAYER,
  CLAIM_STEP,
  type Card,
  evaluateTrick,
  getPlayable,
  MAX_CLAIM,
  MIN_CLAIM,
  shuffle,
  sortHand,
  SUIT_SYMBOL,
  SUITS,
  type Suit,
  teamOf,
  TEAM_NAME,
  type TrickPlay,
  trickPoints,
} from '@/lib/game'
import { ConfigMenu } from '@/components/config-menu'
import { Scoreboard } from '@/components/scoreboard'
import { GameTable, type SeatView } from '@/components/game-table'
import { CardBack, CardFace, ClickableCard } from '@/components/playing-card'
import { StrongSupport } from '@/components/strong-support'

type Phase = 'config' | 'bidding' | 'trump' | 'playing' | 'roundOver'

interface Player {
  name: string
  hand: Card[]
}

const PHASE_LABEL: Record<Phase, string> = {
  config: 'Setup',
  bidding: 'Bidding',
  trump: 'Trump Select',
  playing: 'Playing',
  roundOver: 'Round Over',
}

export function CardGame() {
  const [phase, setPhase] = useState<Phase>('config')
  const [players, setPlayers] = useState<Player[]>([])
  const [shuffler, setShuffler] = useState(0)
  const [current, setCurrent] = useState(0)

  // bidding — exactly one pass around the table, starting left of the dealer
  const [passed, setPassed] = useState<boolean[]>([])
  const [bids, setBids] = useState<(number | null)[]>([])
  /** How many seats have already acted this round. Bidding ends at n. */
  const [bidTurn, setBidTurn] = useState(0)
  const [highBid, setHighBid] = useState(0)
  const [highBidder, setHighBidder] = useState<number | null>(null)
  const [pendingBid, setPendingBid] = useState(MIN_CLAIM)

  // claim / trump
  const [claimer, setClaimer] = useState<number | null>(null)
  const [claim, setClaim] = useState(0)
  const [trumpSuit, setTrumpSuit] = useState<Suit | null>(null)
  // The claimer's face-down card. Out of their hand, unplayable until revealed.
  const [trumpCard, setTrumpCard] = useState<Card | null>(null)
  const [trumpRevealed, setTrumpRevealed] = useState(false)
  const [trumpHidden, setTrumpHidden] = useState(false) // claimer temporarily peeking

  // play
  const [trick, setTrick] = useState<TrickPlay[]>([])
  const [lastTrick, setLastTrick] = useState<TrickPlay[]>([])
  const [trickNumber, setTrickNumber] = useState(0)
  const [teamScores, setTeamScores] = useState<[number, number]>([0, 0])
  const [banner, setBanner] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)

  const n = players.length
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setTempBanner = useCallback((msg: string, ms = 1700) => {
    setBanner(msg)
    if (bannerTimer.current) clearTimeout(bannerTimer.current)
    bannerTimer.current = setTimeout(() => setBanner(null), ms)
  }, [])

  const startGame = useCallback((count: number) => {
    const deck = shuffle(buildDeck(count))
    const dealt: Player[] = Array.from({ length: count }, (_, i) => ({
      name: `Player ${i + 1}`,
      hand: sortHand(deck.slice(i * CARDS_PER_PLAYER, i * CARDS_PER_PLAYER + CARDS_PER_PLAYER)),
    }))
    const deal = Math.floor(Math.random() * count)
    setPlayers(dealt)
    setShuffler(deal)
    setCurrent((deal + 1) % count)
    setPassed(Array(count).fill(false))
    setBids(Array(count).fill(null))
    setBidTurn(0)
    setHighBid(0)
    setHighBidder(null)
    setPendingBid(MIN_CLAIM)
    setClaimer(null)
    setClaim(0)
    setTrumpSuit(null)
    setTrumpCard(null)
    setTrumpRevealed(false)
    setTrumpHidden(false)
    setTrick([])
    setLastTrick([])
    setTrickNumber(0)
    setTeamScores([0, 0])
    setBanner(null)
    setResolving(false)
    setPhase('bidding')
  }, [])

  const resetToConfig = useCallback(() => setPhase('config'), [])

  // Keep pending bid at the minimum legal amount when the active bidder changes.
  useEffect(() => {
    if (phase !== 'bidding') return
    setPendingBid(Math.min(MAX_CLAIM, highBid > 0 ? highBid + CLAIM_STEP : MIN_CLAIM))
  }, [phase, current, highBid])

  const finalizeClaimer = useCallback((seat: number, amount: number) => {
    setClaimer(seat)
    setClaim(amount)
    setPhase('trump')
  }, [])

  /** True while the seat on turn is the final one to act and nobody has bid yet. */
  const isForcedClaim = phase === 'bidding' && n > 0 && bidTurn === n - 1 && highBidder === null

  /**
   * Record one seat's action and move on. Bidding is a single lap: once every
   * seat has acted exactly once, the highest bid on the table wins the claim.
   */
  const advanceBidding = useCallback(
    (
      nextPassed: boolean[],
      nextBids: (number | null)[],
      topBid: number,
      topSeat: number | null,
    ) => {
      setPassed(nextPassed)
      setBids(nextBids)

      const turn = bidTurn + 1
      if (turn < n) {
        setBidTurn(turn)
        setCurrent((current + 1) % n)
        return
      }

      // Lap complete. The last seat is never allowed to pass without a bid on
      // the table, so topSeat is non-null here; fall back defensively anyway.
      if (topSeat !== null) finalizeClaimer(topSeat, topBid)
      else finalizeClaimer(current, MIN_CLAIM)
    },
    [bidTurn, n, current, finalizeClaimer],
  )

  const handlePass = useCallback(() => {
    if (phase !== 'bidding') return
    if (isForcedClaim) return
    const nextPassed = [...passed]
    nextPassed[current] = true
    advanceBidding(nextPassed, bids, highBid, highBidder)
  }, [phase, isForcedClaim, passed, bids, current, highBid, highBidder, advanceBidding])

  const handleClaim = useCallback(
    (amount: number) => {
      if (phase !== 'bidding') return
      const nextBids = [...bids]
      nextBids[current] = amount
      setHighBid(amount)
      setHighBidder(current)
      advanceBidding(passed, nextBids, amount, current)
    },
    [phase, current, passed, bids, advanceBidding],
  )

  const handleSelectTrump = useCallback(
    (cardId: string) => {
      if (claimer === null) return
      const card = players[claimer]?.hand.find((c) => c.id === cardId)
      if (!card) return
      // Out of the hand entirely — that is what makes it unplayable and makes
      // the claimer count as void in its suit.
      setPlayers((prev) =>
        prev.map((p, i) => (i === claimer ? { ...p, hand: p.hand.filter((c) => c.id !== cardId) } : p)),
      )
      setTrumpCard(card)
      setTrumpSuit(card.suit)
      setTrumpHidden(false)
      setTrumpRevealed(false)
      setTrick([])
      setLastTrick([])
      setTrickNumber(0)
      setPhase('playing')
    },
    [claimer, players],
  )

  /** Put the face-down card back in the claimer's hand. */
  const returnTrumpCard = useCallback(() => {
    if (claimer === null || !trumpCard) return
    setPlayers((prev) =>
      prev.map((p, i) => (i === claimer ? { ...p, hand: sortHand([...p.hand, trumpCard]) } : p)),
    )
    setTrumpCard(null)
  }, [claimer, trumpCard])

  // When entering play, set the leader = player to the right of the claimer.
  useEffect(() => {
    if (phase === 'playing' && claimer !== null && trickNumber === 0 && trick.length === 0) {
      setCurrent((claimer - 1 + n) % n)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const playable = useMemo(() => {
    if (phase !== 'playing' || !players[current]) return null
    return getPlayable(players[current].hand, trick, trumpRevealed)
  }, [phase, players, current, trick, trumpRevealed])

  // Asking for trump is the player's choice, never automatic. It reveals the
  // suit to everyone and does not oblige the asker to then play a trump.
  const handleAskTrump = useCallback(() => {
    if (phase !== 'playing' || resolving || trumpRevealed) return
    if (!playable?.canAskTrump) return
    setTrumpRevealed(true)
    returnTrumpCard()
    setTempBanner('Trump Suit Revealed!')
  }, [phase, resolving, trumpRevealed, playable, returnTrumpCard, setTempBanner])

  const resolveTrick = useCallback(
    (finalTrick: TrickPlay[]) => {
      const winner = evaluateTrick(finalTrick, trumpSuit, trumpRevealed)
      const pts = trickPoints(finalTrick)
      setTeamScores((prev) => {
        const next: [number, number] = [prev[0], prev[1]]
        next[teamOf(winner)] += pts
        return next
      })
      const completed = trickNumber + 1
      setLastTrick(finalTrick)
      setTrickNumber(completed)
      setTempBanner(`${players[winner].name} takes the trick +${pts}`, 1600)
      setTrick([])
      setCurrent(winner)
      setResolving(false)
      if (completed >= CARDS_PER_PLAYER) setPhase('roundOver')
    },
    [trumpSuit, trumpRevealed, trickNumber, players, setTempBanner],
  )

  const handlePlayCard = useCallback(
    (cardId: string) => {
      if (phase !== 'playing' || resolving || !playable) return
      if (!playable.playableIds.has(cardId)) return
      const hand = players[current].hand
      const card = hand.find((c) => c.id === cardId)
      if (!card) return

      const emptiedHand = hand.length === 1
      setPlayers((prev) =>
        prev.map((p, i) => (i === current ? { ...p, hand: p.hand.filter((c) => c.id !== cardId) } : p)),
      )
      // Nobody asked, so the face-down card comes back for the last trick. Trump
      // stays unrevealed: it wins only as an ordinary card of its suit.
      if (current === claimer && emptiedHand && trumpCard) returnTrumpCard()
      const newTrick = [...trick, { player: current, card }]
      setTrick(newTrick)

      if (newTrick.length === n) {
        setResolving(true)
        setTimeout(() => resolveTrick(newTrick), 1300)
      } else {
        setCurrent((current + 1) % n)
      }
    },
    [phase, resolving, playable, players, current, trick, n, resolveTrick, claimer, trumpCard, returnTrumpCard],
  )

  useEffect(() => () => { if (bannerTimer.current) clearTimeout(bannerTimer.current) }, [])

  // ---- derived view models ----
  const claimerTeam = claimer !== null ? teamOf(claimer) : null

  const seats: SeatView[] = useMemo(
    () =>
      players.map((p, i) => {
        let status: string | undefined
        if (phase === 'bidding') {
          if (passed[i]) status = 'Passed'
          else if (bids[i] != null) status = `Bid ${bids[i]}`
          else if (i === current) status = 'Deciding'
          else status = 'Waiting'
        } else if (phase === 'playing' && i === current && !resolving) {
          status = 'Turn'
        }
        return {
          name: p.name,
          team: teamOf(i),
          handCount: p.hand.length,
          isCurrent: (phase === 'bidding' || phase === 'playing') && i === current && !resolving,
          isClaimer: claimer === i,
          isShuffler: shuffler === i,
          status,
        }
      }),
    [players, phase, passed, bids, current, resolving, claimer, shuffler],
  )

  if (phase === 'config') {
    return (
      <main className="min-h-svh bg-background">
        <ConfigMenu onStart={startGame} />
      </main>
    )
  }

  const activePlayer = players[current]
  const minAllowed = Math.min(MAX_CLAIM, highBid > 0 ? highBid + CLAIM_STEP : MIN_CLAIM)
  const canClaim = minAllowed <= MAX_CLAIM
  const mustClaim = isForcedClaim
  const bidsLeft = phase === 'bidding' ? n - bidTurn : 0

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
      <Scoreboard
        teamScores={teamScores}
        claimerName={claimer !== null ? players[claimer].name : null}
        claimerTeam={claimerTeam}
        claim={claim}
        trumpSuit={trumpSuit}
        trumpRevealed={trumpRevealed}
        phaseLabel={PHASE_LABEL[phase]}
        onReset={resetToConfig}
      />

      <GameTable
        seats={seats}
        trick={trick.length > 0 ? trick : lastTrick}
        trumpSuit={trumpSuit}
        trumpCard={trumpCard}
        trumpRevealed={trumpRevealed}
        trumpPlaced={trumpCard !== null || trumpRevealed}
        banner={banner}
      />

      {/* Active player control tray */}
      <section className="rounded-2xl border border-border bg-secondary/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={cn('h-2.5 w-2.5 rounded-full', teamOf(current) === 0 ? 'bg-team-a' : 'bg-team-b')} aria-hidden />
            <h2 className="font-serif text-lg font-bold text-gold-soft">{activePlayer?.name}</h2>
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {TEAM_NAME[teamOf(current)]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {playable?.canAskTrump && (
              <button
                type="button"
                onClick={handleAskTrump}
                className="rounded-full border border-gold/60 bg-gold/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-gold transition-colors hover:bg-gold/20"
              >
                Ask for trump
              </button>
            )}
            <StrongSupport
              revealed={trumpRevealed}
              eligible={trumpRevealed && claimer !== null}
            />
            {playable && <PlayHint reason={playable.reason} trumpRevealed={trumpRevealed} />}
          </div>
        </div>

        {/* Hand */}
        <div className="flex min-h-36 items-end justify-center overflow-x-auto pb-2 pl-3">
          {activePlayer?.hand.length ? (
            phase === 'playing' ? (
              activePlayer.hand.map((card) => (
                <ClickableCard
                  key={card.id}
                  card={card}
                  disabled={resolving || !playable?.playableIds.has(card.id)}
                  onClick={() => handlePlayCard(card.id)}
                />
              ))
            ) : (
              // Bidding / trump: hand is view-only but fully legible.
              activePlayer.hand.map((card) => (
                <div key={card.id} className="-ml-3 shrink-0 first:ml-0">
                  <CardFace card={card} size="lg" />
                </div>
              ))
            )
          ) : (
            <span className="font-serif italic text-muted-foreground">No cards left</span>
          )}

          {trumpCard && current === claimer && (
            <div className="ml-4 flex shrink-0 flex-col items-center gap-1 border-l border-border pl-4">
              <div className="relative">
                <CardBack size="lg" className="opacity-70" />
                <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] uppercase tracking-widest text-gold">
                  face down
                </span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {trumpCard.rank}
                {SUIT_SYMBOL[trumpCard.suit]} · locked
              </span>
            </div>
          )}
        </div>

        {/* Bidding controls */}
        {phase === 'bidding' && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 border-t border-border pt-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background/40 px-2 py-1">
              <button
                type="button"
                onClick={() => setPendingBid((v) => Math.max(minAllowed, v - CLAIM_STEP))}
                disabled={pendingBid <= minAllowed}
                className="h-8 w-8 rounded-lg bg-secondary text-lg font-bold text-foreground disabled:opacity-30"
                aria-label="Decrease bid"
              >
                &minus;
              </button>
              <span className="w-16 text-center font-serif text-2xl font-bold text-gold-soft">{pendingBid}</span>
              <button
                type="button"
                onClick={() => setPendingBid((v) => Math.min(MAX_CLAIM, v + CLAIM_STEP))}
                disabled={pendingBid >= MAX_CLAIM}
                className="h-8 w-8 rounded-lg bg-secondary text-lg font-bold text-foreground disabled:opacity-30"
                aria-label="Increase bid"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleClaim(pendingBid)}
              disabled={!canClaim}
              className="rounded-xl bg-gold px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-40"
            >
              Claim {pendingBid}
            </button>
            <button
              type="button"
              onClick={handlePass}
              disabled={mustClaim}
              className="rounded-xl border border-border px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-30"
            >
              Pass
            </button>
            <p className="w-full text-center font-mono text-[11px] text-muted-foreground">
              {mustClaim
                ? 'Last to act and no bid on the table — you must claim.'
                : highBid > 0
                  ? `High bid ${highBid} by ${players[highBidder as number].name}. Yours must be +${CLAIM_STEP} or more.`
                  : `Opening claim starts at ${MIN_CLAIM}. Max ${MAX_CLAIM}.`}
            </p>
            <p className="w-full text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
              One round of bidding · {bidsLeft} {bidsLeft === 1 ? 'seat' : 'seats'} left to act
            </p>
          </div>
        )}
      </section>

      {phase === 'trump' && claimer !== null && (
        <TrumpModal
          claimerName={players[claimer].name}
          claim={claim}
          hand={players[claimer].hand}
          hidden={trumpHidden}
          onPeek={() => setTrumpHidden((h) => !h)}
          onSelect={handleSelectTrump}
        />
      )}

      {phase === 'roundOver' && claimerTeam !== null && (
        <RoundOver
          claimerName={claimer !== null ? players[claimer].name : ''}
          claimerTeam={claimerTeam}
          claim={claim}
          captured={teamScores[claimerTeam]}
          teamScores={teamScores}
          onPlayAgain={resetToConfig}
        />
      )}
    </main>
  )
}

function PlayHint({
  reason,
  trumpRevealed,
}: {
  reason: 'lead' | 'follow' | 'void'
  trumpRevealed: boolean
}) {
  const map: Record<typeof reason, string> = {
    lead: 'Lead any card',
    follow: 'You must follow the led suit',
    void: trumpRevealed ? 'Void in suit — play anything' : 'Void in suit — play anything, or ask for trump',
  }
  return (
    <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 font-mono text-[11px] text-gold">
      {map[reason]}
    </span>
  )
}

function TrumpModal({
  claimerName,
  claim,
  hand,
  hidden,
  onPeek,
  onSelect,
}: {
  claimerName: string
  claim: number
  hand: Card[]
  hidden: boolean
  onPeek: () => void
  onSelect: (cardId: string) => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const chosen = hand.find((c) => c.id === picked) ?? null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-2xl border-2 border-gold/50 bg-popover p-6 text-center shadow-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold">Secure Prompt</p>
        <h2 className="mt-2 font-serif text-3xl font-bold text-gold-soft">{claimerName} sets the trump</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Target <span className="font-semibold text-gold">{claim}</span>. Lay one card face down — its suit is trump,
          and you cannot play that card until trump is asked for.
        </p>

        {!hidden ? (
          <button
            type="button"
            onClick={onPeek}
            className="mt-6 w-full rounded-xl border border-gold/50 bg-felt-dark px-4 py-6 font-serif text-xl font-bold text-gold transition-colors hover:bg-felt"
          >
            Tap to open (make sure others look away)
          </button>
        ) : (
          <>
            <div className="mt-5 rounded-xl border border-border bg-background/40 p-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Tap a card to lay it face down
              </p>
              <div className="flex items-end justify-center overflow-x-auto pb-1 pl-3">
                {hand.map((card) => (
                  <ClickableCard
                    key={card.id}
                    card={card}
                    selected={picked === card.id}
                    onClick={() => setPicked(card.id)}
                  />
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              {SUITS.map((suit) => {
                const held = hand.filter((c) => c.suit === suit)
                const points = held.reduce((sum, c) => sum + c.points, 0)
                const red = suit === 'Hearts' || suit === 'Diamonds'
                return (
                  <div
                    key={suit}
                    className={cn(
                      'rounded-lg border border-border bg-card/60 py-2',
                      chosen?.suit === suit && 'border-gold ring-1 ring-gold',
                    )}
                  >
                    <div className={cn('text-lg', red && 'text-suit-red')}>{SUIT_SYMBOL[suit]}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {held.length} · {points}p
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => chosen && onSelect(chosen.id)}
              disabled={!chosen}
              className="mt-5 w-full rounded-xl bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-40"
            >
              {chosen
                ? `Lay ${chosen.rank}${SUIT_SYMBOL[chosen.suit]} face down — ${chosen.suit} is trump`
                : 'Pick a card first'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function RoundOver({
  claimerName,
  claimerTeam,
  claim,
  captured,
  teamScores,
  onPlayAgain,
}: {
  claimerName: string
  claimerTeam: 0 | 1
  claim: number
  captured: number
  teamScores: [number, number]
  onPlayAgain: () => void
}) {
  const success = captured >= claim
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border-2 border-gold/50 bg-popover p-8 text-center shadow-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold">Round Over</p>
        <h2 className={cn('mt-2 font-serif text-4xl font-bold', success ? 'text-gold-soft' : 'text-destructive')}>
          {success ? 'Claim Made!' : 'Claim Failed'}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {claimerName} ({TEAM_NAME[claimerTeam]}) claimed <span className="font-semibold text-gold">{claim}</span> and
          captured <span className={cn('font-semibold', success ? 'text-gold' : 'text-destructive')}>{captured}</span>.
        </p>
        <div className="mt-5 flex justify-center gap-4">
          {([0, 1] as const).map((t) => (
            <div key={t} className="flex flex-col">
              <span className={cn('text-[10px] font-semibold uppercase tracking-widest', t === 0 ? 'text-team-a' : 'text-team-b')}>
                {TEAM_NAME[t]}
              </span>
              <span className="font-serif text-3xl font-bold text-foreground">{teamScores[t]}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onPlayAgain}
          className="mt-6 w-full rounded-xl bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5"
        >
          Play Again
        </button>
      </div>
    </div>
  )
}
