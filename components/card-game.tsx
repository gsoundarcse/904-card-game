'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  buildDeck,
  CARDS_PER_PLAYER,
  CLAIM_STEP,
  cardLimit,
  chooseBotCard,
  type Card,
  evaluateTrick,
  getPlayable,
  MAX_CLAIM,
  MIN_CLAIM,
  shuffle,
  sortHand,
  settleRound,
  SUIT_SYMBOL,
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

type Phase = 'config' | 'dealing' | 'bidding' | 'trump' | 'playing' | 'roundOver'

interface Player {
  name: string
  hand: Card[]
  isBot: boolean
}

const PHASE_LABEL: Record<Phase, string> = {
  config: 'Setup',
  dealing: 'Dealing',
  bidding: 'Bidding',
  trump: 'Trump Select',
  playing: 'Playing',
  roundOver: 'Round Over',
}

export function CardGame() {
  const [phase, setPhase] = useState<Phase>('config')
  const [players, setPlayers] = useState<Player[]>([])
  const [dealPlan, setDealPlan] = useState<Player[] | null>(null)
  const [dealBatch, setDealBatch] = useState(0)
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
  const [revealedTrumpCard, setRevealedTrumpCard] = useState<Card | null>(null)
  const [trumpRevealed, setTrumpRevealed] = useState(false)
  const [trumpHidden, setTrumpHidden] = useState(false) // claimer temporarily peeking

  // play
  const [trick, setTrick] = useState<TrickPlay[]>([])
  const [lastTrick, setLastTrick] = useState<TrickPlay[]>([])
  const [trickNumber, setTrickNumber] = useState(0)
  const [teamScores, setTeamScores] = useState<[number, number]>([0, 0])
  const [matchCards, setMatchCards] = useState<[number, number]>([0, 0])
  const [teamTricks, setTeamTricks] = useState<[number, number]>([0, 0])
  const [doubleCalled, setDoubleCalled] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)

  const n = players.length
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setTempBanner = useCallback((msg: string, ms = 1700) => {
    setBanner(msg)
    if (bannerTimer.current) clearTimeout(bannerTimer.current)
    bannerTimer.current = setTimeout(() => setBanner(null), ms)
  }, [])

  const startGame = useCallback((count: number, names: string[], solo = false, preserveMatch = false) => {
    const deck = shuffle(buildDeck(count))
    const dealt: Player[] = Array.from({ length: count }, (_, i) => ({
      name: solo && i > 0 ? `Bot ${i}` : names[i] ?? `Player ${i + 1}`,
      hand: sortHand(deck.slice(i * CARDS_PER_PLAYER, i * CARDS_PER_PLAYER + CARDS_PER_PLAYER)),
      isBot: solo && i > 0,
    }))
    const deal = Math.floor(Math.random() * count)
    setPlayers(dealt.map((player) => ({ ...player, hand: [] })))
    setDealPlan(dealt)
    setDealBatch(0)
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
    setRevealedTrumpCard(null)
    setTrumpRevealed(false)
    setTrumpHidden(false)
    setTrick([])
    setLastTrick([])
    setTrickNumber(0)
    if (!preserveMatch) setMatchCards([0, 0])
    setTeamScores([0, 0])
    setTeamTricks([0, 0])
    setDoubleCalled(false)
    setBanner(null)
    setResolving(false)
    setPhase('dealing')
  }, [])

  const nextRound = useCallback(() => {
    const names = players.map((player) => player.name)
    startGame(n, names, players.some((player) => player.isBot), true)
  }, [n, players, startGame])

  const botDelay = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (botDelay.current) clearTimeout(botDelay.current)
  }, [])

  useEffect(() => {
    if (phase !== 'dealing' || !dealPlan) return
    if (dealBatch >= 2) {
      setDealPlan(null)
      setPhase('bidding')
      return
    }

    const timer = setTimeout(() => {
      const nextBatch = dealBatch + 1
      setPlayers((current) =>
        current.map((player, seat) => ({
          ...player,
          hand: dealPlan[seat].hand.slice(0, nextBatch * 3),
        })),
      )
      setDealBatch(nextBatch)
    }, 850)

    return () => clearTimeout(timer)
  }, [phase, dealBatch, dealPlan])

  const reshuffle = useCallback(() => {
    const names = players.map((player) => player.name)
    const deck = shuffle(buildDeck(n))
    const dealt: Player[] = Array.from({ length: n }, (_, i) => ({
      name: names[i] ?? `Player ${i + 1}`,
      hand: sortHand(deck.slice(i * CARDS_PER_PLAYER, i * CARDS_PER_PLAYER + CARDS_PER_PLAYER)),
      isBot: players[i]?.isBot ?? false,
    }))
    const deal = Math.floor(Math.random() * n)
    setPlayers(dealt)
    setShuffler(deal)
    setCurrent((deal + 1) % n)
    setPassed(Array(n).fill(false))
    setBids(Array(n).fill(null))
    setBidTurn(0)
    setHighBid(0)
    setHighBidder(null)
    setPendingBid(MIN_CLAIM)
    setClaimer(null)
    setClaim(0)
    setTrumpSuit(null)
    setTrumpCard(null)
    setRevealedTrumpCard(null)
    setTrumpRevealed(false)
    setTrumpHidden(false)
    setTrick([])
    setLastTrick([])
    setTrickNumber(0)
    setTeamTricks([0, 0])
    setDoubleCalled(false)
    setBanner('All players passed — reshuffling')
    setResolving(false)
    setPhase('bidding')
  }, [n, players])

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

      if (topSeat !== null) {
        finalizeClaimer(topSeat, topBid)
      } else {
        reshuffle()
      }
    },
    [bidTurn, n, current, finalizeClaimer, reshuffle],
  )

  const handlePass = useCallback(() => {
    if (phase !== 'bidding') return
    const nextPassed = [...passed]
    nextPassed[current] = true
    advanceBidding(nextPassed, bids, highBid, highBidder)
  }, [phase, passed, bids, current, highBid, highBidder, advanceBidding])

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

  useEffect(() => {
    if (phase !== 'bidding' || !players[current]?.isBot) return
    botDelay.current = setTimeout(() => {
      if (highBid === 0) handleClaim(MIN_CLAIM)
      else handlePass()
    }, 700)
    return () => { if (botDelay.current) clearTimeout(botDelay.current) }
  }, [phase, current, players, highBid, handleClaim, handlePass])

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
      setRevealedTrumpCard(null)
      setTrumpSuit(card.suit)
      setTrumpHidden(false)
      setTrumpRevealed(false)
      setTrick([])
      setLastTrick([])
      setTrickNumber(0)
      setCurrent((claimer - 1 + n) % n)
      setPhase('playing')
    },
    [claimer, n, players],
  )

  useEffect(() => {
    if (phase !== 'trump' || claimer === null || !players[claimer]?.isBot) return
    botDelay.current = setTimeout(() => handleSelectTrump(players[claimer].hand[0]?.id ?? ''), 700)
    return () => { if (botDelay.current) clearTimeout(botDelay.current) }
  }, [phase, claimer, players, handleSelectTrump])

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
    if (trumpCard) setRevealedTrumpCard(trumpCard)
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
      setTeamTricks((prev) => {
        const next: [number, number] = [prev[0], prev[1]]
        next[teamOf(winner)] += 1
        return next
      })
      const completed = trickNumber + 1
      setLastTrick(finalTrick)
      setTrickNumber(completed)
      setTempBanner(`${players[winner].name} takes the trick +${pts}`, 1600)
      setTrick([])
      setCurrent(winner)
      setResolving(false)
      if (completed >= CARDS_PER_PLAYER) {
        const claimerTeam = teamOf(claimer ?? 0)
        const finalTeamTricks: [number, number] = [teamTricks[0], teamTricks[1]]
        finalTeamTricks[teamOf(winner)] += 1
        const settlement = settleRound({
          claim,
          claimerTeam,
          captured: teamScores[claimerTeam] + (teamOf(winner) === claimerTeam ? pts : 0),
          teamTricks: finalTeamTricks,
          doubleCalled,
        })
        setMatchCards((previous) => {
          const updated: [number, number] = [previous[0], previous[1]]
          updated[settlement.penalisedTeam] += settlement.cards
          return updated
        })
        setPhase('roundOver')
      }
    },
    [trumpSuit, trumpRevealed, trickNumber, players, setTempBanner, claimer, claim, teamTricks, teamScores, doubleCalled],
  )

  const handlePlayCard = useCallback(
    (cardId: string, asDouble = false) => {
      if (phase !== 'playing' || resolving || !playable) return
      if (!playable.playableIds.has(cardId)) return
      const hand = players[current].hand
      const card = hand.find((c) => c.id === cardId)
      if (!card) return
      if (asDouble) {
        if (current !== claimer || hand.length !== 1 || trumpCard || doubleCalled) return
        if (teamTricks[teamOf(current)] !== CARDS_PER_PLAYER - 1) return
        setDoubleCalled(true)
      }

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
    [phase, resolving, playable, players, current, trick, n, resolveTrick, claimer, trumpCard, returnTrumpCard, doubleCalled, teamTricks],
  )

  useEffect(() => {
    if (phase !== 'playing' || resolving || !players[current]?.isBot || !playable) return
    botDelay.current = setTimeout(() => {
      if (playable.canAskTrump) {
        handleAskTrump()
        return
      }
      const card = chooseBotCard(
        players[current].hand,
        playable.playableIds,
        trick,
        trumpSuit,
        trumpRevealed,
        current,
      )
      if (card) handlePlayCard(card.id)
    }, 700)
    return () => { if (botDelay.current) clearTimeout(botDelay.current) }
  }, [phase, resolving, current, players, playable, trick, trumpSuit, trumpRevealed, handleAskTrump, handlePlayCard])

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
  const canClaim =
    Number.isInteger(pendingBid) &&
    pendingBid >= minAllowed &&
    pendingBid <= MAX_CLAIM &&
    pendingBid % CLAIM_STEP === 0
  const claimError = canClaim
    ? null
    : pendingBid > MAX_CLAIM
      ? `Maximum claim is ${MAX_CLAIM}.`
      : pendingBid < minAllowed
        ? `Claim must be at least ${minAllowed}.`
        : `Claim must be a whole number in steps of ${CLAIM_STEP}.`
  const bidsLeft = phase === 'bidding' ? n - bidTurn : 0
  const canCallDouble =
    phase === 'playing' &&
    current === claimer &&
    activePlayer?.hand.length === 1 &&
    !trumpCard &&
    !doubleCalled &&
    trickNumber === CARDS_PER_PLAYER - 1 &&
    claimer !== null &&
    teamTricks[teamOf(claimer)] === CARDS_PER_PLAYER - 1

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
      <Scoreboard
        teamScores={teamScores}
        claimTarget={claim}
        totalPoints={players.length >= 6 ? 904 : 884}
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
        trumpCard={trumpCard ?? revealedTrumpCard}
        trumpRevealed={trumpRevealed}
        trumpPlaced={trumpCard !== null || trumpRevealed}
        hideBottomSeat
        completedTrick={trick.length === 0 && lastTrick.length > 0}
        banner={banner}
      />

      {/* Active player control tray */}
      <section className="rounded-2xl border border-border bg-secondary/50 p-4">
        <div className="mb-2 flex min-h-0 flex-wrap items-center justify-end gap-2">
            <StrongSupport
              revealed={trumpRevealed}
              eligible={trumpRevealed && claimer !== null}
            />
            {canCallDouble && !activePlayer?.isBot && activePlayer.hand[0] && (
              <DoubleControl
                card={activePlayer.hand[0]}
                onConfirm={() => handlePlayCard(activePlayer.hand[0].id, true)}
              />
            )}
            {playable && <PlayHint reason={playable.reason} trumpRevealed={trumpRevealed} />}
        </div>

        {/* Hand */}
        <div className="mobile-hand-tray flex min-h-28 items-end justify-center overflow-visible pb-2 px-1 sm:min-h-36 sm:px-3">
          <div className="grid w-full grid-cols-6 items-end gap-1 sm:gap-3">
          {phase === 'dealing' ? (
            <div className="flex items-end justify-center gap-1">
              {Array.from({ length: activePlayer?.hand.length ?? 0 }).map((_, index) => (
                <CardBack key={index} size="md" className="animate-deal-card sm:h-32 sm:w-24" />
              ))}
            </div>
          ) : activePlayer?.isBot ? (
            <div className="flex items-end justify-center gap-1">
              {activePlayer.hand.map((card) => (
                <CardBack key={card.id} size="md" showLabel={false} className="h-16 w-11 sm:h-24 sm:w-16" />
              ))}
              <span className="ml-2 font-mono text-xs text-muted-foreground">{activePlayer.hand.length} cards hidden</span>
            </div>
          ) : activePlayer?.hand.length ? (
            phase === 'playing' ? (
              activePlayer.hand.map((card) => (
                <ClickableCard
                  key={card.id}
                  card={card}
                  size="lg"
                  mobileSize="sm"
                  mobileGrid
                  fan={false}
                  disabled={resolving || !playable?.playableIds.has(card.id)}
                  onClick={() => handlePlayCard(card.id)}
                />
              ))
            ) : (
              // Bidding / trump: hand is view-only but fully legible.
              activePlayer.hand.map((card) => (
                <div key={card.id} className="flex w-full justify-center">
                  <CardFace card={card} size="md" className="sm:h-32 sm:w-24 sm:text-sm" />
                </div>
              ))
            )
          ) : (
            <span className="font-serif italic text-muted-foreground">No cards left</span>
          )}

          {trumpCard && current === claimer && (
            <div className="ml-4 flex shrink-0 flex-col items-center gap-1 border-l border-border pl-4">
              <div className="relative">
                <CardBack size="md" className="opacity-80 sm:h-32 sm:w-24" />
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">Trump card · locked</span>
            </div>
          )}
          </div>
        </div>

        {phase === 'dealing' && (
          <p className="mt-3 border-t border-border pt-3 text-center font-mono text-[11px] uppercase tracking-widest text-gold">
            Dealing batch {Math.max(1, dealBatch)} of 2 · three cards each
          </p>
        )}

        {/* Play controls — the ask sits here, on its own row, so nothing can
            overlap it and the hit target is a comfortable size. */}
        {phase === 'playing' && (
          <div className="relative z-20 mt-3 flex flex-wrap items-center justify-center gap-3 border-t border-border pt-3">
            {playable?.canAskTrump && (
              <button
                type="button"
                onClick={handleAskTrump}
                disabled={resolving}
                className="cursor-pointer rounded-xl border border-gold/60 bg-gold/10 px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-gold transition-colors hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Ask for trump
              </button>
            )}
            <p className="w-full text-center font-mono text-[11px] text-muted-foreground">
              {trumpRevealed
                ? 'Trump is out — it beats the led suit.'
                : playable?.canAskTrump
                  ? 'You are void. Play any card, or turn the trump over first.'
                  : 'Trump is still face down.'}
            </p>
          </div>
        )}

        {/* Bidding controls */}
        {phase === 'bidding' && (
          <div className="mobile-bid-controls sticky bottom-2 z-30 mt-3 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-border bg-secondary/95 px-2 pb-2 pt-3 shadow-xl backdrop-blur md:static md:rounded-none md:border-0 md:bg-transparent md:px-0 md:pb-0 md:shadow-none md:backdrop-blur-0">
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
              <input
                type="number"
                min={minAllowed}
                max={MAX_CLAIM}
                step={CLAIM_STEP}
                value={pendingBid}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, '').slice(0, 3)
                  setPendingBid(digits ? Number(digits) : MIN_CLAIM)
                }}
                className={cn(
                  'w-20 bg-transparent text-center font-serif text-2xl font-bold outline-none',
                  canClaim ? 'text-gold-soft' : 'text-destructive',
                )}
                aria-invalid={!canClaim}
                aria-label="Claim amount"
              />
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
              className="rounded-xl border border-border px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-30"
            >
              Pass
            </button>
            <p className="w-full text-center font-mono text-[11px] text-muted-foreground">
              {highBid > 0
                ? `High bid ${highBid} by ${players[highBidder as number].name}. Yours must be +${CLAIM_STEP} or more.`
                : `Opening claim starts at ${MIN_CLAIM}. Max ${MAX_CLAIM}.`}
            </p>
            {!canClaim && <p className="w-full text-center font-mono text-[11px] text-destructive">{claimError}</p>}
            <p className="w-full text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
              One round of bidding · {bidsLeft} {bidsLeft === 1 ? 'seat' : 'seats'} left to act
            </p>
          </div>
        )}
      </section>

      {phase === 'trump' && claimer !== null && !players[claimer].isBot && (
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
          matchCards={matchCards}
          cardLimit={cardLimit(n)}
          onNextRound={nextRound}
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

function DoubleControl({ card, onConfirm }: { card: Card; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => {
          if (!armed) {
            setArmed(true)
            return
          }
          onConfirm()
        }}
        className={cn(
          'rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors',
          armed
            ? 'bg-destructive text-destructive-foreground'
            : 'border border-destructive/60 bg-destructive/10 text-destructive hover:bg-destructive/20',
        )}
      >
        {armed ? `Confirm — play ${card.rank}${SUIT_SYMBOL[card.suit]} as double` : 'Call double'}
      </button>
      <span className="font-mono text-[10px] text-muted-foreground">
        {armed ? 'Tap again to commit' : 'Your team took the first five tricks'}
      </span>
    </div>
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
              <div className="grid grid-cols-2 justify-items-center gap-3 pb-1 sm:grid-cols-3">
                {hand.map((card) => (
                  <ClickableCard
                    key={card.id}
                    card={card}
                    size="md"
                    fan={false}
                    onClick={() => onSelect(card.id)}
                  />
                ))}
              </div>
            </div>

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
  matchCards,
  cardLimit: lossLimit,
  onNextRound,
  onPlayAgain,
}: {
  claimerName: string
  claimerTeam: 0 | 1
  claim: number
  captured: number
  teamScores: [number, number]
  matchCards: [number, number]
  cardLimit: number
  onNextRound: () => void
  onPlayAgain: () => void
}) {
  const success = captured >= claim
  const loser = matchCards.findIndex((cards) => cards >= lossLimit) as 0 | 1 | -1
  const matchOver = loser !== -1
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border-2 border-gold/50 bg-popover p-8 text-center shadow-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold">{matchOver ? 'Match Over' : 'Round Over'}</p>
        <h2 className={cn('mt-2 font-serif text-4xl font-bold', success ? 'text-gold-soft' : 'text-destructive')}>
          {matchOver ? `${TEAM_NAME[loser]} loses` : success ? 'Claim Made!' : 'Claim Failed'}
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
              <span className="font-serif text-3xl font-bold text-foreground">
                {teamScores[t]}<span className="ml-1 font-mono text-xs font-normal text-muted-foreground">({matchCards[t]}/{lossLimit})</span>
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={matchOver ? onPlayAgain : onNextRound}
          className="mt-6 w-full rounded-xl bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5"
        >
          {matchOver ? 'New Game' : 'Deal Next Round'}
        </button>
      </div>
    </div>
  )
}
